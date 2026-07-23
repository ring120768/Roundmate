import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripeRequest } from "@/lib/stripe";

const APP_URL = "https://www.roundmate.co.uk";

// Starts (or resumes) Stripe onboarding for the signed-in business.
// Creates a Standard connected account the first time, then returns a
// Stripe-hosted onboarding link to redirect the tradesman to.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, businesses(id, name, stripe_account_id)")
    .eq("id", user.id)
    .single();
  const business = profile?.businesses;
  if (!business) {
    return NextResponse.json({ error: "No business" }, { status: 400 });
  }

  try {
    let accountId = business.stripe_account_id;
    if (!accountId) {
      const account = await stripeRequest("/accounts", {
        type: "standard",
        country: "GB",
        email: user.email,
        business_profile: { name: business.name || undefined },
      });
      accountId = account.id;
      const { error: saveErr } = await supabase
        .from("businesses")
        .update({ stripe_account_id: accountId })
        .eq("id", business.id);
      if (saveErr) {
        return NextResponse.json({ error: saveErr.message }, { status: 500 });
      }
    }

    const link = await stripeRequest("/account_links", {
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${APP_URL}/settings?stripe=retry`,
      return_url: `${APP_URL}/settings?stripe=done`,
    });

    return NextResponse.json({ url: link.url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

// Reports whether the connected account can take payments yet.
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
  const accountId = profile?.businesses?.stripe_account_id;
  if (!accountId) return NextResponse.json({ connected: false });

  try {
    const account = await stripeRequest(`/accounts/${accountId}`);
    return NextResponse.json({
      connected: true,
      chargesEnabled: Boolean(account.charges_enabled),
    });
  } catch {
    return NextResponse.json({ connected: true, chargesEnabled: false });
  }
}
