"use client";

import { useState } from "react";

// "Order my route" for a chosen day: calls the optimiser, shows the stops
// in driving order with a Navigate button per stop (works with whatever
// maps app the phone uses) and an optional open-in-Google-Maps route link.
export default function RouteOptimizer({ date }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function optimise() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't order the route");
      setResult(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const navUrl = (stop) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      stop.address || `${stop.lat},${stop.lng}`
    )}&travelmode=driving&dir_action=navigate`;

  // Multi-stop Google Maps link for the first 10 stops (the app's limit).
  const routeUrl = (stops) => {
    const pts = stops.slice(0, 10).map((s) =>
      encodeURIComponent(s.address || `${s.lat},${s.lng}`)
    );
    return `https://www.google.com/maps/dir/${pts.join("/")}`;
  };

  const mins = (dur) => {
    const s = parseInt(String(dur || "").replace("s", ""), 10);
    return isNaN(s) ? null : Math.round(s / 60);
  };

  return (
    <div className="card">
      <p style={{ marginBottom: 4 }}>
        <strong>Order my route</strong>
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        Puts the day&apos;s jobs in an efficient driving order, starting from
        your first job.
      </p>
      <button type="button" onClick={optimise} disabled={loading}>
        {loading ? "Working it out…" : "Order my route"}
      </button>
      {error && <p className="error">{error}</p>}

      {result && result.stops.length >= 2 && (
        <>
          <div className="spacer" />
          <p className="muted" style={{ fontSize: 13 }}>
            {result.method === "google"
              ? `Ordered with live road data${
                  result.distanceMeters
                    ? ` — ${(result.distanceMeters / 1609).toFixed(1)} miles`
                    : ""
                }${
                  mins(result.duration) ? `, about ${mins(result.duration)} min driving` : ""
                }.`
              : "Ordered by distance."}
          </p>
          {result.stops.map((s, i) => (
            <div key={s.jobId} className="row" style={{ marginBottom: 10, alignItems: "center" }}>
              <div>
                <strong>
                  {i + 1}. {s.name}
                </strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {s.startTime ? `${s.startTime.slice(0, 5)} · ` : ""}
                  {s.address}
                </div>
              </div>
              <a href={navUrl(s)} target="_blank" rel="noreferrer">
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "auto", marginTop: 0, padding: "8px 14px" }}
                >
                  Navigate
                </button>
              </a>
            </div>
          ))}
          <a href={routeUrl(result.stops)} target="_blank" rel="noreferrer" className="linklike">
            Open route in Google Maps{result.stops.length > 10 ? " (first 10 stops)" : ""} →
          </a>
          {result.skipped?.length > 0 && (
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
              Not included: {result.skipped.map((s) => s.name).join(", ")} —
              check their postcodes.
            </p>
          )}
        </>
      )}
      {result && result.stops.length < 2 && (
        <p className="muted" style={{ marginTop: 10 }}>
          {result.note || "Not enough located jobs on this day to order."}
        </p>
      )}
    </div>
  );
}
