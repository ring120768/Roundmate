import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerForm from "@/components/CustomerForm";

export default async function EditCustomerPage({ params }) {
  const { id } = params;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!c) notFound();

  return (
    <div className="container">
      <h1>Edit customer</h1>
      <div className="spacer" />
      <CustomerForm initial={c} customerId={id} />
    </div>
  );
}
