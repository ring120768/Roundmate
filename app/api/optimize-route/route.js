import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Orders a day's jobs into an efficient driving route.
// Primary: Google Routes API computeRoutes with optimizeWaypointOrder
// (needs GOOGLE_MAPS_API_KEY in env; Pro SKU, 5k free calls/month).
// Fallback: nearest-neighbour + 2-opt on straight-line distance — free,
// instant, and within a few percent for a local round.

const toRad = (d) => (d * Math.PI) / 180;
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Nearest-neighbour tour from stop 0, then 2-opt until no improvement.
function heuristicOrder(stops) {
  const n = stops.length;
  if (n <= 2) return stops.map((_, i) => i);

  const d = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => haversineKm(stops[i], stops[j]))
  );

  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  while (tour.length < n) {
    const last = tour[tour.length - 1];
    let best = -1;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && (best === -1 || d[last][j] < d[last][best])) best = j;
    }
    tour.push(best);
    visited[best] = true;
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const a = tour[i - 1], b = tour[i], c = tour[k], e = tour[k + 1];
        const before = d[a][b] + (e !== undefined ? d[c][e] : 0);
        const after = d[a][c] + (e !== undefined ? d[b][e] : 0);
        if (after < before - 1e-9) {
          tour.splice(i, k - i + 1, ...tour.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return tour;
}

async function googleOrder(stops, apiKey) {
  // Loop route: start and end at the first job, optimise everything between.
  const origin = {
    location: { latLng: { latitude: stops[0].lat, longitude: stops[0].lng } },
  };
  const intermediates = stops.slice(1).map((s) => ({
    location: { latLng: { latitude: s.lat, longitude: s.lng } },
  }));

  const res = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin,
        destination: origin,
        intermediates,
        travelMode: "DRIVE",
        optimizeWaypointOrder: true,
      }),
    }
  );
  if (!res.ok) throw new Error(`Routes API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const route = json.routes?.[0];
  const order = route?.optimizedIntermediateWaypointIndex;
  if (!order) throw new Error("No optimised order returned");
  return {
    order: [0, ...order.map((i) => i + 1)],
    distanceMeters: route.distanceMeters ?? null,
    duration: route.duration ?? null,
  };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { date } = body || {};
  if (!date) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, service_type, price, start_time, customers(id, first_name, last_name, address_line_1, town_city, postcode, latitude, longitude)"
    )
    .eq("appointment_date", date)
    .eq("status", "scheduled");

  const all = jobs ?? [];
  const stops = [];
  const skipped = [];
  for (const j of all) {
    const c = j.customers;
    if (c?.latitude != null && c?.longitude != null) {
      stops.push({
        jobId: j.id,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        address: [c.address_line_1, c.town_city, c.postcode]
          .filter(Boolean)
          .join(", "),
        service: j.service_type,
        price: j.price,
        startTime: j.start_time,
        lat: c.latitude,
        lng: c.longitude,
      });
    } else {
      skipped.push({
        jobId: j.id,
        name: `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Job",
        reason: "no location for this customer's postcode",
      });
    }
  }

  if (stops.length < 2) {
    return NextResponse.json({
      stops,
      skipped,
      method: "none",
      note: "Need at least two located jobs to order a route.",
    });
  }

  // Google can optimise up to 25 intermediates (26 stops here). Beyond that,
  // fall back to the heuristic which has no limit.
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  let order, method = "heuristic", distanceMeters = null, duration = null;
  if (apiKey && stops.length <= 26) {
    try {
      const g = await googleOrder(stops, apiKey);
      order = g.order;
      distanceMeters = g.distanceMeters;
      duration = g.duration;
      method = "google";
    } catch {
      order = heuristicOrder(stops);
    }
  } else {
    order = heuristicOrder(stops);
  }

  return NextResponse.json({
    stops: order.map((i) => stops[i]),
    skipped,
    method,
    distanceMeters,
    duration,
  });
}
