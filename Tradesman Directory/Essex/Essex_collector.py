"""
UK Home-Services Tradesman Collector
------------------------------------
Sweeps Google Places API town-by-town for home-visit trade categories,
dedupes by place_id, fetches phone + website for each business,
and writes everything to a CSV.
"""

import csv
import json
import sys
import time
import urllib.parse
import urllib.request

# ---------------------------------------------------------------- CONFIG ---

API_KEY = "AIzaSyAdsqfDwwpIwWOKz1cIo4dok99inYP6KP0"

# The trade categories we search for in every town.
CATEGORIES = [
    "window cleaner",
    "gardener",
    "garden maintenance",
    "mobile car valeting",
    "ironing service",
    "domestic cleaner",
    "house cleaning service",
    "oven cleaning service",
]

# Towns to sweep - Essex pilot (towns + large villages, ceremonial Essex).
TOWNS = [
    "Basildon", "Billericay", "Braintree", "Brentwood", "Brightlingsea",
    "Buckhurst Hill", "Burnham-on-Crouch", "Canvey Island", "Chelmsford",
    "Chigwell", "Clacton-on-Sea", "Coggeshall", "Colchester", "Corringham",
    "Danbury", "Epping", "Frinton-on-Sea", "Grays", "Great Baddow",
    "Great Dunmow", "Halstead", "Harlow", "Harwich", "Hockley", "Hullbridge",
    "Ingatestone", "Kelvedon", "Laindon", "Leigh-on-Sea", "Loughton",
    "Maldon", "Manningtree", "Ongar", "Rayleigh", "Rochford",
    "Saffron Walden", "Shoeburyness", "South Benfleet",
    "South Woodham Ferrers", "Southend-on-Sea", "Southminster",
    "Stanford-le-Hope", "Stansted Mountfitchet", "Tilbury", "Tiptree",
    "Waltham Abbey", "Walton-on-the-Naze", "West Mersea",
    "Westcliff-on-Sea", "Wickford", "Witham", "Wivenhoe",
]

OUTPUT_FILE = "tradesman_directory.csv"
REQUEST_DELAY = 0.15   # seconds between API calls (polite rate limiting)
PAGE_DELAY = 2.0       # Google requires ~2s before a next_page_token works

# --------------------------------------------------------------- HELPERS ---

BASE = "https://maps.googleapis.com/maps/api/place"


def api_get(url):
    """GET a URL, return parsed JSON. Retries once on transient errors."""
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt == 2:
                print(f"    WARN: request failed twice: {e}", file=sys.stderr)
                return {}
            time.sleep(2)


def text_search(query):
    """Run a Text Search, following pagination (max 3 pages / 60 results)."""
    results = []
    params = {"query": query, "region": "gb", "key": API_KEY}
    url = f"{BASE}/textsearch/json?{urllib.parse.urlencode(params)}"
    for _ in range(3):  # max 3 pages
        data = api_get(url)
        status = data.get("status", "UNKNOWN")
        if status == "ZERO_RESULTS":
            break
        if status not in ("OK",):
            print(f"    WARN: API status {status}: {data.get('error_message','')}",
                  file=sys.stderr)
            break
        results.extend(data.get("results", []))
        token = data.get("next_page_token")
        if not token:
            break
        time.sleep(PAGE_DELAY)
        url = f"{BASE}/textsearch/json?{urllib.parse.urlencode({'pagetoken': token, 'key': API_KEY})}"
    return results


def place_details(place_id):
    """Fetch phone + website for one place."""
    fields = "name,formatted_phone_number,international_phone_number,website,url"
    params = {"place_id": place_id, "fields": fields, "key": API_KEY}
    url = f"{BASE}/details/json?{urllib.parse.urlencode(params)}"
    data = api_get(url)
    return data.get("result", {}) if data.get("status") == "OK" else {}


def postcode_area(address):
    """Pull the outward postcode (e.g. GU1) from a UK address if present."""
    import re
    m = re.search(r"\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b", address or "")
    return m.group(1) if m else ""


# ------------------------------------------------------------------ MAIN ---

def main():
    if not TOWNS:
        sys.exit("TOWNS list is empty - ask Claude to fill it for your county.")

    seen = {}          # place_id -> row dict
    search_count = 0

    print(f"Sweeping {len(TOWNS)} towns x {len(CATEGORIES)} categories...")

    for town in TOWNS:
        for cat in CATEGORIES:
            query = f"{cat} in {town}, UK"
            search_count += 1
            print(f"[{search_count}] {query}")
            for r in text_search(query):
                pid = r.get("place_id")
                if not pid or pid in seen:
                    continue
                seen[pid] = {
                    "place_id": pid,
                    "business_name": r.get("name", ""),
                    "category": cat,
                    "address": r.get("formatted_address", ""),
                    "postcode_area": postcode_area(r.get("formatted_address")),
                    "town_searched": town,
                    "rating": r.get("rating", ""),
                    "review_count": r.get("user_ratings_total", ""),
                    "business_status": r.get("business_status", ""),
                    "phone": "",
                    "phone_intl": "",
                    "website": "",
                    "google_maps_url": "",
                }
            time.sleep(REQUEST_DELAY)

    print(f"\nFound {len(seen)} unique businesses. Fetching phone/website...")

    for i, (pid, row) in enumerate(seen.items(), 1):
        det = place_details(pid)
        row["phone"] = det.get("formatted_phone_number", "")
        row["phone_intl"] = det.get("international_phone_number", "")
        row["website"] = det.get("website", "")
        row["google_maps_url"] = det.get("url", "")
        if i % 25 == 0 or i == len(seen):
            print(f"  details {i}/{len(seen)}")
        time.sleep(REQUEST_DELAY)

    fieldnames = list(next(iter(seen.values())).keys()) if seen else []
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(seen.values())

    with_phone = sum(1 for r in seen.values() if r["phone"])
    with_site = sum(1 for r in seen.values() if r["website"])
    print(f"\nDone. {len(seen)} businesses -> {OUTPUT_FILE}")
    print(f"  with phone:   {with_phone}")
    print(f"  with website: {with_site}")
    print(f"  searches used: {search_count} text searches, {len(seen)} detail calls")


if __name__ == "__main__":
    main()
