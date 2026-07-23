// Minimal Stripe REST helper — no SDK, same fetch style as the Resend
// integration. Server-side only (uses the secret key).

const API = "https://api.stripe.com/v1";

// Stripe's API takes form-encoded bodies with bracket notation for nesting.
export function formEncode(obj, prefix = "") {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object") parts.push(formEncode(item, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof v === "object") {
      parts.push(formEncode(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

// Call the Stripe API. `stripeAccount` runs the request on a connected
// account (direct charges / payment links on the tradesman's own Stripe).
export async function stripeRequest(path, body = null, { method, stripeAccount } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe isn't set up (missing STRIPE_SECRET_KEY).");

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;

  const res = await fetch(`${API}${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers,
    body: body ? formEncode(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe error ${res.status}`);
  }
  return json;
}
