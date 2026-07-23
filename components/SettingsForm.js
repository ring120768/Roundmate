"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SettingsForm({ business, userId }) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    name: business?.name ?? "",
    owner_name: business?.owner_name ?? "",
    phone: business?.phone ?? "",
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

    const { error: bizErr } = await supabase
      .from("businesses")
      .update({
        name: form.name,
        owner_name: form.owner_name,
        phone: form.phone || null,
      })
      .eq("id", business.id);

    if (bizErr) {
      setLoading(false);
      setError(bizErr.message);
      return;
    }

    // Keep the profile's copy of name/phone in step (mirrors onboarding).
    await supabase
      .from("profiles")
      .update({ full_name: form.owner_name, phone: form.phone || null })
      .eq("id", userId);

    setLoading(false);
    setStatus("Saved.");
    router.refresh();
  }

  return (
    <div className="card">
      <form onSubmit={handleSave}>
        <label htmlFor="s_name">Business name</label>
        <input id="s_name" value={form.name} onChange={set("name")} required />

        <label htmlFor="s_owner">Your name</label>
        <input
          id="s_owner"
          value={form.owner_name}
          onChange={set("owner_name")}
          required
        />

        <label htmlFor="s_phone">Phone</label>
        <input id="s_phone" type="tel" value={form.phone} onChange={set("phone")} />

        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save settings"}
        </button>
        {error && <p className="error">{error}</p>}
        {status && (
          <p className="note" style={{ color: "var(--ok)" }}>
            {status}
          </p>
        )}
      </form>

      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
