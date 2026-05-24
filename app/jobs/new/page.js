import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JobForm from "@/components/JobForm";

export default async function NewJobPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, postcode, default_price")
    .order("first_name", { ascending: true });

  const preselect = searchParams?.customer ?? "";
  const preselectDate = searchParams?.date ?? "";

  return (
    <div className="container">
      <h1>Add job</h1>
      <div className="spacer" />
      <JobForm
        customers={customers ?? []}
        preselectedCustomerId={preselect}
        preselectedDate={preselectDate}
      />
    </div>
  );
}
