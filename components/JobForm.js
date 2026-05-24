"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPES, JOB_STATUSES } from "@/lib/jobOptions";

// Today's date as YYYY-MM-DD in the user's local time.
function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// One form for both adding and editing a job.
export default function JobForm({
  customers = [],
  initial = null,
  jobId = null,
  preselectedCustomerId = "",
}) {
  const router = useRouter();
  const supabase = createClient();

  const startCustomerId = initial?.customer_id ?? preselectedCustomerId ?? "";
  const startCustomer = customers.find((c) => c.id === startCustomerId);
  const startPrice =
    initial?.price ??
    (startCustomer && startCustomer.default_price != null
      ? startCustomer.default_price
      : "");

  const [form, setForm] = useState({
    customer_id: startCustomerId,
    appointment_date: initial?.appointment_date ?? todayISO(),
    service_type: initial?.service_type ?? "Window cleaning",
    price: startPrice ?? "",
    status: initial?.status ?? "scheduled",
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // Picking a customer fills in their default price.
  function onCustomerChange(e) {
    const id = e.target.value;
    const cust = customers.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      customer_id: id,
      price:
        cust && cust.default_price != null ? String(cust.default_price) : f.price,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customer_id) {
      setError("Please choose a customer.");
      return;
    }
    setLoading(true);
    setError("");

    const payload = {
      customer_id: form.customer_id,
      appointment_date: form.appointment_date || null,
      service_type: form.service_type || null,
      price: form.price === "" ? null : Number(form.price),
      status: form.status || "scheduled",
      notes: form.notes || null,
    };

    let result;
    if (jobId) {
      result = await supabase.from("jobs").update(payload).eq("id", jobId);
    } else {
      // business_id is auto-filled by the database default.
      result = await supabase.from("jobs").insert(payload);
    }

    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push(jobId ? `/jobs/${jobId}` : "/jobs");
    router.refresh();
  }

  if (customers.length === 0) {
    return (
      <div className="card">
        <p>You need a customer before you can book a job.</p>
        <Link href="/customers/new">
          <button type="button">Add a customer first</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <label htmlFor="customer_id">Customer</label>
        <select
          id="customer_id"
          value={form.customer_id}
          onChange={onCustomerChange}
          required
        >
          <option value="">— Choose customer —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name}
              {c.postcode ? ` (${c.postcode})` : ""}
            </option>
          ))}
        </select>

        <label htmlFor="appointment_date">Date</label>
        <input
          id="appointment_date"
          type="date"
          value={form.appointment_date}
          onChange={set("appointment_date")}
          required
        />

        <label htmlFor="service_type">Service</label>
        <select id="service_type" value={form.service_type} onChange={set("service_type")}>
          {SERVICE_TYPES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <label htmlFor="price">Price (£)</label>
        <input
          id="price"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={form.price}
          onChange={set("price")}
        />

        <label htmlFor="status">Status</label>
        <select id="status" value={form.status} onChange={set("status")}>
          {JOB_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          value={form.notes}
          onChange={set("notes")}
          placeholder="Anything specific for this visit…"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : jobId ? "Save changes" : "Add job"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <Link href={jobId ? `/jobs/${jobId}` : "/jobs"} className="linklike">
        Cancel
      </Link>
    </div>
  );
}
