"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Downloads completed jobs in a date range as a CSV the accountant (or
// FreeAgent / Xero / QuickBooks import) can use directly. Defaults to the
// current UK tax year (6 April onwards).

function taxYearStart() {
  const now = new Date();
  const year = now >= new Date(now.getFullYear(), 3, 6) // 6 April
    ? now.getFullYear()
    : now.getFullYear() - 1;
  return `${year}-04-06`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// CSV-safe: wrap in quotes, double any quotes inside.
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AccountsExport({ accountant }) {
  const supabase = createClient();
  const [from, setFrom] = useState(taxYearStart());
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  // Emails the same range straight to the accountant saved in Settings —
  // one tap instead of download, find the file, open the mail app, attach.
  async function sendToAccountant() {
    setSending(true);
    setError("");
    setSent("");
    try {
      const res = await fetch("/api/accounts-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't send it.");
      setSent(`Sent ${json.count} job${json.count === 1 ? "" : "s"} to ${json.to}.`);
    } catch (e) {
      setError(e.message);
    }
    setSending(false);
  }

  async function download() {
    setBusy(true);
    setError("");
    setSent("");

    const { data: jobs, error: qErr } = await supabase
      .from("jobs")
      .select(
        "appointment_date, invoice_number, service_type, price, payment_status, paid_at, paid_method, customers(first_name, last_name, postcode)"
      )
      .eq("status", "completed")
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .order("appointment_date", { ascending: true });

    if (qErr) {
      setBusy(false);
      setError(qErr.message);
      return;
    }
    if (!jobs?.length) {
      setBusy(false);
      setError("No completed jobs in that date range.");
      return;
    }

    const header = [
      "Work date",
      "Invoice no",
      "Customer",
      "Postcode",
      "Description",
      "Amount",
      "Status",
      "Paid date",
      "Method",
    ];

    const rows = jobs.map((j) => {
      const paid =
        j.payment_status === "unpaid"
          ? "Unpaid"
          : j.payment_status === "free"
          ? "Free"
          : "Paid";
      // Older jobs (before payment capture) recorded the method as the
      // payment_status itself — fall back to that so history exports too.
      const method =
        j.paid_method ||
        (j.payment_status === "cash" || j.payment_status === "bank"
          ? j.payment_status
          : "");
      return [
        j.appointment_date || "",
        j.invoice_number || "",
        j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : "",
        j.customers?.postcode || "",
        j.service_type || "",
        j.price != null ? Number(j.price).toFixed(2) : "",
        paid,
        j.paid_at ? j.paid_at.slice(0, 10) : "",
        method,
      ];
    });

    const csv = [header, ...rows]
      .map((r) => r.map(csvCell).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roundmate-accounts-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
  }

  return (
    <div className="card">
      <p style={{ marginTop: 0 }}>
        <strong>Accounts export</strong>
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        Every completed job with invoice number, amount, payment date and
        method — ready for your accountant or to import into FreeAgent, Xero
        or QuickBooks.
      </p>
      <div className="row" style={{ gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="acc_from">From</label>
          <input
            id="acc_from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="acc_to">To</label>
          <input
            id="acc_to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      {accountant?.email ? (
        <button type="button" onClick={sendToAccountant} disabled={sending}>
          {sending
            ? "Sending…"
            : `Send to ${accountant.name || "my accountant"}`}
        </button>
      ) : (
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Add your accountant&apos;s email in Settings and you can send this
          straight to them — or have it go automatically each month.
        </p>
      )}

      <button
        type="button"
        className={accountant?.email ? "secondary" : ""}
        onClick={download}
        disabled={busy}
      >
        {busy ? "Preparing…" : "Download CSV"}
      </button>

      {sent && (
        <p className="note" style={{ color: "var(--ok)" }}>
          {sent}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
