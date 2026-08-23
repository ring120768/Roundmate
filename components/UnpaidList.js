"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { gbp, daysSince, overdueTone } from "@/lib/money";

export default function UnpaidList({ jobs }) {
  const router = useRouter();
  const supabase = createClient();
  const [busyId, setBusyId] = useState(null);

  async function markPaid(id) {
    setBusyId(id);
    const { error } = await supabase
      .from("jobs")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        // Marked paid after the fact — nearly always a bank transfer landing.
        paid_method: "bank",
      })
      .eq("id", id);

    // Send the thank-you receipt too (best effort — marking paid succeeds
    // even if the customer has no email or the send fails).
    if (!error) {
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: id, type: "receipt" }),
        });
      } catch {
        /* ignore */
      }
    }

    setBusyId(null);
    if (!error) router.refresh();
  }

  if (jobs.length === 0) {
    return (
      <div className="empty">
        <p>
          <strong>Nothing outstanding</strong>
        </p>
        <p className="muted">All paid up. Nice.</p>
      </div>
    );
  }

  // Oldest debt first — that's the order you'd chase them in.
  const sorted = [...jobs].sort(
    (a, b) => (daysSince(b.completed_at) ?? 0) - (daysSince(a.completed_at) ?? 0)
  );

  return (
    <>
      {sorted.map((j) => {
        const days = daysSince(j.completed_at);
        const tone = overdueTone(days);
        return (
          <div key={j.id} className="card" style={{ marginBottom: 10 }}>
            <div className="row">
              <Link
                href={`/jobs/${j.id}`}
                style={{ textDecoration: "none", color: "inherit", flex: 1 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong>
                    {j.customers
                      ? `${j.customers.first_name} ${j.customers.last_name}`
                      : "Job"}
                  </strong>
                  {tone && <span className={tone.className}>{tone.label}</span>}
                </div>
                <div className="muted">
                  {j.appointment_date
                    ? new Date(
                        j.appointment_date + "T00:00:00"
                      ).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    : ""}
                  {j.price != null ? ` · ${gbp(j.price)}` : ""}
                  {j.reminder_count > 0
                    ? ` · ${j.reminder_count} reminder${
                        j.reminder_count > 1 ? "s" : ""
                      } sent`
                    : ""}
                </div>
              </Link>
              <button
                type="button"
                className="btn-inline"
                onClick={() => markPaid(j.id)}
                disabled={busyId === j.id}
              >
                {busyId === j.id ? "…" : "Mark paid"}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
