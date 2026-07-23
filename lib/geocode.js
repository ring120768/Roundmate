// UK postcode -> lat/lng via postcodes.io (free, open data, no key).
// Postcode-centroid accuracy — plenty for ordering a round; turn-by-turn
// navigation gets the full address anyway.

// One postcode. Returns { latitude, longitude } or null. Never throws.
export async function geocodePostcode(postcode) {
  if (!postcode || !postcode.trim()) return null;
  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.result) return null;
    return { latitude: json.result.latitude, longitude: json.result.longitude };
  } catch {
    return null;
  }
}

// Many postcodes (bulk, 100 per request). Returns a Map of
// UPPERCASED-no-space postcode -> { latitude, longitude }. Never throws.
export async function geocodePostcodes(postcodes) {
  const map = new Map();
  const unique = [...new Set(postcodes.filter(Boolean).map((p) => p.trim()))];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const res = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: chunk }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      (json.result || []).forEach((r) => {
        if (r.result) {
          map.set(r.query.replace(/\s+/g, "").toUpperCase(), {
            latitude: r.result.latitude,
            longitude: r.result.longitude,
          });
        }
      });
    } catch {
      /* skip chunk */
    }
  }
  return map;
}

export const normalisePostcode = (p) =>
  (p || "").replace(/\s+/g, "").toUpperCase();
