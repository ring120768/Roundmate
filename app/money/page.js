import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PAID_STATUSES } from "@/lib/jobOptions";
import UnpaidList from "@/components/UnpaidList";
import AccountsExport from "@/components/AccountsExport";
import { gbp, daysSince } from "@/lib/money";

export default async function MoneyPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "business_id, businesses(accountant_name, accountant_email)"
    )
    .eq("id", user.id)
    .single();
  if (!profile?.business_id) redirect("/onboarding");

  // Outstanding: jobs that are done but not paid.
  const { data: unpaid } = await supabase
    .from("jobs")
    .select(
      "id, appointment_date, completed_at, service_type, price, reminder_count, customers(first_name, last_name, postcode)"
    )
    .eq("status", "completed")
    .eq("payment_status", "unpaid")
    .order("appointment_date", { ascending: true });

  const outstandingTotal = (unpaid ?? []).reduce(
    (sum, j) => sum + (j.price ? Number(j.price) : 0),
    0
  );

  // Anything unpaid a fortnight after completion is the stuff worth a phone
  // call — the email chaser has already had its three goes by then.
  const badlyOverdue = (unpaid ?? []).filter(
    (j) => (daysSince(j.completed_at) ?? 0) >= 14
  ).length;

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
            <p className="stat">{gbp(outstandingTotal)}</p>
            <p className="muted" style={{ fontSize: 12 }}>
              {(unpaid ?? []).length} unpaid
              {badlyOverdue > 0 ? ` · ${badlyOverdue} over 14 days` : ""}
            </p>
          </div>
          <div>
            <p className="muted">Paid this week</p>
            <p className="stat">{gbp(paidWeekTotal)}</p>
          </div>
        </div>
      </div>

      <div className="spacer" />
      <h2>Unpaid</h2>
      <UnpaidList jobs={unpaid ?? []} />

      <div className="spacer" />
      <h2>Accounts</h2>
      <AccountsExport
        accountant={{
          name: profile.businesses?.accountant_name,
          email: profile.businesses?.accountant_email,
        }}
      />

      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
