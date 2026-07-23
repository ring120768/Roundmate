import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripeRequest } from "@/lib/stripe";

// ONE-OFF setup helper (delete after use): creates the Connect-scoped
// webhook endpoint via the API — connect:true guarantees it listens to
// connected accounts, which is the bit the dashboard UI makes easy to miss.
// Visit /api/stripe/setup-webhook while signed in; it returns the signing
// secret to put in Vercel as STRIPE_WEBHOOK_SECRET.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    // Idempotent this time: remove any endpoints we previously created for
    // our URL, then create one fresh connect-scoped endpoint.
    const existing = await stripeRequest("/webhook_endpoints?limit=20");
    const removed = [];
    for (const e of existing.data || []) {
      if (e.url === "https://www.roundmate.co.uk/api/stripe/webhook") {
        try {
          await stripeRequest(`/webhook_endpoints/${e.id}`, null, {
            method: "DELETE",
          });
          removed.push(e.id);
        } catch {
          /* keep going */
        }
      }
    }

    const endpoint = await stripeRequest("/webhook_endpoints", {
      url: "https://www.roundmate.co.uk/api/stripe/webhook",
      enabled_events: ["checkout.session.completed"],
      connect: "true",
      description:
        "RoundMate: marks jobs paid on invoice-link payment (connected accounts)",
    });

    return NextResponse.json({
      done: true,
      removedOldEndpoints: removed,
      rawEndpointResponse: endpoint,
      SIGNING_SECRET_put_this_in_Vercel_as_STRIPE_WEBHOOK_SECRET:
        endpoint.secret,
      then: "Update the env var, redeploy, then visit /api/stripe/debug and send Claude the output.",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
