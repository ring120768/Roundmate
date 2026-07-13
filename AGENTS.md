# AGENTS.md — Pugsie PA

This file orients Codex at the start of every session in this project. Read it first.

## What this is

**Pugsie PA** is a mobile-first admin assistant for window cleaners and small local service businesses. It handles the messy admin: customers, appointments, job completion, invoices, payments, repeat bookings, route grouping, and seasonal work (Christmas lights).

The whole product hangs off one core workflow:

> Finish the job → tick complete → send invoice → confirm payment → book next visit → send calendar invite → chase if unpaid.

The guiding test for any feature: **does it help the user save time, get paid faster, reduce travel, or secure repeat work?** If not, it's not in the MVP.

## Current state (as of 2026-05-24)

- **Phase 0 (product definition) is done.** PRD, README, and ROADMAP are written and live in this folder.
- **Phase 1 (foundation) is DONE.** Supabase schema + RLS + Storage all live and verified (security advisor clean). Next.js app scaffolded, deployed to Vercel, and the full auth chain works end to end: sign up → log in → onboarding (create business) → dashboard, with RLS holding. Phase 1 exit criteria met.
- **Railway intentionally deferred.** A Next.js app talks to Supabase directly, so no server is needed yet. Railway comes in later phases (Stripe webhooks, invoice PDFs, reminders). Not created.
- **Frontend: Next.js** (mobile-first responsive web app, JavaScript + App Router). Lives in this folder. Hosted on Vercel free tier (move to Pro when it earns money).
- **Phase 2 largely built & deployed** — customers (list/add/edit/search + CSV import) and jobs (add/edit/list, today's list on the dashboard, manual status, book-from-customer) are live. Jobs are individual + date-only (round-based); auto-repeat from visit frequency is deliberately deferred to a later phase. There's also a Smart Rounds "Fill my round" page (`/rounds`) that groups nearby customers by postcode district for a chosen day.
- **Phase 3 (job completion workflow) built & deployed** — the job detail page has a Complete flow (`/jobs/[id]/complete`): mark complete (sets `status` + `completed_at`), record payment outcome (cash / bank / unpaid / free) on `jobs.payment_status`, optional note, and auto-book the next visit (date suggested from the customer's visit frequency). NOT yet done: generating or sending an actual invoice/receipt — that's Phase 4 (needs an email provider). Next: Phase 4 (invoicing + unpaid dashboard + email setup).
- **UI / branding:** mobile-first tidied-blue theme. A `Brand` component (`components/Brand.js`) shows the logo + "Pugsie PA" wordmark — big on `/login`, slim bar on app pages. The logo file is expected at `public/logo.png` (Ringo's window-cleaner caricature); if it's missing, Brand degrades to the wordmark only. There's a month **calendar** view at `/calendar` (client-side, fetches the visible month's jobs, tap a day to see/add jobs). The root `/` is a branded **landing splash** (logo + Enter → dashboard); login now redirects straight to `/dashboard`, which gates onboarding. Soft water + grape-bunch "suds" background lives in `public/suds.svg`. The app is an installable **PWA** (`public/manifest.json` + `icon-192/512` + `apple-touch-icon`, all generated from `logo.png`) so it can be added to a phone home screen and run standalone.
- **Phase 4 (getting paid) — money view DONE.** `/money` shows Outstanding (completed jobs with `payment_status='unpaid'`) and Paid-this-week totals, with a "Mark paid" button (sets `payment_status='paid'`). Dashboard has a coral **Money** button. It's derived from job data — no `invoices` table records or email yet. **Email is now set up** — Resend, with `RESEND_API_KEY` set in Vercel, sending from the `onboarding@resend.dev` test address (custom domain NOT verified yet, so real-customer deliverability is limited until it is). `app/api/send-email/route.js` is a Next.js route handler (server-side) that sends `invoice` / `receipt` / `confirmation` emails via the Resend API, scoped by RLS. Manual "Email invoice / Email receipt" buttons live on the job detail page; AND **auto-send on completion** is live — `CompleteJobForm` fires invoice-or-receipt (by payment outcome) plus a next-visit confirmation when the next job is booked (best-effort; completion still succeeds if an email fails). Sends are logged to the `messages` table. STILL TO DO: verify a real sending domain in Resend; **Stage 2 automation = scheduled payment reminders** (plan: Vercel Cron); optional auto-send on/off toggle; optional Yes/No confirm link on appointment emails. VAT assumed off for now (Ringo not VAT-registered).
- **Accounts:** Supabase project exists (see below). GitHub repo + Vercel project live (see Deployment). Railway not created. Stripe is **not set up yet** (needed for Phase 5).

## Supabase project

- **Name:** Pugsie PA
- **Project ref / ID:** `tzlscfbfpfvginwdphru`
- **Region:** eu-west-1 (Ireland) — fine for a UK product
- **API URL:** `https://tzlscfbfpfvginwdphru.supabase.co`
- **Org:** "Car Crash Supabase" (`mqpzmbmtbredczwwpaqe`), paid plan; this project bills $10/month.
- **Multi-tenancy model:** every business-owned table has a `business_id`. RLS uses `private.current_business_id()` (a SECURITY DEFINER helper in the non-API `private` schema) to scope every read/write to the logged-in user's business. A trigger on `auth.users` auto-creates a `profiles` row on signup; onboarding then creates a `businesses` row and links the profile's `business_id`.
- **Onboarding flow the app must implement:** sign up → profile auto-created (business_id null) → app inserts a `businesses` row → app updates own profile's `business_id` → all other tables become accessible.
- **Storage buckets:** `invoices` and `photos`, both private; files must be stored under a `<business_id>/...` path prefix for the isolation policy to work.

## Deployment / app

- **Repo:** GitHub `ring120768/Pugsie-PA`, default branch `main`.
- **Host:** Vercel (free tier), auto-deploys from `main`. Live at `https://pugsie-pa.vercel.app`.
- **Stack in repo:** Next.js 14.2.35 (App Router, JavaScript), `@supabase/ssr` for auth. Key files: `middleware.js` (session refresh), `lib/supabase/{client,server}.js`, `app/login`, `app/onboarding`, `app/dashboard`, `app/page.js` (the routing gate that sends users to login / onboarding / dashboard).
- **Env vars** (set in Vercel project settings AND local `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The secret service-role key is NOT in the repo or frontend.
- **Supabase Auth:** email confirmation is currently OFF for MVP (signup → instant login). Re-enable with a real email provider in a later phase.
- **Git note:** run git from Ringo's own Mac terminal, not from the sandbox — the sandbox can't remove `.git` lock files on the mounted folder, which leaves the repo wedged.
- **Deploy workaround (2026-05-25):** `git push` to GitHub began failing with `remote: Internal Server Error` (HTTP 500) on a tiny push, with no GitHub-wide outage; HTTP/1.1 downgrade + larger postBuffer didn't help. Worked around by deploying **straight to Vercel with the CLI**: `vercel --prod` from the project folder (now linked to `ring120768-2588s-projects/pugsie-pa`). The push then succeeded on a later retry the same day — it was a transient GitHub 500, now resolved. Normal `git push` works again (and Vercel auto-deploys from `main`); `vercel --prod` remains a handy manual fallback. `.vercel/` is gitignored.

## Tech stack

- **Frontend:** Next.js (mobile-first responsive web app)
- **Database / Auth / Storage:** Supabase (Postgres + Auth + Storage + Row Level Security)
- **Backend / automations:** Railway (Node.js — Express or Fastify; webhooks, scheduled jobs, invoice + calendar generation)
- **Payments:** Stripe Payment Links / Checkout (Phase 5)
- **Email:** Resend, SendGrid, or Postmark (TBD)
- **Calendar:** `.ics` invites first, full Google/Outlook sync later

Supabase is the single source of truth for business data. Railway runs everything that needs a server: Stripe webhooks, invoice PDFs, email, calendar invites, reminder jobs, route grouping, and AI calls.

## Build order (from ROADMAP.md)

Build money-first, AI last. The short version:

1. Supabase project + Auth + core schema + RLS policies
2. Railway backend skeleton + env vars + health check
3. Customers (add/edit/list/search)
4. Jobs + daily list + basic calendar
5. Job Complete checkbox + completion workflow
6. Invoice generation + cash/manual paid status + unpaid dashboard
7. Stripe payment links + webhooks
8. Repeat appointments + `.ics` calendar invites
9. Payment reminders (scheduled)
10. Smart Rounds (postcode grouping)
11. Christmas lights CRM
12. AI assistant

Steps 1–6 effectively done (foundation, customers, jobs/daily list, completion, money dashboard, invoicing + email incl. auto-send-on-complete). Current target: verify a sending domain in Resend, then Stage 2 automation — scheduled payment reminders via Vercel Cron. Then Stripe payment links (Phase 5). VAT deferred.

## Core data model

Initial Supabase tables: `businesses`, `profiles`, `customers`, `jobs`, `invoices`, `payments`, `messages`, `seasonal_services`. Field-level detail is in `PRD (1).md` section 10 — refer to it rather than reinventing the schema. Every business-owned table needs RLS so one business can never see another's data.

## Development principles

- Mobile-first, designed for use in a van, not at a desk.
- Big buttons, checkbox-led flows, minimal typing, sensible defaults.
- Make money status obvious (paid / unpaid / overdue).
- Start simple: email before SMS/WhatsApp, `.ics` before calendar sync, postcode grouping before route optimisation.
- Don't overbuild the AI layer before the core admin workflow works.
- Keep solutions simple and practical — don't over-engineer. Build the smallest thing that delivers the value, then iterate.

## How to work with Ringo

- Ringo is a former chef, new to coding (started ~early 2026) and learning fast. Treat this as a mentoring partnership.
- Explain concisely but thoroughly, with practical examples and actionable next steps. Use real industry terms but don't drown him in jargon.
- Keep it conversational and to the point. Avoid heavy formatting in chat.
- Check your own work. Flag risks and trade-offs plainly rather than just doing the clever thing.
- When a decision has real consequences (cost, security, lock-in, rework), pause and lay out the options before building.

## Key references in this folder

- `PRD (1).md` — full product requirements, data model, features, success metrics, open questions.
- `ROADMAP.md` — phased build plan with exit criteria for each phase.
- `README.md` — product summary, tech stack, env var examples, dev principles.

## Open questions still to settle (PRD section 14)

A few decisions are deferred until they're actually needed, so we don't block the build:

- Email-only at MVP, or email + SMS?
- VAT support from MVP, or later?
- Team/staff accounts in MVP, or later?
- Christmas lights as a separate module, or a tag-driven workflow?
- GoCardless planned from day one for repeat customers, or Stripe-only first?

Surface these when the relevant phase comes up — don't pre-solve them.

## Imported Claude Cowork project instructions

**Pugsie PA** is a simple admin assistant app for window cleaners and local service businesses.

It helps them manage:

* Customers
* Appointments
* Invoices
* Payments
* Repeat bookings
* Route planning
* Seasonal work like Christmas lights

The core workflow is:

> **Finish the job → tick complete → send invoice → confirm cash or send payment link → book next visit → send calendar invite.**

The app solves the messy admin problem by making sure jobs are recorded, customers are reminded, invoices are sent, payments are chased, and repeat appointments are not forgotten.

It also includes a **Smart Rounds Assistant** to group jobs by postcode or area, helping reduce driving time and fuel costs.

For Christmas lights, it tracks previous customers and sends reminders in October/November to encourage repeat bookings.

The planned tech setup is:

* **Supabase** for customer, job, invoice and payment data
* **Railway** for automations, reminders, payment webhooks and backend logic
* **Stripe** for payment links
* Calendar invites for appointment confirmation

In simple terms:

> **Pugsie PA helps tradespeople spend less time on admin, get paid faster, and organise their work better.**
