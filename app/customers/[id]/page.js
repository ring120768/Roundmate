import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

export default async function CustomerDetailPage({ params }) {
  const { id } = params;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!c) notFound();

  const fullAddress = [c.address_line_1, c.town_city, c.postcode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="container">
      <h1>
        {c.first_name} {c.last_name}
      </h1>
      <div className="spacer" />

      <div className="card">
        <Field label="Address" value={fullAddress} />
        <Field label="Phone" value={c.phone} />
        <Field label="Email" value={c.email} />
        <Field
          label="Default price"
          value={c.default_price != null ? `£${c.default_price}` : null}
        />
        <Field label="Visit frequency" value={c.visit_frequency} />
        <Field label="Access notes" value={c.access_notes} />
      </div>

      <Link href={`/customers/${id}/edit`}>
        <button type="button">Edit</button>
      </Link>

      <Link href="/customers" className="linklike">
        ← Back to customers
      </Link>
    </div>
  );
}
