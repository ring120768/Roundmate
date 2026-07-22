"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// One form used for both adding and editing a customer.
// Pass `initial` + `customerId` to edit; pass nothing to add a new one.
export default function CustomerForm({ initial = null, customerId = null }) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    address_line_1: initial?.address_line_1 ?? "",
    town_city: initial?.town_city ?? "",
    postcode: initial?.postcode ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    default_price: initial?.default_price ?? "",
    visit_frequency: initial?.visit_frequency ?? "",
    access_notes: initial?.access_notes ?? "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Turn blanks into nulls, and the price into a real number.
    const payload = {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      address_line_1: form.address_line_1 || null,
      town_city: form.town_city || null,
      postcode: form.postcode || null,
      phone: form.phone || null,
      email: form.email || null,
      default_price: form.default_price === "" ? null : Number(form.default_price),
      visit_frequency: form.visit_frequency || null,
      access_notes: form.access_notes || null,
    };

    let result;
    if (customerId) {
      result = await supabase.from("customers").update(payload).eq("id", customerId);
    } else {
      // business_id is auto-filled by the database default.
      result = await supabase.from("customers").insert(payload);
    }

    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push(customerId ? `/customers/${customerId}` : "/customers");
    router.refresh();
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <label htmlFor="first_name">First name</label>
        <input id="first_name" value={form.first_name} onChange={set("first_name")} required />

        <label htmlFor="last_name">Last name</label>
        <input id="last_name" value={form.last_name} onChange={set("last_name")} />

        <label htmlFor="address_line_1">Address</label>
        <input
          id="address_line_1"
          value={form.address_line_1}
          onChange={set("address_line_1")}
          placeholder="House number and street"
        />

        <label htmlFor="town_city">Town / city</label>
        <input id="town_city" value={form.town_city} onChange={set("town_city")} />

        <label htmlFor="postcode">Postcode</label>
        <input id="postcode" value={form.postcode} onChange={set("postcode")} />

        <label htmlFor="phone">Phone</label>
        <input id="phone" type="tel" value={form.phone} onChange={set("phone")} />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={form.email} onChange={set("email")} />

        <label htmlFor="default_price">Default price (£)</label>
        <input
          id="default_price"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={form.default_price}
          onChange={set("default_price")}
        />

        <label htmlFor="visit_frequency">Visit frequency</label>
        <select id="visit_frequency" value={form.visit_frequency} onChange={set("visit_frequency")}>
          <option value="">— Select —</option>
          <option>Weekly</option>
          <option>Fortnightly</option>
          <option>Every 4 weeks</option>
          <option>Every 8 weeks</option>
          <option>Every 12 weeks</option>
          <option>Every 6 months</option>
          <option>Every 12 months</option>
          <option>One-off</option>
        </select>

        <label htmlFor="access_notes">Access notes</label>
        <textarea
          id="access_notes"
          value={form.access_notes}
          onChange={set("access_notes")}
          placeholder="Gate code, dog in garden, where the outside tap is…"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : customerId ? "Save changes" : "Add customer"}
        </button>

        {error && <p className="error">{error}</p>}
      </form>

      <Link href={customerId ? `/customers/${customerId}` : "/customers"} className="linklike">
        Cancel
      </Link>
    </div>
  );
}
