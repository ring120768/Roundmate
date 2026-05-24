"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Searchable customer list. Filtering happens in the browser over the loaded
// list — plenty fast for a typical round, and dead simple.
export default function CustomerList({ customers }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const term = q.trim().toLowerCase();
  const filtered = term
    ? customers.filter((c) => {
        const hay = `${c.first_name ?? ""} ${c.last_name ?? ""} ${
          c.postcode ?? ""
        } ${c.address_line_1 ?? ""} ${c.town_city ?? ""}`.toLowerCase();
        return hay.includes(term);
      })
    : customers;

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Customers</h1>
        <span className="muted">{customers.length}</span>
      </div>

      <input
        type="search"
        placeholder="Search name or postcode"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <button type="button" onClick={() => router.push("/customers/new")}>
        + Add customer
      </button>

      <div className="spacer" />

      {filtered.length === 0 ? (
        <p className="muted">
          {customers.length === 0
            ? "No customers yet. Add your first one above."
            : "No matches."}
        </p>
      ) : (
        filtered.map((c) => (
          <Link
            key={c.id}
            href={`/customers/${c.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="row">
                <div>
                  <strong>
                    {c.first_name} {c.last_name}
                  </strong>
                  <div className="muted">{c.postcode || "No postcode"}</div>
                </div>
                <div className="muted">
                  {c.default_price != null ? `£${c.default_price}` : ""}
                </div>
              </div>
            </div>
          </Link>
        ))
      )}

      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
