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
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !serviceKey) {
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
      const admin = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey,
        { auth: { persistSession: false } }
      );

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

        // Deactivate the link so it can't be paid twice.
        try {
          const { stripeRequest } = await import("@/lib/stripe");
          await stripeRequest(
            `/payment_links/${paymentLinkId}`,
            { active: "false" },
            { stripeAccount: event.account }
          );
        } catch {
          /* best effort */
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
