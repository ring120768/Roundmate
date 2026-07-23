import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Calendar from "@/components/Calendar";
import Brand from "@/components/Brand";
import { tradeImage } from "@/lib/trades";

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("businesses(trade)")
    .eq("id", user.id)
    .single();

  return (
    <div className="container">
      <Brand variant="bar" image={tradeImage(profile?.businesses?.trade)} />
      <h1>Calendar</h1>
      <div className="spacer" />
      <Calendar />
      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
