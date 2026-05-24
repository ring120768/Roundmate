import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerList from "@/components/CustomerList";

// Reads this business's customers (RLS scopes it automatically) and hands
// them to the searchable list component.
export default async function CustomersPage() {
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

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("first_name", { ascending: true });

  return (
    <div className="container">
      <CustomerList customers={customers ?? []} />
    </div>
  );
}
