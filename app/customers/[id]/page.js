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

export default async function CustomerDetailPage({ params }) {
  const { id } = params;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (!c) notFound();

  // This customer's jobs, most recent first.
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, appointment_date, service_type, price, status")
    .eq("customer_id", id)
    .order("appointment_date", { ascending: false })
    .limit(20);

  const fullAddress = [c.address_line_1, c.town_city, c.postcode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="container">
      <h1>
        {c.first_name} {c.last_name}
      </h1>
      <div className="spacer" />

      <div className="card">
        <Field label="Address" value={fullAddress} />
        <Field label="Phone" value={c.phone} />
        <Field label="Email" value={c.email} />
        <Field
          label="Default price"
          value={c.default_price != null ? `£${c.default_price}` : null}
        />
        <Field label="Visit frequency" value={c.visit_frequency} />
        <Field label="Access notes" value={c.access_notes} />
      </div>

      <Link href={`/customers/${id}/edit`}>
        <button type="button">Edit</button>
      </Link>

      <Link href={`/jobs/new?customer=${id}`}>
        <button type="button" className="secondary">
          Book a job
        </button>
      </Link>

      <div className="spacer" />
      <h2>Jobs</h2>
      {!jobs || jobs.length === 0 ? (
        <p className="muted">No jobs yet for this customer.</p>
      ) : (
        jobs.map((j) => (
          <Link
            key={j.id}
            href={`/jobs/${j.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="row">
                <div>
                  <strong>
                    {j.appointment_date
                      ? new Date(
                          j.appointment_date + "T00:00:00"
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </strong>
                  <div className="muted">{j.service_type}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>{j.price != null ? `£${j.price}` : ""}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {statusLabel(j.status)}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))
      )}

      <Link href="/customers" className="linklike">
        ← Back to customers
      </Link>
    </div>
  );
}
