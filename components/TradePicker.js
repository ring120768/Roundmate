"use client";

import { useRouter } from "next/navigation";
import { TRADES } from "@/lib/trades";

// Landing-page trade chooser: a grid of Pugsie-the-pug trade cards.
// Picking one remembers it (so onboarding preselects it after sign-up)
// and heads into the app.
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
    <div style={{ width: "100%", maxWidth: 420 }}>
      <p className="muted" style={{ marginBottom: 10 }}>
        What&apos;s your trade?
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 10,
          marginBottom: 8,
        }}
      >
        {TRADES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => choose(t.key)}
            style={{
              width: "100%",
              padding: 0,
              margin: 0,
              background: "#fff",
              border: "1px solid rgba(37, 99, 235, 0.25)",
              borderRadius: 14,
              overflow: "hidden",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(12, 68, 124, 0.08)",
            }}
            aria-label={t.label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.image}
              alt={t.label}
              style={{
                display: "block",
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
              }}
            />
            <span
              style={{
                display: "block",
                padding: "7px 4px",
                fontSize: 13,
                fontWeight: 600,
                color: "#1e3a8a",
                lineHeight: 1.2,
              }}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
