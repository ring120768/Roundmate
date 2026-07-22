import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/jobOptions";

// Today's date as YYYY-MM-DD in UK time, regardless of where the server runs.
function ukToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

function headingFor(dateStr, today) {
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  const diffDays = Math.round((d - t) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default async function JobsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .single();
  if (!profile?.business_id) redirect("/onboarding");

  const today = ukToday();
  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, appointment_date, start_time, service_type, price, status, customers(first_name, last_name, postcode)"
    )
    .gte("appointment_date", today)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  // Group jobs by their date.
  const groups = {};
  (jobs ?? []).forEach((j) => {
    (groups[j.appointment_date] = groups[j.appointment_date] || []).push(j);
  });
  const dates = Object.keys(groups).sort();

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Jobs</h1>
        <span className="muted">{jobs?.length ?? 0} upcoming</span>
      </div>

      <Link href="/jobs/new">
        <button type="button">+ Add job</button>
      </Link>

      <div className="spacer" />

      {dates.length === 0 ? (
        <p className="muted">No upcoming jobs. Add one above.</p>
      ) : (
        dates.map((date) => (
          <div key={date}>
            <h2 style={{ marginTop: 22 }}>{headingFor(date, today)}</h2>
            {groups[date].map((j) => (
              <Link
                key={j.id}
                href={`/jobs/${j.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card" style={{ marginBottom: 10 }}>
                  <div className="row">
                    <div>
                      <strong>
                        {j.customers
                          ? `${j.customers.first_name} ${j.customers.last_name}`
                          : "Job"}
                      </strong>
                      <div className="muted">
                        {j.start_time ? `${j.start_time.slice(0, 5)} · ` : ""}
                        {j.service_type}
                        {j.customers?.postcode ? ` · ${j.customers.postcode}` : ""}
                      </div>
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
            ))}
          </div>
        ))
      )}

      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
