import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import crypto from "crypto";

// Stripe calls this when a customer pays a payment link on a connected
// account (Connect webhook, event: checkout.session.completed). No user is
// signed in, so it uses the service-role key — RLS is bypassed deliberately
// and scoping comes from looking the job up by its payment link id.

function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("=", 2))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject events older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Two kinds of endpoint hit this route:
  // - per-connected-account endpoints (created by us) call with ?business=<id>
  //   and are verified against that business's stored signing secret;
  // - a legacy platform-level endpoint (if any) verifies against the env secret.
  const businessId = new URL(request.url).searchParams.get("business");
  let secret = process.env.STRIPE_WEBHOOK_SECRET || null;
  const adminEarly = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { persistSession: false } }
  );
  if (businessId) {
    const { data: biz } = await adminEarly
      .from("businesses")
      .select("stripe_webhook_secret")
      .eq("id", businessId)
      .single();
    if (biz?.stripe_webhook_secret) secret = biz.stripe_webhook_secret;
  }
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(payload, sig, secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentLinkId = session.payment_link;
    if (paymentLinkId && session.payment_status === "paid") {
      const admin = adminEarly;

      const { data: job } = await admin
        .from("jobs")
        .select("id, customer_id, business_id")
        .eq("payment_link_id", paymentLinkId)
        .single();

      if (job) {
        await admin
          .from("jobs")
          .update({ payment_status: "paid" })
          .eq("id", job.id);

        await admin.from("messages").insert({
          business_id: job.business_id,
          customer_id: job.customer_id,
          job_id: job.id,
          message_type: "payment",
          channel: "stripe",
          message_body: "Paid online by card",
          status: "received",
          sent_at: new Date().toISOString(),
        });

        // Deactivate the link so it can't be paid twice. On per-account
        // endpoints the event has no .account, so look it up from the job's
        // business.
        try {
          const { stripeRequest } = await import("@/lib/stripe");
          let acct = event.account || null;
          if (!acct) {
            const { data: biz } = await admin
              .from("businesses")
              .select("stripe_account_id")
              .eq("id", job.business_id)
              .single();
            acct = biz?.stripe_account_id || null;
          }
          if (acct) {
            await stripeRequest(
              `/payment_links/${paymentLinkId}`,
              { active: "false" },
              { stripeAccount: acct }
            );
          }
        } catch {
          /* best effort */
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
