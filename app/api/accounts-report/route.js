import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAccountsReport } from "@/lib/accountsReport";

// "Send to my accountant" on /money. Auth + RLS-scoped client, then the
// shared report builder does the work.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { from, to } = body || {};
  if (!from || !to) {
    return NextResponse.json({ error: "Pick a date range first." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "businesses(id, name, accountant_name, accountant_email)"
    )
    .eq("id", user.id)
    .single();

  const business = profile?.businesses;
  if (!business?.id) {
    return NextResponse.json({ error: "No business found." }, { status: 400 });
  }

  const result = await sendAccountsReport(supabase, {
    business,
    from,
    to,
    replyTo: user.email,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  }
  return NextResponse.json(result);
}
