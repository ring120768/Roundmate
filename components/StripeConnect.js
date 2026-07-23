"use client";

import { useEffect, useState } from "react";

// Settings card for connecting the tradesman's own Stripe account so
// invoices can carry a "Pay now by card" button. Onboarding happens on
// Stripe's hosted pages — we never see bank details or ID documents.
export default function StripeConnect() {
  const [status, setStatus] = useState(null); // null=loading
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stripe/connect")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  async function connect() {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't start Stripe setup");
      window.location.href = json.url;
    } catch (e) {
      setError(e.message);
      setWorking(false);
    }
  }

  return (
    <div className="card">
      <p style={{ marginBottom: 4 }}>
        <strong>Card payments</strong>
      </p>
      {status?.connected && status?.chargesEnabled ? (
        <p className="note" style={{ color: "var(--ok)" }}>
          ✓ Connected — your invoices now include a &quot;Pay now by card&quot;
          button. Payments go straight to your bank via Stripe.
        </p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 14 }}>
            Let customers pay invoices by Apple Pay, Google Pay or card — money
            goes straight to your bank. Stripe charges 1.5% + 20p per card
            payment; no monthly fee. Setup takes about 5 minutes.
          </p>
          <button type="button" onClick={connect} disabled={working || status === null}>
            {working
              ? "Opening Stripe…"
              : status?.connected
              ? "Finish Stripe setup"
              : "Get paid by card — connect Stripe"}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
