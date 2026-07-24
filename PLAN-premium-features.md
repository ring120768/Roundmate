# Premium Features Plan — Booking Requests & Accounting Connectors

*Researched and written 2026-07-22. Sources and detail in the research notes at the end. Both features are premium-tier candidates for the commercial launch (see ROADMAP.md, Commercial Launch Plan).*

---

## The headline findings

The market research came back unusually clear on both features.

**Booking:** every serious competitor splits customer booking into two products — a cheap or free "work request" form (customer describes the job, business confirms), and an expensive self-scheduling product (customer picks a slot, Calendly-style). Jobber gives request forms to every plan but charges 3× for self-scheduling; ServiceM8 gives the enquiry form free and sells slot-booking at $79/mo. Round-based UK products (Squeegee, getSoapy) don't lead with self-scheduling at all — because round work is geographic, not calendar-slotted. **Our request → confirm principle isn't just philosophically right, it's the industry pattern.** Our edge over Squeegee specifically: their portal requires the customer to register an account; ours never will.

**Accounting:** all four UK packages (Xero, QuickBooks, FreeAgent, Sage) offer OAuth APIs that can do exactly what we need — push a contact, an invoice, and a payment when jobs complete and get paid. One-way push (RoundMate → accounting) is all that's required and far simpler than sync. Aggregator APIs (Apideck at ~$599/mo, Codat at $12k+/yr) are ruled out on price; direct integrations are free. The surprise finding: **FreeAgent is the right first integration**, not Xero — it's free with NatWest/RBS/Mettle business accounts (exactly where sole-trader window cleaners bank), has the friendliest API approval, and generous limits. Xero second (biggest brand pull; 25 free connections before certification is needed). QuickBooks third (has an up-front review gate). Sage: skip.

---

## Feature 1 — Booking requests ("give your customers a link")

### The design (locked to our two-way, one-tap principle)

Each business gets a hosted request page: **roundmate.co.uk/r/business-handle**. On it: business name + pug branding, then a short form — name, address, postcode, phone/email, service (driven by the business's trade from `lib/trades.js`), optional note, optional preferred days. No prices shown, no calendar, no account, no app.

Submitting creates a **pending request** in the app. The tradesman sees it on his dashboard ("1 new request"), opens it, and has one decision: **Confirm** — pick the date (the app suggests days he's already in that postcode district, the Smart Rounds tie-in) — or **Decline** (with an optional courteous auto-reply). Confirming creates the customer (if new) and the job, and fires the existing confirmation email. The customer never sees his diary; the postcode field is what lets him slot the request into the right round day.

Distribution is where this wins accounts: the link goes in his **Google Business Profile** as a custom Book button (free, high-intent, ~10 min to set up — we'll include a how-to), his **WhatsApp Business** profile, a **QR code** we generate for the van and flyers, and the footer of every RoundMate email ("Need us again? Request a visit"). No website needed — which describes most of our market. An embeddable widget for the few with websites is a later add.

Security: the public request page needs no login and no token — it's lead capture (rate-limited, honeypot field, notification email). Tokenized magic links come later for *existing-customer* one-tap actions (confirm visit, pay): 128-bit random tokens, hashed in the DB, scoped to one customer + one action, and always landing on a page with a button rather than mutating on the link click itself (email scanners pre-fetch links — a GET must never confirm anything).

### Positioning + parameters (agreed 2026-07-24)

The headline edge, in Ringo's framing: **"we know geography, Calendly doesn't."** A tradesman's diary is a map with days attached, not a calendar of slots — so the confirm screen suggests dates from days he's already in that postcode district (Smart Rounds data), and a naive slot-picker can never torpedo a route day.

**Instant-confirm (later phase):** the tradesman can set parameters — postcode districts, days, services — and any request that fits inside them is auto-accepted and booked, firing the normal confirmation email. Uber-style immediacy, tradesman-defined boundaries. Off by default.

**Marketplace — someday, not now (agreed 2026-07-24):** a full two-sided marketplace (customer posts job, nearby tradesmen compete) is parked. It needs demand liquidity we don't have and flips us onto the customer's side against our own users. But if RoundMate wins as SaaS, the supply side comes free — "overflow jobs from the RoundMate network" becomes possible later from strength. The directory (below) is the staged version of this bet.

### Build phases

Phase A (the core, ~3–4 sessions): `booking_requests` table + business handle column; public request page (one new public route with its own minimal RLS-safe insert path); dashboard badge + request list; confirm flow (creates customer + job, sends confirmation); decline flow. Phase B (~1–2 sessions): QR code generator on the settings page; email-footer link; Google Business Profile setup guide. Phase C (later): tokenized one-tap links for existing customers (request-again, confirm-visit), which also power the agent/work-provider channel from the research doc.

### Tier placement

Follow Jobber's logic, adapted: put a *taste* of it in the base plan and the whole thing in premium — or simpler for launch, make it THE premium feature. Recommended: base £12/mo = the full admin loop; **premium ~£18–20/mo adds booking requests + accounting connector**. The pitch line writes itself: "your own booking page, no website needed."

---

## Feature 2 — Accounting connectors

### The approach: one-way push, one generic plumbing layer

When a job completes → push the invoice; when it's marked paid → push the payment; customers map to contacts (IDs remembered per connection). RoundMate stays the source of truth; nothing flows back. One `connections` table serves every provider (provider, tokens, expiry, external-ID mappings) with a pair of route handlers (`/api/connect/[provider]`, `/api/callback/[provider]`) and a token-refresh lock.

### Order of build

**Stage 0 — CSV export (free tier, build alongside anything, half a session):** an "Export for your accountant" button on /money producing an invoices+payments CSV. Every package imports CSV; Squeegee gets away with a Xero *export* as their whole story. This alone answers "does it work with my accountant?" on day one.

**Stage 1 — FreeAgent (premium, ~1–2 weeks of sessions):** best audience fit (free with NatWest/RBS/Mettle accounts), free API, light approval, generous limits. Gotcha: invoices arrive as Draft and need a second "mark as sent" call.

**Stage 2 — Xero (premium, ~2 weeks):** the checkbox buyers look for. Launch uncertified (25-connection runway covers early premium users), certify when traction demands. Gotchas: 30-minute access tokens; **verify Xero's post-March-2026 tiered API pricing before building** — likely free at our scale, but confirm.

**Stage 3 — QuickBooks Online (premium, ~2 weeks):** solid UK sole-trader base, but Intuit requires a security/compliance questionnaire *before* production keys — start that paperwork well before building. Note: the API serves QuickBooks *Online*, not the old Self-Employed product — check what our actual users hold before committing.

**Skip Sage** (5-minute tokens, rotating refresh, ID-resolution ceremony, weakest sole-trader overlap).

---

## Feature 3 — Consumer directory app (integration brief accepted 2026-07-24)

Ringo's brief (RoundMate_Integration_Brief.md): a **separate consumer-facing app** (own repo/deploy/domain) sharing the existing Supabase project. A directory of ~11,500 scraped UK home-service businesses (London + Essex/Surrey, our nine trades) doubles as consumer inventory AND the tradesperson acquisition list. The loop: homeowner books on the consumer app → the job needs managing → the tradesperson onboards to RoundMate.

**Integration surface (additive only, nothing existing refactored):** new tables `directory_listings` (public READ only, `claimed_by` → businesses.id nullable) and `reviews` (service-role insert only, booking-gated); touchpoint 1 = booking handoff (consumer app writes a lead, RoundMate surfaces it), touchpoint 2 = "This is my business" claim (one update, can land later).

**Accepted amendments to the brief:**
- **Leads and booking requests are the same thing.** Use ONE `booking_requests` table with a `source` column ('page' | 'directory'), not a parallel leads path — the premium booking-page feature (Feature 1) and directory handoff then share the dashboard badge, confirm flow, and emails for free. Build Feature 1 Phase A first; the directory plugs into it.
- **No anon writes, ever.** The consumer app inserts leads via its own server route using the service role (rate-limited, honeypot) — the anon key must never gain insert on any shared table.
- **Compliance before launch:** the scraped list is largely sole traders, who count as individuals under UK GDPR/PECR — so (a) publishing their details needs a legitimate-interest assessment + easy takedown/claim path, (b) the planned cold-email campaign to listed trades is NOT covered by the B2B exemption for sole traders — needs care (post, phone, or opt-in routes are safer), (c) reviews on unclaimed businesses = defamation/complaints surface; keep reviews booking-gated and launch them late.
- Shared-DB blast radius is acceptable given public read is confined to `directory_listings` — revisit if the consumer app ever needs more.

## How this fits the existing roadmap

Nothing here jumps the queue. The money loop still comes first (payment reminders → Stripe links), then the native app shell, because those are what make the base product worth £12. The premium pair slots in around the commercial launch: **CSV export can ship any time** (it's small and it de-risks the accounting question immediately); **booking requests Phase A** is the launch-window premium feature (it's also the foundation for the agent/work-provider channel and the request-again links); **FreeAgent then Xero** follow once premium has its first subscribers — real users choosing "which accounting package do you use?" will confirm the order.

One prerequisite both features share: the **/settings page** (already on the list) — it's where the business handle, QR code, and Connect-to-FreeAgent/Xero buttons live.

## Risks and open questions

Xero's 2026 API pricing tiers need verifying before the Xero build (the one real cost uncertainty). Intuit's review adds lead time — paperwork first, code second. Booking-request spam on public pages is a known nuisance — rate limiting and a honeypot at minimum, and the tradesman can always decline. And pricing the premium tier at £18–20 keeps us under Squeegee's Advanced tier (£15.83+VAT ≈ £19) while offering a friendlier version of the same headline features — worth an explicit competitive check at launch.

---

*Research detail: accounting-API agent covered Xero/QBO/FreeAgent/Sage auth models, rate limits, approval processes and aggregator pricing; booking agent covered Squeegee, getSoapy, Jobber, Housecall Pro, ServiceM8 booking products and tiers, magic-link security best practice, and distribution channels (Google Business Profile custom booking links, WhatsApp Business, QR). Full source URLs preserved in the session transcript of 2026-07-22.*
