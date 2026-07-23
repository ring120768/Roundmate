"""
UK Home-Services Tradesman Collector - SURREY
"""

import csv
import json
import sys
import time
import urllib.parse
import urllib.request

API_KEY = "AIzaSyAdsqfDwwpIwWOKz1cIo4dok99inYP6KP0"

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

# Surrey pilot - towns + large villages (ceremonial Surrey).
TOWNS = [
    "Guildford", "Woking", "Farnham", "Camberley", "Staines-upon-Thames",
    "Epsom", "Ewell", "Leatherhead", "Dorking", "Reigate", "Redhill",
    "Horley", "Godalming", "Haslemere", "Cranleigh", "Cobham", "Esher",
    "Weybridge", "Walton-on-Thames", "West Molesey", "East Molesey",
    "Ashford", "Sunbury-on-Thames", "Egham", "Virginia Water", "Chertsey",
    "Addlestone", "Byfleet", "West Byfleet", "Ottershaw", "Bagshot",
    "Lightwater", "Windlesham", "Frimley", "Ash", "Ash Vale", "Tongham",
    "Caterham", "Warlingham", "Oxted", "Lingfield", "Banstead", "Tadworth",
    "Ashtead", "Bookham", "Ripley", "Send", "Chobham", "Knaphill",
    "Merstham", "Hersham", "Claygate", "Thames Ditton", "Godstone",
    "Nutfield", "Bramley", "Shere", "Ewhurst",
]

OUTPUT_FILE = "surrey_directory.csv"
REQUEST_DELAY = 0.15
PAGE_DELAY = 2.0

BASE = "https://maps.googleapis.com/maps/api/place"


def api_get(url):
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
    results = []
    params = {"query": query, "region": "gb", "key": API_KEY}
    url = f"{BASE}/textsearch/json?{urllib.parse.urlencode(params)}"
    for _ in range(3):
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
    fields = "name,formatted_phone_number,international_phone_number,website,url"
    params = {"place_id": place_id, "fields": fields, "key": API_KEY}
    url = f"{BASE}/details/json?{urllib.parse.urlencode(params)}"
    data = api_get(url)
    return data.get("result", {}) if data.get("status") == "OK" else {}


def postcode_area(address):
    import re
    m = re.search(r"\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b", address or "")
    return m.group(1) if m else ""


def main():
    seen = {}
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


if __name__ == "__main__":
    main()
