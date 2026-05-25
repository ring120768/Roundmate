"use client";

import { useState } from "react";

export default function SendEmailButtons({ jobId, hasEmail }) {
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  async function send(type) {
    setBusy(type);
    setStatus("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, type }),
      });
      const data = await res.json();
      if (!res.ok) setStatus(data.error || "Couldn't send.");
      else setStatus(type === "invoice" ? "Invoice sent." : "Receipt sent.");
    } catch {
      setStatus("Couldn't send — try again.");
    }
    setBusy("");
  }

  if (!hasEmail) {
    return (
      <p className="muted" style={{ marginTop: 14 }}>
        Add an email address for this customer to send an invoice or receipt.
      </p>
    );
  }

  const sent = status.endsWith("sent.");

  return (
    <div>
      <button
        type="button"
        className="btn-indigo"
        onClick={() => send("invoice")}
        disabled={Boolean(busy)}
      >
        {busy === "invoice" ? "Sending…" : "Email invoice"}
      </button>
      <button
        type="button"
        className="btn-teal"
        onClick={() => send("receipt")}
        disabled={Boolean(busy)}
      >
        {busy === "receipt" ? "Sending…" : "Email receipt"}
      </button>
      {status && (
        <p
          className="note"
          style={{ color: sent ? "var(--ok)" : "var(--danger)" }}
        >
          {status}
        </p>
      )}
    </div>
  );
}
