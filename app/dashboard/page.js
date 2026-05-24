import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

// The signed-in home screen. For now it just proves the whole chain works:
// we read the user's business back out of the database (under RLS) and show it.
// Real "Today's jobs" content comes in Phase 2.
export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, business_id, businesses(name)")
    .eq("id", user.id)
    .single();

  if (!profile?.business_id) {
    redirect("/onboarding");
  }

  const businessName = profile.businesses?.name ?? "your business";
  const firstName = (profile.full_name || "").split(" ")[0];

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 20 }}>
        <div>
          <h1>Today</h1>
          <p className="muted">
            {firstName ? `Hi ${firstName} — ` : ""}
            {businessName}
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Jobs today</h2>
        <p className="stat">0</p>
        <p className="muted">No jobs yet. Adding customers and jobs is next.</p>
      </div>

      <div className="spacer" />

      <div className="card">
        <h2>Money</h2>
        <div className="row">
          <div>
            <p className="muted">Paid this week</p>
            <p className="stat">£0</p>
          </div>
          <div>
            <p className="muted">Unpaid</p>
            <p className="stat">£0</p>
          </div>
        </div>
      </div>

      <Link href="/customers">
        <button type="button">Customers</button>
      </Link>

      <SignOutButton />
    </div>
  );
}
