"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// The outward part of a UK postcode ("CM24 8NR" -> "CM24").
function outward(pc) {
  if (!pc) return "No postcode";
  const clean = pc.replace(/\s+/g, "").toUpperCase();
  return clean.length > 3 ? clean.slice(0, -3) : clean;
}

// Searchable, groupable customer list. Filtering and grouping happen in the
// browser over the loaded list — plenty fast for a typical round.
export default function CustomerList({ customers }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [view, setView] = useState("name"); // "name" | "area"

  const term = q.trim().toLowerCase();
  const filtered = term
    ? customers.filter((c) => {
        const hay = `${c.first_name ?? ""} ${c.last_name ?? ""} ${
          c.postcode ?? ""
        } ${c.address_line_1 ?? ""} ${c.town_city ?? ""}`.toLowerCase();
        return hay.includes(term);
      })
    : customers;

  // Group into sections: A–Z initials (by name) or postcode districts (by area).
  const groups = {};
  filtered.forEach((c) => {
    const key =
      view === "name"
        ? (c.first_name?.[0] || c.last_name?.[0] || "#").toUpperCase()
        : outward(c.postcode);
    (groups[key] = groups[key] || []).push(c);
  });
  const keys = Object.keys(groups).sort();
  keys.forEach((k) =>
    groups[k].sort((a, b) =>
      view === "area"
        ? (a.postcode || "").localeCompare(b.postcode || "") ||
          (a.first_name || "").localeCompare(b.first_name || "")
        : (a.first_name || "").localeCompare(b.first_name || "")
    )
  );

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Customers</h1>
        <span className="muted">{customers.length}</span>
      </div>

      <input
        type="search"
        placeholder="Search name, street or postcode"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className={view === "name" ? "" : "secondary"}
          style={{ marginTop: 0 }}
          onClick={() => setView("name")}
        >
          A–Z by name
        </button>
        <button
          type="button"
          className={view === "area" ? "" : "secondary"}
          style={{ marginTop: 0 }}
          onClick={() => setView("area")}
        >
          By area
        </button>
      </div>

      <button type="button" onClick={() => router.push("/customers/new")}>
        + Add customer
      </button>

      <button
        type="button"
        className="secondary"
        onClick={() => router.push("/customers/import")}
      >
        Import customers
      </button>

      <div className="spacer" />

      {keys.length > 1 && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "8px 2px",
            marginBottom: 4,
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 10,
          }}
        >
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              className="secondary"
              style={{
                width: "auto",
                marginTop: 0,
                padding: "6px 12px",
                fontSize: 13,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              onClick={() =>
                document
                  .getElementById(`sec-${k}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="muted">
          {customers.length === 0
            ? "No customers yet. Add your first one above."
            : "No matches."}
        </p>
      ) : (
        keys.map((k) => (
          <div key={k} id={`sec-${k}`} style={{ scrollMarginTop: 56 }}>
            <h2 style={{ marginTop: 18, marginBottom: 8 }}>
              {k}{" "}
              <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>
                {view === "area" && groups[k][0]?.town_city
                  ? `· ${groups[k][0].town_city} `
                  : ""}
                ({groups[k].length})
              </span>
            </h2>
            {groups[k].map((c) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card" style={{ marginBottom: 10 }}>
                  <div className="row">
                    <div>
                      <strong>
                        {c.first_name} {c.last_name}
                      </strong>
                      <div className="muted">
                        {[c.address_line_1, c.postcode]
                          .filter(Boolean)
                          .join(" · ") || "No address"}
                      </div>
                    </div>
                    <div className="muted">
                      {c.default_price != null ? `£${c.default_price}` : ""}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))
      )}

      <Link href="/dashboard" className="linklike">
        ← Back to dashboard
      </Link>
    </div>
  );
}
