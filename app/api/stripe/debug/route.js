import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripeRequest } from "@/lib/stripe";

// TEMPORARY diagnostic (delete after use): shows what webhook endpoints the
// platform has, and what events actually fired on this business's connected
// account. Visit /api/stripe/debug while signed in.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("businesses(stripe_account_id)")
    .eq("id", user.id)
    .single();
  const acct = profile?.businesses?.stripe_account_id;

  const out = { connectedAccount: acct };

  try {
    const eps = await stripeRequest("/webhook_endpoints?limit=10");
    out.platformWebhookEndpoints = eps.data.map((e) => ({
      id: e.id,
      url: e.url,
      status: e.status,
      listensToConnectedAccounts: e.connect ?? false,
      events: e.enabled_events,
      api_version: e.api_version,
    }));
  } catch (e) {
    out.platformWebhookEndpoints = `error: ${e.message}`;
  }

  try {
    const events = await stripeRequest("/events?limit=10", null, {
      stripeAccount: acct,
    });
    out.recentConnectedAccountEvents = events.data.map((e) => ({
      id: e.id,
      type: e.type,
      created: new Date(e.created * 1000).toISOString(),
    }));
  } catch (e) {
    out.recentConnectedAccountEvents = `error: ${e.message}`;
  }

  try {
    const sessions = await stripeRequest(
      "/checkout/sessions?limit=3",
      null,
      { stripeAccount: acct }
    );
    out.recentCheckoutSessions = sessions.data.map((s) => ({
      id: s.id,
      status: s.status,
      payment_status: s.payment_status,
      payment_link: s.payment_link,
      amount_total: s.amount_total,
      created: new Date(s.created * 1000).toISOString(),
    }));
  } catch (e) {
    out.recentCheckoutSessions = `error: ${e.message}`;
  }

  return NextResponse.json(out);
}
