// The accountant report: the same completed-job data as the on-screen CSV
// download, built server-side and emailed as an attachment.
//
// Shared by /api/accounts-report (tradesman taps "Send to my accountant")
// and /api/cron/accountant-report (the automatic monthly / quarterly send),
// so the file the accountant gets is identical either way.

import { gbp } from "@/lib/money";

// The columns. Kept in step with components/AccountsExport.js — if one
// changes, change both.
const HEADER = [
  "Work date",
  "Invoice no",
  "Customer",
  "Postcode",
  "Description",
  "Amount",
  "Status",
  "Paid date",
  "Method",
];

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function prettyDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Pulls completed jobs in a date range and returns the CSV plus the numbers
// worth putting in the email body.
export async function buildAccountsReport(supabase, { businessId, from, to }) {
  let query = supabase
    .from("jobs")
    .select(
      "appointment_date, invoice_number, service_type, price, payment_status, paid_at, paid_method, customers(first_name, last_name, postcode)"
    )
    .eq("status", "completed")
    .gte("appointment_date", from)
    .lte("appointment_date", to)
    .order("appointment_date", { ascending: true });

  // The cron runs with the service-role key, which bypasses RLS — so it has
  // to scope by hand. Harmless when RLS is already doing it.
  if (businessId) query = query.eq("business_id", businessId);

  const { data: jobs, error } = await query;
  if (error) return { error: error.message, status: 500 };
  if (!jobs?.length) return { error: "No completed jobs in that date range.", status: 404 };

  let invoiced = 0;
  let paid = 0;

  const rows = jobs.map((j) => {
    const amount = j.price != null ? Number(j.price) : 0;
    const isPaid = j.payment_status !== "unpaid" && j.payment_status !== "free";
    if (j.payment_status !== "free") invoiced += amount;
    if (isPaid) paid += amount;

    const status =
      j.payment_status === "unpaid"
        ? "Unpaid"
        : j.payment_status === "free"
        ? "Free"
        : "Paid";
    // Older jobs (before payment capture) recorded the method as the
    // payment_status itself — fall back to that so history exports too.
    const method =
      j.paid_method ||
      (j.payment_status === "cash" || j.payment_status === "bank"
        ? j.payment_status
        : "");

    return [
      j.appointment_date || "",
      j.invoice_number || "",
      j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : "",
      j.customers?.postcode || "",
      j.service_type || "",
      j.price != null ? Number(j.price).toFixed(2) : "",
      status,
      j.paid_at ? j.paid_at.slice(0, 10) : "",
      method,
    ];
  });

  const csv = [HEADER, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");

  return {
    csv,
    count: rows.length,
    invoiced,
    paid,
    outstanding: invoiced - paid,
  };
}

// Builds the report and emails it to the business's accountant.
// Returns { ok, count } or { error, status }. Never throws.
export async function sendAccountsReport(
  supabase,
  { business, from, to, replyTo = null, periodLabel = null }
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Email isn't set up yet (missing RESEND_API_KEY).", status: 500 };
  }
  if (!business?.accountant_email) {
    return { error: "No accountant email saved in Settings.", status: 400 };
  }

  const report = await buildAccountsReport(supabase, {
    businessId: business.id,
    from,
    to,
  });
  if (report.error) return report;

  const businessName = business.name || "Your client";
  const period = periodLabel || `${prettyDate(from)} to ${prettyDate(to)}`;
  const greeting = business.accountant_name
    ? `Hi ${business.accountant_name.split(" ")[0]},`
    : "Hello,";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#111827;line-height:1.55;">
      <p>${greeting}</p>
      <p>Here are the completed jobs for <strong>${businessName}</strong> covering <strong>${period}</strong>, attached as a CSV.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Jobs</td><td style="padding:4px 0;"><strong>${report.count}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Invoiced</td><td style="padding:4px 0;"><strong>${gbp(report.invoiced)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Received</td><td style="padding:4px 0;"><strong>${gbp(report.paid)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Still outstanding</td><td style="padding:4px 0;"><strong>${gbp(report.outstanding)}</strong></td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;">The CSV has a row per completed job with invoice number, amount, payment date and method — it imports straight into FreeAgent, Xero or QuickBooks. No VAT is applied.</p>
      <p style="color:#6b7280;font-size:13px;">Sent automatically by RoundMate on behalf of ${businessName}. Reply to this email to reach them directly.</p>
    </div>`;

  const filename = `${(businessName || "accounts")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-accounts-${from}-to-${to}.csv`;

  const payload = {
    from: `${businessName} <hello@roundmate.co.uk>`,
    to: [business.accountant_email],
    subject: `${businessName} — accounts for ${period}`,
    html,
    attachments: [
      {
        filename,
        content: Buffer.from(report.csv, "utf8").toString("base64"),
      },
    ],
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { error: `Email provider error: ${detail}`, status: 502 };
  }

  // Best effort — if the messages table doesn't accept this type, the send
  // still counts.
  await supabase.from("messages").insert({
    business_id: business.id,
    message_type: "accounts",
    channel: "email",
    message_body: `Accounts ${period} — ${report.count} jobs`,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  await supabase
    .from("businesses")
    .update({ accountant_last_sent_at: new Date().toISOString() })
    .eq("id", business.id);

  return { ok: true, count: report.count, to: business.accountant_email };
}
