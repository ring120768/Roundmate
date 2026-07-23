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
    const endpoint = await stripeRequest("/webhook_endpoints", {
      url: "https://www.roundmate.co.uk/api/stripe/webhook",
      enabled_events: ["checkout.session.completed"],
      connect: "true",
      description:
        "RoundMate: marks jobs paid on invoice-link payment (connected accounts)",
    });

    return NextResponse.json({
      done: true,
      endpointId: endpoint.id,
      listensToConnectedAccounts: endpoint.connect ?? true,
      SIGNING_SECRET_put_this_in_Vercel_as_STRIPE_WEBHOOK_SECRET:
        endpoint.secret,
      then: "Update the env var, redeploy, delete the old dashboard destinations, and delete this route.",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
