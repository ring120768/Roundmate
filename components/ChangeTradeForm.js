"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TradeGrid from "@/components/TradeGrid";
import { TRADES, tradeLabel } from "@/lib/trades";

export default function ChangeTradeForm({ business, preselect = null }) {
  const router = useRouter();
  const supabase = createClient();

  // A ?to=<trade> in the URL (from the dashboard shortcut) preselects it.
  const validPreselect = TRADES.some((t) => t.key === preselect)
    ? preselect
    : null;
  const [trade, setTrade] = useState(
    validPreselect ?? business?.trade ?? "window_cleaning"
  );
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const changed = trade !== business?.trade;

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    const { error: err } = await supabase
      .from("businesses")
      .update({ trade })
      .eq("id", business.id);

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStatus(`You're now set up as: ${tradeLabel(trade)}.`);
    router.refresh();
  }

  return (
    <div className="card">
      <form onSubmit={handleSave}>
        <TradeGrid value={trade} onChange={(k) => { setStatus(""); setTrade(k); }} />
        <p className="muted" style={{ fontSize: 13 }}>
          Changing trade changes the service list on new jobs. Existing jobs
          and customers are untouched.
        </p>

        <button type="submit" disabled={loading || !changed}>
          {loading
            ? "Saving…"
            : changed
            ? `Switch to ${tradeLabel(trade)}`
            : `Current trade: ${tradeLabel(trade)}`}
        </button>
        {error && <p className="error">{error}</p>}
        {status && (
          <p className="note" style={{ color: "var(--ok)" }}>
            {status}
          </p>
        )}
      </form>

      <Link href="/settings" className="linklike">
        ← Back to settings
      </Link>
    </div>
  );
}
