"use client";

import { useRouter } from "next/navigation";
import TradeGrid from "@/components/TradeGrid";

// Dashboard shortcut: the trade cards, one scroll down. Tapping a trade
// heads to the Change Trade page with that trade preselected — switching
// still takes one deliberate confirm, so no accidental thumb-taps.
export default function TradeQuickSwitch({ currentTrade }) {
  const router = useRouter();

  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ marginBottom: 4 }}>Trades</h2>
      <p className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
        Your trade sets the services on new jobs. Tap one to switch.
      </p>
      <TradeGrid
        value={currentTrade}
        onChange={(key) => router.push(`/trade?to=${key}`)}
      />
    </div>
  );
}
