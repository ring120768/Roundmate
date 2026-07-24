import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PAID_STATUSES } from "@/lib/jobOptions";
import UnpaidList from "@/components/UnpaidList";
import AccountsExport from "@/components/AccountsExport";

export default async function MoneyPage() {
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

  // Outstanding: jobs that are done but not paid.
  const { data: unpaid } = await supabase
    .from("jobs")
    .select("id, appointment_date, service_type, price, customers(first_name, last_name, postcode)")
    .eq("status", "completed")
    .eq("payment_status", "unpaid")
    .order("appointment_date", { ascending: true });

  const outstandingTotal = (unpaid ?? []).reduce(
    (sum, j) => sum + (j.price ? Number(j.price) : 0),
    0
  );

  // Paid in the last 7 days.
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: paidWeek } = await supabase
    .from("jobs")
    .select("price")
    .in("payment_status", PAID_STATUSES)
    .gte("completed_at", weekAgo);
  const paidWeekTotal = (paidWeek ?? []).reduce(
    (sum, j) => sum + (j.price ? Number(j.price) : 0),
    0
  );

  return (
    <div className="container">
      <h1>Money</h1>
      <p className="muted">Who owes you, and what&apos;s come in.</p>
      <div className="spacer" />

      <div className="card">
        <div className="row">
          <div>
            <p className="muted">Outstanding</p>
            <p className="stat">£{outstandingTotal}</p>
            <p className="muted" style={{ fontSize: 12 }}>
              {(unpaid ?? []).length} unpaid
            </p>
          </div>
          <div>
            <p className="muted">Paid this week</p>
            <p className="stat">£{paidWeekTotal}</p>
          </div>
        </div>
      </div>

      <div className="spacer" />
      <h2>Unpaid</h2>
      <UnpaidList jobs={unpaid ?? []} />

      <div className="spacer" />
      <h2>Accounts</h2>
      <AccountsExport />

      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
