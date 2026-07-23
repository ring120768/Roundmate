"""
Social + Email Harvester - visits each business website from
tradesman_directory.csv and extracts published emails + social links.
Writes tradesman_directory_enriched.csv
"""

import csv
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

INPUT_FILE = "tradesman_directory.csv"
OUTPUT_FILE = "tradesman_directory_enriched.csv"
TIMEOUT = 12
DELAY = 0.3

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

SOCIALS = {
    "facebook": re.compile(r"https?://(?:www\.)?facebook\.com/[^\s\"'<>)]+", re.I),
    "instagram": re.compile(r"https?://(?:www\.)?instagram\.com/[^\s\"'<>)]+", re.I),
    "tiktok": re.compile(r"https?://(?:www\.)?tiktok\.com/[^\s\"'<>)]+", re.I),
    "twitter_x": re.compile(r"https?://(?:www\.)?(?:twitter|x)\.com/[^\s\"'<>)]+", re.I),
    "linkedin": re.compile(r"https?://(?:www\.)?linkedin\.com/[^\s\"'<>)]+", re.I),
    "youtube": re.compile(r"https?://(?:www\.)?(?:youtube\.com|youtu\.be)/[^\s\"'<>)]+", re.I),
}
BAD_SOCIAL = ("sharer", "share.php", "/share", "intent/", "/plugins", "login", "/tr?", "pixel")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
BAD_EMAIL_ENDS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js")
BAD_EMAIL_WORDS = ("sentry", "wixpress", "example", "yourdomain", "domain.com", "email.com")
CONTACT_RE = re.compile(r"href=[\"']([^\"']*contact[^\"']*)[\"']", re.I)


def fetch(url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=CTX) as r:
            return r.read(600000).decode("utf-8", "ignore")
    except Exception:
        return ""


def pick_social(html, pattern):
    for m in pattern.findall(html):
        low = m.lower()
        skip = False
        for bad in BAD_SOCIAL:
            if bad in low:
                skip = True
                break
        if not skip:
            return m.rstrip("/.,")
    return ""


def pick_emails(html):
    out = []
    for e in EMAIL_RE.findall(html):
        low = e.lower().rstrip(".")
        if low.endswith(BAD_EMAIL_ENDS):
            continue
        bad = False
        for w in BAD_EMAIL_WORDS:
            if w in low:
                bad = True
                break
        if not bad and low not in out:
            out.append(low)
    return out[:3]


def main():
    with open(INPUT_FILE, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    total = len(rows)
    print(f"Loaded {total} businesses. Visiting websites...")

    new_cols = ["email", "email_2", "facebook", "instagram", "tiktok",
                "twitter_x", "linkedin", "youtube"]

    done = 0
    hits_email = 0
    hits_social = 0
    for row in rows:
        for c in new_cols:
            row[c] = ""
        site = (row.get("website") or "").strip()
        done += 1
        if not site:
            continue
        if "facebook.com" in site.lower():
            row["facebook"] = site
            hits_social += 1
            continue
        if not site.lower().startswith("http"):
            site = "https://" + site
        html = fetch(site)
        if html:
            m = CONTACT_RE.search(html)
            if m:
                contact_url = urllib.parse.urljoin(site, m.group(1))
                html = html + fetch(contact_url)
            emails = pick_emails(html)
            if emails:
                row["email"] = emails[0]
                if len(emails) > 1:
                    row["email_2"] = emails[1]
                hits_email += 1
            got_social = False
            for name, pattern in SOCIALS.items():
                link = pick_social(html, pattern)
                if link:
                    row[name] = link
                    got_social = True
            if got_social:
                hits_social += 1
        if done % 25 == 0:
            print(f"  {done}/{total} visited - emails: {hits_email}, with socials: {hits_social}")
        time.sleep(DELAY)

    fieldnames = list(rows[0].keys())
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"\nDone. Saved {OUTPUT_FILE}")
    print(f"  businesses with email found:  {hits_email}")
    print(f"  businesses with social links: {hits_social}")


if __name__ == "__main__":
    main()
