"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UnpaidList({ jobs }) {
  const router = useRouter();
  const supabase = createClient();
  const [busyId, setBusyId] = useState(null);

  async function markPaid(id) {
    setBusyId(id);
    const { error } = await supabase
      .from("jobs")
      .update({ payment_status: "paid" })
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
    return <p className="muted">Nothing outstanding — all paid up.</p>;
  }

  return (
    <>
      {jobs.map((j) => (
        <div key={j.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row">
            <Link
              href={`/jobs/${j.id}`}
              style={{ textDecoration: "none", color: "inherit", flex: 1 }}
            >
              <strong>
                {j.customers
                  ? `${j.customers.first_name} ${j.customers.last_name}`
                  : "Job"}
              </strong>
              <div className="muted">
                {j.appointment_date
                  ? new Date(j.appointment_date + "T00:00:00").toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short" }
                    )
                  : ""}
                {j.price != null ? ` · £${j.price}` : ""}
              </div>
            </Link>
            <button
              type="button"
              onClick={() => markPaid(j.id)}
              disabled={busyId === j.id}
              style={{ width: "auto", marginTop: 0, padding: "10px 14px" }}
            >
              {busyId === j.id ? "…" : "Mark paid"}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
