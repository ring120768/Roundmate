# RoundMate — Integration Brief
### Customer acquisition + the two-app model, *without disturbing the current build*

*Hand this to whoever is building RoundMate. The headline: keep building.
What follows is additive and staged — nothing existing gets refactored.*

---

## TL;DR (read this if nothing else)

We're adding a **consumer-facing app** that sends RoundMate new work *and* new
tradespeople. It's a **separate app** that shares RoundMate's **existing
Supabase database**. Impact on the current build: **minimal and additive** —
two new tables and a couple of nullable columns. Nothing to rip out, no
behaviour changes to existing flows. The trade app keeps shipping on its current
roadmap the whole time.

---

## 1. Where new customers (and tradespeople) come from

We've built a directory of ~11,500 UK home-service businesses (London +
Essex/Surrey, nine trades — the same nine RoundMate serves). It quietly does
**two jobs at once**:

- **Consumer inventory** — homeowners search it, pick a trade, and book.
- **Tradesperson acquisition list** — those businesses *are* RoundMate's ideal
  users.

The loop: a homeowner books a tradesperson on the consumer app → that job needs
managing, invoicing, paying → RoundMate is the tool → the tradesperson onboards.
The consumer side feeds the trade side. (Reinforced by an opt-in campaign to
listed trades: *"customers can book you here — RoundMate runs the job."*)

## 2. Two apps, one database — the "blind date"

- **RoundMate (trade)** — what you're building now. *Unchanged.*
- **RoundMate (customer)** — new, separate repo / deploy / domain. Public
  directory + booking. Different brand tagline, mirrored look.
- They share the **one existing Supabase project** and meet at exactly **two
  points**:
  1. **Booking handoff** — the customer app writes a lead; RoundMate reads it as
     a new enquiry.
  2. **The claim** — a tradesperson claims a directory listing; it links to
     their `businesses` row.

Keeping the apps separate means a change on the public consumer side can never
knock over the app that runs Stripe payouts.

## 3. Impact on the current build — additive only

Nothing existing changes behaviour. The entire integration surface:

**New tables (they do not touch existing tables):**

- `directory_listings` — the public prospect pool: name, trade, phone, email,
  website, socials, region, postcode/lat-lng, `avg_rating`, `review_count`,
  `claimed_by` (nullable). **Public read, no public write.**
- `reviews` — booking-gated: `listing_id`, `job_id`, `rating`, `text`,
  `created_at`. Inserted server-side only.
- `booking_requests` — **one** table for all incoming requests: the premium
  booking-page feature *and* directory bookings share it, told apart by a
  `source` column (`'booking_page' | 'directory'`). Build the booking page
  first; the directory then plugs in for free — same dashboard badge, same
  confirm flow, same emails.

**New nullable columns (safe, reversible migrations):**

- `directory_listings.claimed_by` → `businesses.id` (nullable).

**RLS:**

- One new **public-read** policy on `directory_listings` only.
- Existing RLS on `businesses` / `jobs` / `customers` — **untouched.**
- `reviews` written via the service role after a completed booking.
- The consumer app writes `booking_requests` through its **own server route
  (service role), never the anon key** — so a wobble on the public side can
  never reach the payments app.

**Explicitly NOT touched:** the job / round / calendar / money flows, Stripe
Connect, Resend, auth, geocoding. **Zero refactor.**

## 4. The two touchpoints, concretely

- **Booking handoff** — the consumer app inserts one `booking_requests` row with
  `source='directory'`, via its own server route. It lands in the **same**
  confirm flow as the booking-page feature — same dashboard badge, same emails.
  No separate path to build.
- **The claim** — the tradesperson taps *"This is my business"* on a listing →
  set `directory_listings.claimed_by = their business_id`. One update. Optional
  for now; can land later.

## 5. Compliance — get this right before the consumer app launches

Most of the ~11,500 listed businesses are **sole traders**, who count as
**individuals** under UK GDPR and PECR. Two traps to design around:

- **Publishing scraped details** needs a lawful basis and an easy
  **"claim or remove my listing"** path on every listing.
- **Cold email** to the list is **not** covered by the B2B marketing exemption
  (that only covers limited companies). Safe opt-in routes are **phone, post, or
  a letter** driving them to opt in — not a cold-email blast.

Best sorted before launch, not after the first complaint. *Not legal advice —
worth a proper check as the consumer app nears launch.*

## 6. Sequencing (parallel, non-blocking)

1. **Now** — finish the directory data (in progress). *No code impact.*
2. **Small migration** — add the two tables + nullable columns. Reviewable,
   reversible.
3. **Consumer app** — built separately; reads `directory_listings`, writes
   leads. *Does not touch RoundMate's code.*
4. **Wire touchpoint #1** (surface directory leads) — small.
5. **Wire touchpoint #2** (the claim) — later.

RoundMate's current roadmap continues uninterrupted throughout.

---

## One-liner for the standup

> "We're bolting a consumer directory onto the side via new tables in the same
> Supabase — read-only to everything that already exists. Keep building; the
> only near-term ask is one small additive migration."
