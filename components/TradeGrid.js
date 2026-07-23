"use client";

import { TRADES } from "@/lib/trades";

// Selectable grid of pug trade cards — the visual version of a trade
// dropdown. Controlled: pass `value` (trade key) and `onChange(key)`.
export default function TradeGrid({ value, onChange }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
        gap: 10,
        margin: "6px 0 4px",
      }}
    >
      {TRADES.map((t) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={selected}
            style={{
              width: "100%",
              padding: 0,
              margin: 0,
              background: "#fff",
              border: selected
                ? "3px solid var(--brand, #2563eb)"
                : "1px solid rgba(37, 99, 235, 0.25)",
              borderRadius: 14,
              overflow: "hidden",
              cursor: "pointer",
              boxShadow: selected
                ? "0 3px 10px rgba(37, 99, 235, 0.25)"
                : "0 2px 6px rgba(12, 68, 124, 0.08)",
              position: "relative",
            }}
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
                opacity: selected ? 1 : 0.92,
              }}
            />
            <span
              style={{
                display: "block",
                padding: "6px 4px",
                fontSize: 12.5,
                fontWeight: 600,
                color: selected ? "var(--brand, #2563eb)" : "#1e3a8a",
                lineHeight: 1.2,
              }}
            >
              {selected ? "✓ " : ""}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
