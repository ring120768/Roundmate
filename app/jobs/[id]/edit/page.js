import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JobForm from "@/components/JobForm";

export default async function EditJobPage({ params }) {
  const { id } = params;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) notFound();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, postcode, default_price")
    .order("first_name", { ascending: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("businesses(trade)")
    .eq("id", user.id)
    .single();
  const trade = profile?.businesses?.trade ?? null;

  return (
    <div className="container">
      <h1>Edit job</h1>
      <div className="spacer" />
      <JobForm customers={customers ?? []} initial={job} jobId={id} trade={trade} />
    </div>
  );
}
