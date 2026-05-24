"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_OUTCOMES, suggestNextDate } from "@/lib/jobOptions";

export default function CompleteJobForm({ job }) {
  const router = useRouter();
  const supabase = createClient();

  const customer = job.customers; // { id, first_name, last_name, visit_frequency }
  const suggested = suggestNextDate(job.appointment_date, customer?.visit_frequency);

  const [price, setPrice] = useState(job.price ?? "");
  const [outcome, setOutcome] = useState("cash");
  const [bookNext, setBookNext] = useState(Boolean(suggested));
  const [nextDate, setNextDate] = useState(suggested || "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleComplete(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const updates = {
      status: "completed",
      completed_at: new Date().toISOString(),
      payment_status: outcome,
      price: price === "" ? null : Number(price),
    };
    if (note.trim()) {
      updates.notes = job.notes ? `${job.notes}\n${note.trim()}` : note.trim();
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", job.id);
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    // Auto-book the next visit if asked.
    if (bookNext && nextDate && customer?.id) {
      const { error: nextError } = await supabase.from("jobs").insert({
        customer_id: customer.id,
        appointment_date: nextDate,
        service_type: job.service_type,
        price: price === "" ? null : Number(price),
        status: "scheduled",
      });
      if (nextError) {
        setLoading(false);
        setError(
          `Job marked complete, but couldn't book the next visit: ${nextError.message}`
        );
        return;
      }
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card">
      <form onSubmit={handleComplete}>
        <label htmlFor="price">Price (£)</label>
        <input
          id="price"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <label>How was it paid?</label>
        {PAYMENT_OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            className={outcome === o.value ? "" : "secondary"}
            style={{ marginTop: 8 }}
            onClick={() => setOutcome(o.value)}
          >
            {o.label}
          </button>
        ))}

        <label
          htmlFor="book_next"
          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}
        >
          <input
            id="book_next"
            type="checkbox"
            checked={bookNext}
            onChange={(e) => setBookNext(e.target.checked)}
            style={{ width: "auto" }}
          />
          Book next visit
          {customer?.visit_frequency ? ` (${customer.visit_frequency})` : ""}
        </label>

        {bookNext && (
          <input
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            style={{ marginTop: 10 }}
          />
        )}

        <label htmlFor="note">Note (optional)</label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. couldn't reach the back skylight"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Complete job"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <Link href={`/jobs/${job.id}`} className="linklike">
        Cancel
      </Link>
    </div>
  );
}
