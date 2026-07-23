import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Brand from "@/components/Brand";
import ChangeTradeForm from "@/components/ChangeTradeForm";

export default async function ChangeTradePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, businesses(id, trade)")
    .eq("id", user.id)
    .single();
  if (!profile?.business_id) redirect("/onboarding");

  return (
    <div className="container">
      <Brand variant="bar" />
      <h1>Change trade</h1>
      <p className="muted">Pick the trade your business works in.</p>
      <div className="spacer" />
      <ChangeTradeForm business={profile.businesses} />
    </div>
  );
}
