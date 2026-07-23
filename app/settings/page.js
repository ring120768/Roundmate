import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Brand from "@/components/Brand";
import SettingsForm from "@/components/SettingsForm";
import { tradeLabel, tradeImage } from "@/lib/trades";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, businesses(id, name, owner_name, phone, trade)")
    .eq("id", user.id)
    .single();
  if (!profile?.business_id) redirect("/onboarding");

  return (
    <div className="container">
      <Brand variant="bar" image={tradeImage(profile.businesses?.trade)} />
      <h1>Settings</h1>
      <p className="muted">Your business details.</p>
      <div className="spacer" />
      <SettingsForm business={profile.businesses} userId={user.id} />

      <div className="spacer" />
      <Link href="/trade">
        <button type="button" className="secondary">
          Change trade — currently {tradeLabel(profile.businesses?.trade) || "not set"}
        </button>
      </Link>
    </div>
  );
}
