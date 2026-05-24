import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompleteJobForm from "@/components/CompleteJobForm";

export default async function CompleteJobPage({ params }) {
  const { id } = params;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select("*, customers(id, first_name, last_name, visit_frequency)")
    .eq("id", id)
    .single();
  if (!job) notFound();

  const cust = job.customers;

  return (
    <div className="container">
      <h1>Complete job</h1>
      <p className="muted">
        {cust ? `${cust.first_name} ${cust.last_name}` : ""} · {job.service_type}
      </p>
      <div className="spacer" />
      <CompleteJobForm job={job} />
    </div>
  );
}
