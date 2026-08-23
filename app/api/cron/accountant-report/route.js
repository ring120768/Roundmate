import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { sendAccountsReport } from "@/lib/accountsReport";

// Runs on the 1st of each month (see vercel.json). Every business that's
// saved an accountant email gets last month's completed jobs sent over —
// or last quarter's, if they picked quarterly.
//
// Same CRON_SECRET protection as the payment chaser. ?dry=1 previews.

export const dynamic = "force-dynamic";

const MAX_PER_RUN = 100;

// UK tax quarters start in April, so quarterly sends land on 1 Apr, 1 Jul,
// 1 Oct and 1 Jan — covering the three months just gone.
const QUARTER_START_MONTHS = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

// The period to report on, given today's date and the chosen frequency.
// Returns null when this business isn't due a send this month.
function periodFor(frequency, now) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (frequency === "monthly") {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0)); // day 0 = last of prev month
    return {
      from: ymd(start),
      to: ymd(end),
      label: start.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    };
  }

  if (frequency === "quarterly") {
    if (!QUARTER_START_MONTHS.includes(month)) return null;
    const start = new Date(Date.UTC(year, month - 3, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return {
      from: ymd(start),
      to: ymd(end),
      label: `${start.toLocaleDateString("en-GB", {
        month: "long",
        timeZone: "UTC",
      })}–${end.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}`,
    };
  }

  return null;
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const now = new Date();

  const { data: businesses, error } = await admin
    .from("businesses")
    .select("id, name, accountant_name, accountant_email, accountant_frequency")
    .neq("accountant_frequency", "off")
    .not("accountant_email", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = [];
  for (const b of businesses || []) {
    const period = periodFor(b.accountant_frequency, now);
    if (period) due.push({ business: b, period });
  }

  let sent = 0;
  const skipped = [];
  const failures = [];

  if (!dry) {
    for (const { business, period } of due.slice(0, MAX_PER_RUN)) {
      const result = await sendAccountsReport(admin, {
        business,
        from: period.from,
        to: period.to,
        periodLabel: period.label,
      });
      if (result.ok) sent += 1;
      // A quiet month is not a failure — nothing to send, nothing to say.
      else if (result.status === 404) skipped.push(business.id);
      else failures.push({ businessId: business.id, error: result.error });
    }
  }

  return NextResponse.json({
    checked: (businesses || []).length,
    due: due.length,
    sent,
    dry,
    ...(skipped.length ? { skippedEmpty: skipped.length } : {}),
    ...(failures.length ? { failures } : {}),
  });
}
