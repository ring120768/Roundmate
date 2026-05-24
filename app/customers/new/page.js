import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerForm from "@/components/CustomerForm";

export default async function NewCustomerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="container">
      <h1>Add customer</h1>
      <div className="spacer" />
      <CustomerForm />
    </div>
  );
}
