import { stripeRequest } from "@/lib/stripe";

// Builds and sends a job email (invoice / receipt / confirmation) via Resend.
// Shared by the send-email route (signed-in tradesman, RLS-scoped client)
// and the Stripe webhook (no user — admin client sends the card receipt).
// Returns { ok: true } or { error, status }. Never throws.
export async function sendJobEmail(
  supabase,
  jobId,
  type,
  { replyTo = null, reminderNumber = 1 } = {}
) {
  if (
    !jobId ||
    !["invoice", "receipt", "confirmation", "reminder"].includes(type)
  ) {
    return { error: "Bad request", status: 400 };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Email isn't set up yet (missing RESEND_API_KEY).", status: 500 };
  }

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, business_id, service_type, price, appointment_date, start_time, photo_paths, payment_link_id, payment_link_url, invoice_number, customers(id, first_name, last_name, email), businesses(name, stripe_account_id)"
    )
    .eq("id", jobId)
    .single();

  if (!job) return { error: "Job not found", status: 404 };

  const cust = job.customers;
  if (!cust?.email) {
    return { error: "This customer has no email address.", status: 400 };
  }

  const businessName = job.businesses?.name || "Your local service";
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

  // Photos of the work, embedded via 30-day signed links (private bucket).
  let photosHtml = "";
  if ((type === "invoice" || type === "receipt") && job.photo_paths?.length) {
    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrls(job.photo_paths, 60 * 60 * 24 * 30);
    const urls = (signed || [])
      .filter((s) => s.signedUrl)
      .map((s) => s.signedUrl);
    if (urls.length) {
      photosHtml =
        `<p style="margin-top:20px;"><strong>Photos of the work:</strong></p>` +
        urls
          .map(
            (u) =>
              `<img src="${u}" alt="Photo of the work" style="max-width:100%;border-radius:8px;margin:6px 0;" />`
          )
          .join("");
    }
  }

  // Invoice number: assigned once per job, sequential per business (INV-0001…),
  // so exports line up for the accountant. Best effort — the email still goes
  // without one.
  let invoiceNumber = job.invoice_number || null;
  if (type === "invoice" && !invoiceNumber) {
    try {
      const { data: n } = await supabase.rpc("take_invoice_number", {
        b_id: job.business_id,
      });
      if (n) {
        invoiceNumber = n;
        await supabase
          .from("jobs")
          .update({ invoice_number: n })
          .eq("id", job.id);
      }
    } catch {
      /* no number this time */
    }
  }
  const refHtml = invoiceNumber
    ? `<p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Invoice ref: ${invoiceNumber}</p>`
    : "";

  // For invoices: a card payment link on the tradesman's own Stripe account
  // (created once per job, reused on re-sends; best effort).
  let payLinkUrl = job.payment_link_url || null;
  if (
    (type === "invoice" || type === "reminder") &&
    !payLinkUrl &&
    job.businesses?.stripe_account_id &&
    job.price != null &&
    Number(job.price) > 0
  ) {
    try {
      const acct = job.businesses.stripe_account_id;
      const priceObj = await stripeRequest(
        "/prices",
        {
          currency: "gbp",
          unit_amount: Math.round(Number(job.price) * 100),
          product_data: { name: `${service}${dateLabel ? ` — ${dateLabel}` : ""}` },
        },
        { stripeAccount: acct }
      );
      const link = await stripeRequest(
        "/payment_links",
        { line_items: [{ price: priceObj.id, quantity: 1 }] },
        { stripeAccount: acct }
      );
      payLinkUrl = link.url;
      await supabase
        .from("jobs")
        .update({ payment_link_id: link.id, payment_link_url: link.url })
        .eq("id", job.id);
    } catch {
      /* no pay button this time */
    }
  }
  const payButtonHtml = payLinkUrl
    ? `<p style="margin:20px 0;">
         <a href="${payLinkUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;">Pay now by card</a>
       </p>
       <p style="font-size:13px;color:#6b7280;margin-top:0;">Apple Pay, Google Pay or any card — takes seconds.</p>`
    : "";

  const wrap = (inner) =>
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:480px;margin:0 auto;">
      <h2 style="color:#185fa5;margin:0 0 16px;">${businessName}</h2>
      ${inner}
      <p style="margin-top:24px;">Thanks,<br/>${businessName}</p>
    </div>`;

  let subject, html;
  if (type === "invoice") {
    subject = invoiceNumber
      ? `Invoice ${invoiceNumber} from ${businessName}`
      : `Invoice from ${businessName}`;
    html = wrap(
      `<p>Hi ${firstName},</p>
       <p>Here's your invoice for <strong>${service}</strong> on ${dateLabel}.</p>
       <p style="font-size:26px;font-weight:bold;margin:18px 0 0;">${amount}</p>
       ${refHtml}
       ${payButtonHtml}
       <p>${payLinkUrl ? "Or settle up however suits" : "Please settle up at your convenience"} — just reply to this email if you have any questions.</p>
       ${photosHtml}`
    );
  } else if (type === "receipt") {
    subject = `Payment received — thank you`;
    html = wrap(
      `<p>Hi ${firstName},</p>
       <p>Thank you — we've received your payment of <strong>${amount}</strong> for ${service} on ${dateLabel}.</p>
       ${refHtml}
       <p>Much appreciated. See you next time.</p>
       ${photosHtml}`
    );
  } else if (type === "reminder") {
    // Three-step tone ladder: gentle → nudge → firm. Always with an
    // "if you've already paid, ignore this" line — cash sometimes beats
    // the bookkeeping.
    const ref = invoiceNumber ? ` (invoice ${invoiceNumber})` : "";
    if (reminderNumber <= 1) {
      subject = `A gentle reminder from ${businessName}`;
      html = wrap(
        `<p>Hi ${firstName},</p>
         <p>Just a friendly nudge — the invoice for <strong>${service}</strong> on ${dateLabel}${ref} is still open.</p>
         <p style="font-size:26px;font-weight:bold;margin:18px 0;">${amount}</p>
         ${payButtonHtml}
         <p>If you've already paid, thank you — please ignore this.</p>`
      );
    } else if (reminderNumber === 2) {
      subject = invoiceNumber
        ? `Reminder: invoice ${invoiceNumber} still outstanding — ${businessName}`
        : `Reminder: invoice still outstanding — ${businessName}`;
      html = wrap(
        `<p>Hi ${firstName},</p>
         <p>The invoice for <strong>${service}</strong> on ${dateLabel}${ref} is still showing as unpaid.</p>
         <p style="font-size:26px;font-weight:bold;margin:18px 0;">${amount}</p>
         ${payButtonHtml}
         <p>If you've already paid, please ignore this — and if anything's wrong, just reply and we'll sort it.</p>`
      );
    } else {
      subject = `Overdue: invoice from ${businessName}`;
      html = wrap(
        `<p>Hi ${firstName},</p>
         <p>The invoice for <strong>${service}</strong> on ${dateLabel}${ref} is now more than two weeks overdue.</p>
         <p style="font-size:26px;font-weight:bold;margin:18px 0;">${amount}</p>
         ${payButtonHtml}
         <p>Please settle up as soon as you can. If there's a problem with the work or the bill, reply to this email and we'll put it right.</p>`
      );
    }
  } else {
    const timeLabel = job.start_time ? ` at ${job.start_time.slice(0, 5)}` : "";
    subject = `Your next visit — ${dateLabel}`;
    html = wrap(
      `<p>Hi ${firstName},</p>
       <p>Just to confirm, I'll be round on <strong>${dateLabel}${timeLabel}</strong> for: <strong>${service}</strong>.</p>
       <p>If that day doesn't suit, just reply to this email and we'll rearrange.</p>`
    );
  }

  const payload = {
    from: `${businessName} <hello@roundmate.co.uk>`,
    to: [cust.email],
    subject,
    html,
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

  // Log it (explicit business_id so it works for the webhook's admin client
  // as well as the RLS-scoped one).
  await supabase.from("messages").insert({
    business_id: job.business_id,
    customer_id: cust.id ?? null,
    job_id: job.id,
    message_type: type,
    channel: "email",
    message_body: subject,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  return { ok: true };
}
