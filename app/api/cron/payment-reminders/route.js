import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { sendJobEmail } from "@/lib/jobEmails";

// Daily payment chaser, run by Vercel Cron (see vercel.json).
// Completed + unpaid jobs get a reminder at day 3, 7 and 14 after
// completion — gentle, nudge, firm — then we stop. reminder_count on the
// job guarantees nothing ever sends twice, and paying (card, cash, Mark
// paid) removes the job from the unpaid pool so chasing stops itself.
//
// Protected by CRON_SECRET: Vercel sends "Authorization: Bearer <secret>"
// automatically when the env var is set. Add ?dry=1 to preview without
// sending (useful from the browser with the header via curl).

export const dynamic = "force-dynamic";

const SCHEDULE = [3, 7, 14]; // days after completion for reminders 1..3
const MAX_SENDS_PER_RUN = 50; // safety valve

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
  const now = Date.now();

  const { data: jobs, error } = await admin
    .from("jobs")
    .select("id, completed_at, reminder_count, price, customers(email)")
    .eq("status", "completed")
    .eq("payment_status", "unpaid")
    .lt("reminder_count", SCHEDULE.length)
    .not("completed_at", "is", null)
    .gt("price", 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Which jobs are due their next reminder today?
  const due = (jobs || []).filter((j) => {
    const email = j.customers?.email;
    if (!email || email.endsWith("@example.com")) return false; // test data
    const daysSince = (now - new Date(j.completed_at).getTime()) / 86400000;
    return daysSince >= SCHEDULE[j.reminder_count];
  });

  let sent = 0;
  const failures = [];

  if (!dry) {
    for (const j of due.slice(0, MAX_SENDS_PER_RUN)) {
      const result = await sendJobEmail(admin, j.id, "reminder", {
        reminderNumber: j.reminder_count + 1,
      });
      if (result.ok) {
        sent += 1;
        await admin
          .from("jobs")
          .update({
            reminder_count: j.reminder_count + 1,
            last_reminder_at: new Date().toISOString(),
          })
          .eq("id", j.id);
      } else {
        failures.push({ jobId: j.id, error: result.error });
      }
    }
  }

  return NextResponse.json({
    checked: (jobs || []).length,
    due: due.length,
    sent,
    dry,
    ...(failures.length ? { failures } : {}),
  });
}
