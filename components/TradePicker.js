"use client";

import { useRouter } from "next/navigation";
import { TRADES } from "@/lib/trades";

// Landing-page trade chooser. Picking a trade remembers it (so onboarding
// preselects it after sign-up) and heads into the app.
export default function TradePicker() {
  const router = useRouter();

  function choose(key) {
    try {
      localStorage.setItem("rm_trade", key);
    } catch {
      // Private browsing — no matter, onboarding still lets them pick.
    }
    router.push("/dashboard");
  }

  return (
    <div style={{ width: "100%", maxWidth: 340 }}>
      <p className="muted" style={{ marginBottom: 10 }}>
        What&apos;s your trade?
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        {TRADES.map((t) => (
          <button
            key={t.key}
            type="button"
            className="secondary"
            style={{ width: "auto", padding: "8px 14px", fontSize: 14 }}
            onClick={() => choose(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
