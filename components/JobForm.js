"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { JOB_STATUSES } from "@/lib/jobOptions";
import { servicesForTrade } from "@/lib/trades";

// Today's date as YYYY-MM-DD in the user's local time.
function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Sentinel value for the "add a brand-new customer" choice in the dropdown.
const NEW_CUSTOMER = "__new__";

// One form for both adding and editing a job.
export default function JobForm({
  customers = [],
  initial = null,
  jobId = null,
  preselectedCustomerId = "",
  preselectedDate = "",
  trade = null,
}) {
  const serviceTypes = servicesForTrade(trade);
  const router = useRouter();
  const supabase = createClient();

  // With no customers yet, drop straight into new-customer mode instead of
  // bouncing the user off to another page.
  const startCustomerId = initial?.customer_id ?? preselectedCustomerId ?? "";
  const effectiveStartId =
    !startCustomerId && customers.length === 0 ? NEW_CUSTOMER : startCustomerId;
  const startCustomer = customers.find((c) => c.id === effectiveStartId);
  const startPrice =
    initial?.price ??
    (startCustomer && startCustomer.default_price != null
      ? startCustomer.default_price
      : "");

  const [form, setForm] = useState({
    customer_id: effectiveStartId,
    appointment_date: initial?.appointment_date ?? (preselectedDate || todayISO()),
    // DB stores "HH:MM:SS"; the time input wants "HH:MM".
    start_time: initial?.start_time ? initial.start_time.slice(0, 5) : "",
    service_type: initial?.service_type ?? serviceTypes[0],
    price: startPrice ?? "",
    status: initial?.status ?? "scheduled",
    notes: initial?.notes ?? "",
  });
  const [newCust, setNewCust] = useState({
    first_name: "",
    last_name: "",
    address_line_1: "",
    town_city: "",
    postcode: "",
    phone: "",
    email: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const setNew = (field) => (e) =>
    setNewCust({ ...newCust, [field]: e.target.value });

  const addingNew = form.customer_id === NEW_CUSTOMER;

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
    if (addingNew && !newCust.first_name.trim()) {
      setError("The new customer needs at least a first name.");
      return;
    }
    setLoading(true);
    setError("");

    let customerId = form.customer_id;

    // Create the customer first if this is a brand-new one. The job's price
    // doubles as their default price, so their next booking prefills itself.
    if (addingNew) {
      const clean = (v) => (v && v.trim() !== "" ? v.trim() : null);
      const { data: created, error: custErr } = await supabase
        .from("customers")
        .insert({
          first_name: clean(newCust.first_name),
          last_name: clean(newCust.last_name),
          address_line_1: clean(newCust.address_line_1),
          town_city: clean(newCust.town_city),
          postcode: clean(newCust.postcode),
          phone: clean(newCust.phone),
          email: clean(newCust.email),
          default_price: form.price === "" ? null : Number(form.price),
        })
        .select("id")
        .single();

      if (custErr) {
        setLoading(false);
        setError(custErr.message);
        return;
      }
      customerId = created.id;
    }

    const payload = {
      customer_id: customerId,
      appointment_date: form.appointment_date || null,
      start_time: form.start_time || null,
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
          <option value={NEW_CUSTOMER}>+ Add new customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name}
              {c.postcode ? ` (${c.postcode})` : ""}
            </option>
          ))}
        </select>

        {addingNew && (
          <>
            <label htmlFor="nc_first_name">First name</label>
            <input
              id="nc_first_name"
              value={newCust.first_name}
              onChange={setNew("first_name")}
              required
            />

            <label htmlFor="nc_last_name">Last name</label>
            <input
              id="nc_last_name"
              value={newCust.last_name}
              onChange={setNew("last_name")}
            />

            <label htmlFor="nc_address_line_1">Address</label>
            <input
              id="nc_address_line_1"
              value={newCust.address_line_1}
              onChange={setNew("address_line_1")}
              placeholder="12 High Street"
            />

            <label htmlFor="nc_town_city">Town</label>
            <input
              id="nc_town_city"
              value={newCust.town_city}
              onChange={setNew("town_city")}
            />

            <label htmlFor="nc_postcode">Postcode</label>
            <input
              id="nc_postcode"
              value={newCust.postcode}
              onChange={setNew("postcode")}
              placeholder="CM1 1AA"
            />

            <label htmlFor="nc_phone">Phone</label>
            <input
              id="nc_phone"
              type="tel"
              value={newCust.phone}
              onChange={setNew("phone")}
            />

            <label htmlFor="nc_email">Email</label>
            <input
              id="nc_email"
              type="email"
              value={newCust.email}
              onChange={setNew("email")}
            />
          </>
        )}

        <label htmlFor="appointment_date">Date</label>
        <input
          id="appointment_date"
          type="date"
          value={form.appointment_date}
          onChange={set("appointment_date")}
          required
        />

        <label htmlFor="start_time">Time (optional)</label>
        <input
          id="start_time"
          type="time"
          value={form.start_time}
          onChange={set("start_time")}
        />

        <label htmlFor="service_type">Service</label>
        <select id="service_type" value={form.service_type} onChange={set("service_type")}>
          {/* Keep an edited job's existing service even if it's not on the
              current trade's menu. */}
          {initial?.service_type && !serviceTypes.includes(initial.service_type) && (
            <option value={initial.service_type}>{initial.service_type}</option>
          )}
          {serviceTypes.map((s) => (
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
          {loading
            ? "Saving…"
            : jobId
            ? "Save changes"
            : addingNew
            ? "Add customer + job"
            : "Add job"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <Link href={jobId ? `/jobs/${jobId}` : "/jobs"} className="linklike">
        Cancel
      </Link>
    </div>
  );
}
