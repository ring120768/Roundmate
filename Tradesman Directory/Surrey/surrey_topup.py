"""
Surrey top-up - adds locksmith + pest control to surrey_directory.csv
"""
import csv, json, sys, time, urllib.parse, urllib.request

API_KEY = "AIzaSyAdsqfDwwpIwWOKz1cIo4dok99inYP6KP0"
CATEGORIES = ["locksmith", "pest control"]
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
FILE = "surrey_directory.csv"
BASE = "https://maps.googleapis.com/maps/api/place"

def api_get(url):
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt == 2:
                print(f"    WARN: {e}", file=sys.stderr); return {}
            time.sleep(2)

def text_search(query):
    results = []
    url = f"{BASE}/textsearch/json?" + urllib.parse.urlencode({"query": query, "region": "gb", "key": API_KEY})
    for _ in range(3):
        data = api_get(url)
        st = data.get("status", "UNKNOWN")
        if st == "ZERO_RESULTS": break
        if st != "OK":
            print(f"    WARN: {st}", file=sys.stderr); break
        results.extend(data.get("results", []))
        token = data.get("next_page_token")
        if not token: break
        time.sleep(2)
        url = f"{BASE}/textsearch/json?" + urllib.parse.urlencode({"pagetoken": token, "key": API_KEY})
    return results

def details(pid):
    url = f"{BASE}/details/json?" + urllib.parse.urlencode({"place_id": pid, "fields": "name,formatted_phone_number,international_phone_number,website,url", "key": API_KEY})
    d = api_get(url)
    return d.get("result", {}) if d.get("status") == "OK" else {}

def postcode_area(a):
    import re
    m = re.search(r"\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b", a or "")
    return m.group(1) if m else ""

# load existing
existing = list(csv.DictReader(open(FILE, encoding="utf-8")))
have = {r["place_id"] for r in existing}
fieldnames = list(existing[0].keys())
print(f"Existing: {len(existing)} businesses. Searching {len(CATEGORIES)} new trades...")

new = {}
n = 0
for town in TOWNS:
    for cat in CATEGORIES:
        n += 1
        print(f"[{n}] {cat} in {town}")
        for r in text_search(f"{cat} in {town}, UK"):
            pid = r.get("place_id")
            if not pid or pid in have or pid in new: continue
            new[pid] = {
                "place_id": pid, "business_name": r.get("name",""), "category": cat,
                "address": r.get("formatted_address",""), "postcode_area": postcode_area(r.get("formatted_address")),
                "town_searched": town, "rating": r.get("rating",""), "review_count": r.get("user_ratings_total",""),
                "business_status": r.get("business_status",""), "phone":"", "phone_intl":"", "website":"", "google_maps_url":"",
            }
        time.sleep(0.15)

print(f"\n{len(new)} new businesses. Fetching phone/website...")
for i,(pid,row) in enumerate(new.items(),1):
    d = details(pid)
    row["phone"] = d.get("formatted_phone_number","")
    row["phone_intl"] = d.get("international_phone_number","")
    row["website"] = d.get("website","")
    row["google_maps_url"] = d.get("url","")
    if i % 25 == 0 or i == len(new): print(f"  {i}/{len(new)}")
    time.sleep(0.15)

allrows = existing + list(new.values())
with open(FILE, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames); w.writeheader(); w.writerows(allrows)
print(f"\nDone. {FILE} now has {len(allrows)} businesses (+{len(new)} new).")
