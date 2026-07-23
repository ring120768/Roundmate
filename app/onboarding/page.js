"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TRADES, DEFAULT_TRADE } from "@/lib/trades";
import TradeGrid from "@/components/TradeGrid";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState(DEFAULT_TRADE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If they picked their trade on the landing page, carry it through.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rm_trade");
      if (saved && TRADES.some((t) => t.key === saved)) setTrade(saved);
    } catch {
      // localStorage unavailable — keep the default.
    }
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // We generate the business id here so we don't need the database to hand it
    // back. (The RLS rules block reading the row until our profile is linked to
    // it, so asking for it back on insert would come up empty.)
    const businessId = crypto.randomUUID();

    const { error: insertError } = await supabase.from("businesses").insert({
      id: businessId,
      name,
      owner_name: ownerName,
      phone,
      trade,
    });

    if (insertError) {
      setLoading(false);
      setError(insertError.message);
      return;
    }

    // Link this user's profile to the new business. From now on, RLS lets them
    // see and manage everything belonging to it.
    const { error: linkError } = await supabase
      .from("profiles")
      .update({ business_id: businessId, full_name: ownerName, phone })
      .eq("id", user.id);

    setLoading(false);

    if (linkError) {
      setError(linkError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="container">
      <div style={{ marginBottom: 24 }}>
        <h1>Set up your business</h1>
        <p className="muted">Just the basics — you can change this later.</p>
      </div>

      <div className="card">
        <form onSubmit={handleCreate}>
          <label>Your trade</label>
          <TradeGrid value={trade} onChange={setTrade} />

          <label htmlFor="name">Business name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ringo's Cleaning"
            required
          />

          <label htmlFor="ownerName">Your name</label>
          <input
            id="ownerName"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
          />

          <label htmlFor="phone">Phone (optional)</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create business"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
