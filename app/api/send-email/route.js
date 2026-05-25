import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sends an invoice or receipt email to a job's customer via Resend.
// The RESEND_API_KEY is a server-side secret (set in Vercel env vars), never
// exposed to the browser. Auth + ownership are enforced by Supabase RLS:
// the job query only returns rows belonging to the signed-in user's business.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { jobId, type } = body || {};
  if (!jobId || !["invoice", "receipt", "confirmation"].includes(type)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email isn't set up yet (missing RESEND_API_KEY)." },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, service_type, price, appointment_date, customers(id, first_name, last_name, email), businesses(name)"
    )
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const cust = job.customers;
  if (!cust?.email) {
    return NextResponse.json(
      { error: "This customer has no email address." },
      { status: 400 }
    );
  }

  const businessName = job.businesses?.name || "Your window cleaner";
  const firstName = cust.first_name || "there";
  const service = job.service_type || "your visit";
  const amount = job.price != null ? `£${job.price}` : "";
  const dateLabel = job.appointment_date
    ? new Date(job.appointment_date + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const wrap = (inner) =>
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:480px;margin:0 auto;">
      <h2 style="color:#185fa5;margin:0 0 16px;">${businessName}</h2>
      ${inner}
      <p style="margin-top:24px;">Thanks,<br/>${businessName}</p>
    </div>`;

  let subject, html;
  if (type === "invoice") {
    subject = `Invoice from ${businessName}`;
    html = wrap(
      `<p>Hi ${firstName},</p>
       <p>Here's your invoice for <strong>${service}</strong> on ${dateLabel}.</p>
       <p style="font-size:26px;font-weight:bold;margin:18px 0;">${amount}</p>
       <p>Please settle up at your convenience — just reply to this email if you have any questions.</p>`
    );
  } else if (type === "receipt") {
    subject = `Payment received — thank you`;
    html = wrap(
      `<p>Hi ${firstName},</p>
       <p>Thank you — we've received your payment of <strong>${amount}</strong> for ${service} on ${dateLabel}.</p>
       <p>Much appreciated. See you next time.</p>`
    );
  } else {
    // confirmation of the next visit
    subject = `Your next window clean — ${dateLabel}`;
    html = wrap(
      `<p>Hi ${firstName},</p>
       <p>Just to confirm, I'll be round on <strong>${dateLabel}</strong> to clean your windows.</p>
       <p>If that day doesn't suit, just reply to this email and we'll rearrange.</p>`
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${businessName} <onboarding@resend.dev>`,
      to: [cust.email],
      reply_to: user.email,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: `Email provider error: ${detail}` },
      { status: 502 }
    );
  }

  // Log it (best effort; business_id is auto-filled by the DB default).
  await supabase.from("messages").insert({
    customer_id: cust.id ?? null,
    job_id: job.id,
    message_type: type,
    channel: "email",
    message_body: subject,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
