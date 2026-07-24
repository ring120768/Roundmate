import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripeRequest } from "@/lib/stripe";

// ONE-OFF setup (delete after use): creates a webhook endpoint ON this
// business's connected Stripe account — where the payment events actually
// happen. Its signing secret is stored on the business row, so there is
// nothing to paste into Vercel. Visit /api/stripe/setup-webhook signed in.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, businesses(id, stripe_account_id)")
    .eq("id", user.id)
    .single();
  const business = profile?.businesses;
  if (!business?.stripe_account_id) {
    return NextResponse.json({ error: "No connected Stripe account yet" }, { status: 400 });
  }

  try {
    const acct = business.stripe_account_id;
    const url = `https://www.roundmate.co.uk/api/stripe/webhook?business=${business.id}`;

    // Clean out any previous endpoints we made on this connected account.
    const existing = await stripeRequest("/webhook_endpoints?limit=20", null, {
      stripeAccount: acct,
    });
    const removed = [];
    for (const e of existing.data || []) {
      if ((e.url || "").startsWith("https://www.roundmate.co.uk/")) {
        try {
          await stripeRequest(`/webhook_endpoints/${e.id}`, null, {
            method: "DELETE",
            stripeAccount: acct,
          });
          removed.push(e.id);
        } catch {
          /* keep going */
        }
      }
    }

    // The endpoint lives on the connected account itself — its events,
    // its webhook, no cross-account routing to go wrong.
    const endpoint = await stripeRequest(
      "/webhook_endpoints",
      {
        url,
        enabled_events: ["checkout.session.completed"],
        description: "RoundMate: marks jobs paid when an invoice link is paid",
      },
      { stripeAccount: acct }
    );

    const { error: saveErr } = await supabase
      .from("businesses")
      .update({ stripe_webhook_secret: endpoint.secret })
      .eq("id", business.id);
    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    return NextResponse.json({
      done: true,
      removedOldEndpoints: removed,
      endpointId: endpoint.id,
      onAccount: acct,
      url: endpoint.url,
      secretStored: "in the database — nothing to paste anywhere",
      next: "Pay a £1 invoice; the job should mark itself paid.",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
