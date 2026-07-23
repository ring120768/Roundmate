import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DayPicker from "@/components/DayPicker";
import RouteOptimizer from "@/components/RouteOptimizer";

function ukToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

// The outward part of a UK postcode (e.g. "CM1 2AB" -> "CM1"). The inward
// part is always the last 3 characters.
function outward(pc) {
  if (!pc) return null;
  const clean = pc.replace(/\s+/g, "").toUpperCase();
  return clean.length > 3 ? clean.slice(0, -3) : clean;
}

function prettyDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function RoundsPage({ searchParams }) {
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

  const date = searchParams?.date || ukToday();

  // What's already booked that day, and where.
  const { data: dayJobs } = await supabase
    .from("jobs")
    .select("customer_id, customers(postcode)")
    .eq("appointment_date", date);

  const bookedCustomerIds = new Set((dayJobs ?? []).map((j) => j.customer_id));
  const districts = new Set();
  (dayJobs ?? []).forEach((j) => {
    const o = outward(j.customers?.postcode);
    if (o) districts.add(o);
  });

  // All customers; we match them to the day's districts in JS.
  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, postcode, default_price")
    .order("first_name", { ascending: true });

  const byDistrict = {};
  (customers ?? []).forEach((c) => {
    const o = outward(c.postcode);
    if (!o || !districts.has(o)) return;
    if (bookedCustomerIds.has(c.id)) return; // already booked that day
    (byDistrict[o] = byDistrict[o] || []).push(c);
  });
  const districtKeys = Object.keys(byDistrict).sort();
  const suggestionCount = districtKeys.reduce(
    (n, k) => n + byDistrict[k].length,
    0
  );

  return (
    <div className="container">
      <h1>Fill my round</h1>
      <p className="muted">Find customers near where you&apos;re already working.</p>
      <div className="spacer" />

      <div className="card">
        <DayPicker date={date} />
        <div className="spacer" />
        {districts.size === 0 ? (
          <p className="muted">
            No jobs booked on {prettyDate(date)} yet. Book some first, then I&apos;ll
            suggest nearby customers.
          </p>
        ) : (
          <p>
            On <strong>{prettyDate(date)}</strong> you&apos;re working in:{" "}
            {[...districts].sort().join(", ")}.
          </p>
        )}
      </div>

      <div className="spacer" />
      <RouteOptimizer date={date} />

      {districts.size > 0 && (
        <>
          <div className="spacer" />
          {suggestionCount === 0 ? (
            <p className="muted">
              No other customers in those areas — nice and tidy.
            </p>
          ) : (
            districtKeys.map((k) => (
              <div key={k}>
                <h2 style={{ marginTop: 20 }}>{k}</h2>
                {byDistrict[k].map((c) => (
                  <div key={c.id} className="card" style={{ marginBottom: 10 }}>
                    <div className="row">
                      <div>
                        <strong>
                          {c.first_name} {c.last_name}
                        </strong>
                        <div className="muted">
                          {c.postcode}
                          {c.default_price != null ? ` · £${c.default_price}` : ""}
                        </div>
                      </div>
                      <Link href={`/jobs/new?customer=${c.id}&date=${date}`}>
                        <button
                          type="button"
                          style={{ width: "auto", marginTop: 0, padding: "10px 16px" }}
                        >
                          Book
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      )}

      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
