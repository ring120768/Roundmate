import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Calendar from "@/components/Calendar";
import Brand from "@/components/Brand";

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="container">
      <Brand variant="bar" />
      <h1>Calendar</h1>
      <div className="spacer" />
      <Calendar />
      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
