import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendJobEmail } from "@/lib/jobEmails";

// Thin wrapper: auth + RLS-scoped client, then the shared email sender.
// (The Stripe webhook uses the same sender with an admin client.)
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { jobId, type } = body || {};

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const result = await sendJobEmail(supabase, jobId, type, {
    replyTo: user.email,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  }
  return NextResponse.json({ ok: true });
}
