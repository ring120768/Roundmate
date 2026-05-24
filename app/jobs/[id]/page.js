import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/jobOptions";

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="muted" style={{ fontSize: 13 }}>
        {label}
      </div>
      <div>{value || "—"}</div>
    </div>
  );
}

export default async function JobDetailPage({ params }) {
  const { id } = params;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("*, customers(id, first_name, last_name, postcode)")
    .eq("id", id)
    .single();
  if (!job) notFound();

  const cust = job.customers;
  const dateLabel = job.appointment_date
    ? new Date(job.appointment_date + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="container">
      <h1>{cust ? `${cust.first_name} ${cust.last_name}` : "Job"}</h1>
      <p className="muted">{job.service_type}</p>
      <div className="spacer" />

      <div className="card">
        <Field label="Date" value={dateLabel} />
        <Field label="Price" value={job.price != null ? `£${job.price}` : null} />
        <Field label="Status" value={statusLabel(job.status)} />
        <Field label="Notes" value={job.notes} />
      </div>

      <Link href={`/jobs/${id}/edit`}>
        <button type="button">Edit job</button>
      </Link>

      {cust && (
        <Link href={`/customers/${cust.id}`} className="linklike">
          View customer →
        </Link>
      )}
      <br />
      <Link href="/jobs" className="linklike">
        ← Back to jobs
      </Link>
    </div>
  );
}
