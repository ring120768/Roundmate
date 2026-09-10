"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Who gets the books, and how often. Saved on the business, so both the
// "Send to my accountant" button on /money and the monthly cron know where
// to post it.
const FREQUENCIES = [
  { value: "off", label: "Only when I tap send" },
  { value: "monthly", label: "Automatically, every month" },
  { value: "quarterly", label: "Automatically, every quarter" },
];

export default function AccountantSettings({ business }) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    accountant_name: business?.accountant_name ?? "",
    accountant_email: business?.accountant_email ?? "",
    accountant_frequency: business?.accountant_frequency ?? "off",
  });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => {
    setStatus("");
    setForm({ ...form, [field]: e.target.value });
  };

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    const email = form.accountant_email.trim();
    // No email, no automatic sending — otherwise the cron has nowhere to post.
    const frequency = email ? form.accountant_frequency : "off";

    const { error: saveErr } = await supabase
      .from("businesses")
      .update({
        accountant_name: form.accountant_name.trim() || null,
        accountant_email: email || null,
        accountant_frequency: frequency,
      })
      .eq("id", business.id);

    setLoading(false);
    if (saveErr) {
      setError(saveErr.message);
      return;
    }
    setForm({ ...form, accountant_frequency: frequency });
    setStatus("Saved.");
    router.refresh();
  }

  const lastSent = business?.accountant_last_sent_at
    ? new Date(business.accountant_last_sent_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="card">
      <p style={{ marginTop: 0, marginBottom: 4 }}>
        <strong>My accountant</strong>
      </p>
      <p className="muted" style={{ fontSize: 14 }}>
        Save their email and RoundMate can send your completed jobs straight
        over — every job with its invoice number, amount, payment date and
        method, as a spreadsheet they can import.
      </p>

      <form onSubmit={handleSave}>
        <label htmlFor="acct_name">Accountant&apos;s name</label>
        <input
          id="acct_name"
          value={form.accountant_name}
          onChange={set("accountant_name")}
          placeholder="e.g. Sarah at Bell &amp; Co"
        />

        <label htmlFor="acct_email">Their email</label>
        <input
          id="acct_email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={form.accountant_email}
          onChange={set("accountant_email")}
          placeholder="sarah@bellaccounts.co.uk"
        />

        <label htmlFor="acct_freq">Send it</label>
        <select
          id="acct_freq"
          value={form.accountant_frequency}
          onChange={set("accountant_frequency")}
          disabled={!form.accountant_email.trim()}
        >
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Automatic sends go out on the 1st, covering the period just gone.
          {lastSent ? ` Last sent ${lastSent}.` : ""}
        </p>

        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save accountant"}
        </button>
        {error && <p className="error">{error}</p>}
        {status && (
          <p className="note" style={{ color: "var(--ok)" }}>
            {status}
          </p>
        )}
      </form>
    </div>
  );
}
