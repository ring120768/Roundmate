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
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Shrink a photo before upload — van 4G doesn't want 8MB originals, and
  // neither does the customer's inbox.
  async function downscale(file, max = 1600, quality = 0.8) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    return new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
  }

  function onPhotosChosen(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) setPhotos((p) => [...p, ...files]);
    e.target.value = ""; // allow picking the same file again
  }

  // Best-effort email send — completion still succeeds even if an email fails.
  async function fireEmail(jobId, type) {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, type }),
      });
    } catch {
      /* ignore */
    }
  }

  async function handleComplete(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const priceVal = price === "" ? null : Number(price);

    // Upload photos first (best effort — a failed photo never blocks
    // completing the job).
    const photoPaths = [];
    for (const file of photos) {
      try {
        const blob = (await downscale(file).catch(() => null)) || file;
        const path = `${job.business_id}/jobs/${job.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (!upErr) photoPaths.push(path);
      } catch {
        /* skip this photo */
      }
    }

    const updates = {
      status: "completed",
      completed_at: new Date().toISOString(),
      payment_status: outcome,
      price: priceVal,
    };
    if (photoPaths.length) {
      updates.photo_paths = [...(job.photo_paths || []), ...photoPaths];
    }
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

    // Auto-send the money email: invoice if unpaid, receipt if paid.
    const moneyType =
      outcome === "unpaid"
        ? "invoice"
        : outcome === "cash" || outcome === "bank"
        ? "receipt"
        : null;
    if (moneyType) await fireEmail(job.id, moneyType);

    // Auto-book the next visit and send its confirmation.
    if (bookNext && nextDate && customer?.id) {
      const nextId = crypto.randomUUID();
      const { error: nextError } = await supabase.from("jobs").insert({
        id: nextId,
        customer_id: customer.id,
        appointment_date: nextDate,
        service_type: job.service_type,
        price: priceVal,
        status: "scheduled",
      });
      if (nextError) {
        setLoading(false);
        setError(
          `Job marked complete, but couldn't book the next visit: ${nextError.message}`
        );
        return;
      }
      await fireEmail(nextId, "confirmation");
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

        <label htmlFor="photos" style={{ marginTop: 22 }}>
          Photos of the work (optional)
        </label>
        <input
          id="photos"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={onPhotosChosen}
        />
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {photos.map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={URL.createObjectURL(f)}
                alt={`photo ${i + 1}`}
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.1)",
                }}
              />
            ))}
            <button
              type="button"
              className="secondary"
              style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
              onClick={() => setPhotos([])}
            >
              Clear
            </button>
          </div>
        )}
        <p className="muted" style={{ fontSize: 13 }}>
          Sent with the invoice or receipt as proof of the work.
        </p>

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
