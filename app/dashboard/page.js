import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import Brand from "@/components/Brand";
import { statusLabel } from "@/lib/jobOptions";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, business_id, businesses(name)")
    .eq("id", user.id)
    .single();
  if (!profile?.business_id) redirect("/onboarding");

  const businessName = profile.businesses?.name ?? "your business";
  const firstName = (profile.full_name || "").split(" ")[0];

  // Jobs booked for today (UK time).
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/London",
  });
  const { data: todaysJobs } = await supabase
    .from("jobs")
    .select("id, service_type, price, status, start_time, customers(first_name, last_name, postcode)")
    .eq("appointment_date", today)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const jobs = todaysJobs ?? [];
  const dayValue = jobs.reduce((sum, j) => sum + (j.price ? Number(j.price) : 0), 0);

  return (
    <div className="container">
      <Brand variant="bar" />
      <div style={{ marginBottom: 16 }}>
        <h1>Today</h1>
        <p className="muted">
          {firstName ? `Hi ${firstName} — ` : ""}
          {businessName}
        </p>
      </div>

      <div className="card">
        <div className="row">
          <div>
            <p className="muted">Jobs today</p>
            <p className="stat">{jobs.length}</p>
          </div>
          <div>
            <p className="muted">Day&apos;s value</p>
            <p className="stat">£{dayValue}</p>
          </div>
        </div>
      </div>

      <div className="spacer" />

      {jobs.length === 0 ? (
        <p className="muted">No jobs booked for today.</p>
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
        ))
      )}

      <Link href="/jobs/new">
        <button type="button">+ Add job</button>
      </Link>

      <div className="tile-grid">
        <Link href="/money">
          <button type="button" className="btn-coral">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-money.png" alt="" className="tile-img" aria-hidden="true" />
            Money
          </button>
        </Link>
        <Link href="/jobs">
          <button type="button" className="btn-indigo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-jobs.png" alt="" className="tile-img" aria-hidden="true" />
            My Booked Jobs
          </button>
        </Link>
        <Link href="/calendar">
          <button type="button" className="btn-teal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-calendar.png" alt="" className="tile-img" aria-hidden="true" />
            Calendar
          </button>
        </Link>
        <Link href="/rounds">
          <button type="button" className="btn-green">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-round.png" alt="" className="tile-img" aria-hidden="true" />
            Fill my round
          </button>
        </Link>
        <Link href="/customers">
          <button type="button" className="btn-amber">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-customers.png" alt="" className="tile-img" aria-hidden="true" />
            Customers
          </button>
        </Link>
        <Link href="/settings">
          <button type="button" className="btn-grey">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-settings.png" alt="" className="tile-img" aria-hidden="true" />
            Settings
          </button>
        </Link>
      </div>

      <SignOutButton />
    </div>
  );
}
