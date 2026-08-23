import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Brand from "@/components/Brand";
import TradeQuickSwitch from "@/components/TradeQuickSwitch";
import { statusLabel } from "@/lib/jobOptions";
import { tradeImage } from "@/lib/trades";
import { gbp } from "@/lib/money";

// The colourful shortcuts from Ringo's design mock. The bottom tab bar now
// covers Money / Jobs / Customers / Settings too — these stay because they're
// the app's face, and Calendar + Fill my round have no tab of their own.
const TILES = [
  { href: "/money", cls: "btn-coral", icon: "/icon-money.png", label: "Money" },
  { href: "/jobs", cls: "btn-indigo", icon: "/icon-jobs.png", label: "My Booked Jobs" },
  { href: "/calendar", cls: "btn-teal", icon: "/icon-calendar.png", label: "Calendar" },
  { href: "/rounds", cls: "btn-green", icon: "/icon-round.png", label: "Fill my round" },
  { href: "/customers", cls: "btn-amber", icon: "/icon-customers.png", label: "Customers" },
  { href: "/settings", cls: "btn-grey", icon: "/icon-settings.png", label: "Settings" },
];

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, business_id, businesses(name, trade)")
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
      <Brand variant="bar" image={tradeImage(profile.businesses?.trade)} />
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
            <p className="stat">{gbp(dayValue)}</p>
          </div>
        </div>
      </div>

      <div className="spacer" />

      {jobs.length === 0 ? (
        <div className="empty">
          <p>
            <strong>Nothing booked today.</strong>
          </p>
          <p className="muted">Add a job, or see who&apos;s due nearby.</p>
          <div className="actions-row">
            <Link href="/jobs/new" className="btn">
              Add job
            </Link>
            <Link href="/rounds" className="btn secondary">
              Fill my round
            </Link>
          </div>
        </div>
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
                  <div>{gbp(j.price)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {statusLabel(j.status)}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))
      )}

      <Link href="/jobs/new" className="btn">
        + Add job
      </Link>

      <div className="tile-grid">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className={`btn ${t.cls}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.icon} alt="" className="tile-img" aria-hidden="true" />
            <span className="tile-label">{t.label}</span>
          </Link>
        ))}
      </div>

      <TradeQuickSwitch currentTrade={profile.businesses?.trade ?? null} />
    </div>
  );
}
