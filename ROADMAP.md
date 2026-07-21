# Pugsie PA — Roadmap

## Roadmap Summary

Pugsie PA should be built in practical layers.

Do not start with AI, route optimisation, or complex integrations. Start with the workflow that creates immediate value:

> Customer → Job → Complete → Invoice → Payment → Next appointment.

Once that works, add reminders, routing, Christmas lights, and AI.

## Phase 0 — Product Definition

### Goal

Define the product clearly before build starts.

### Deliverables

- Final PRD
- README
- Roadmap
- Supabase schema plan
- Railway backend architecture plan
- User flows
- MVP feature list
- Basic wireframes
- Branding direction
- Clickable prototype, optional

### Key Decisions

- Expo mobile app vs Next.js web app
- Supabase table structure
- Row Level Security design
- Railway backend framework: Express or Fastify
- Stripe vs GoCardless first
- Email vs SMS first
- How simple the first calendar invite flow should be

### Exit Criteria

- MVP scope is agreed
- Core data model is agreed
- First build stack is agreed
- Core user journey is clear

## Phase 1 — Supabase and Railway Foundation

### Goal

Create the technical foundation.

### Features

- Supabase project setup
- Supabase Auth
- Core Postgres tables
- Row Level Security policies
- Supabase Storage buckets
- Railway project setup
- Backend API skeleton
- Environment variable setup
- Basic health check endpoint
- Local development setup

### Core Tables

- businesses
- profiles
- customers
- jobs
- invoices
- payments
- messages
- seasonal_services

### Railway Backend Responsibilities

- API routes
- Webhooks
- Scheduled jobs
- Email triggers
- Invoice generation
- Calendar invite generation

### Exit Criteria

- User can log in
- App can read/write secure data
- Railway backend can connect to Supabase
- RLS prevents cross-business data leakage

## Phase 2 — Customer and Job Management MVP

### Goal

Allow the user to manage customers and appointments.

### Features

- Business profile setup
- Add customer
- Edit customer
- View customer list
- Search customers
- Customer detail page
- Add job/appointment
- Edit job/appointment
- Daily job list
- Basic calendar/list view
- Job status tracking

### Customer Fields

- Name
- Address
- Postcode
- Phone
- Email
- Preferred contact method
- Default service type
- Default price
- Visit frequency
- Access notes
- Payment preference
- Tags

### Job Fields

- Customer
- Date
- Time
- Service type
- Price
- Duration
- Status
- Notes

### Exit Criteria

- User can manage a real customer list
- User can create appointments
- User can view today’s jobs
- User can update job status manually

## Phase 3 — Job Completion Workflow

### Goal

Build the core workflow: finish job, trigger admin.

### Features

- Job detail screen
- **Job Complete** checkbox
- **Complete & Send** button
- Completion timestamp
- Customer job history update
- Suggested next appointment
- Basic job completion note
- Payment option selection:
  - Paid cash
  - Send payment link later
  - Bank transfer
  - Skip for now

### Workflow

1. User opens job
2. Checks job complete
3. Selects payment option
4. Confirms next appointment
5. Taps Complete & Send
6. App updates customer/job records

### Exit Criteria

- A user can complete a real job in less than 30 seconds
- Job history is updated
- Next appointment can be generated or skipped

## Phase 4 — Invoicing

### Goal

Generate and send invoices when jobs are completed.

### Features

- Invoice number generation
- Invoice record creation
- Invoice PDF generation
- Basic invoice template
- Send invoice by email
- Manual paid/unpaid status
- Cash payment recording
- Customer receipt/thank-you message
- Unpaid invoice dashboard

### Invoice Statuses

- Draft
- Sent
- Paid
- Overdue
- Cancelled

### Exit Criteria

- Completing a job can create an invoice
- Invoice can be sent to customer
- Cash payment can mark invoice as paid
- User can see unpaid invoices

## Phase 5 — Stripe Payment Links

### Goal

Allow customers to pay online.

### Features

- Stripe Payment Links or Stripe Checkout
- Payment link generation from invoice
- Payment link included in invoice message
- Stripe webhook endpoint on Railway
- Auto-update invoice to paid
- Payment receipt message
- Payment provider reference stored

### Workflow

1. User chooses **Send payment link**
2. Railway creates Stripe payment session/link
3. Customer receives invoice and link
4. Stripe confirms payment via webhook
5. Railway updates Supabase invoice/payment status
6. Customer receives payment confirmation

### Exit Criteria

- User can send real payment links
- Stripe webhook updates invoices correctly
- Paid/unpaid dashboard reflects Stripe payments

## Phase 6 — Appointment Confirmations and Calendar Invites

### Goal

Confirm appointments professionally and reduce missed visits.

### Features

- Appointment confirmation message
- ICS calendar invite generation
- Customer receives add-to-calendar invite
- Next appointment created after job completion
- Appointment status tracking
- Reschedule request link, optional
- Customer confirmation link, optional

### MVP Calendar Approach

Use `.ics` calendar invites first.

Benefits:

- Works with Apple Calendar
- Works with Google Calendar
- Works with Outlook
- Does not require full calendar API integration
- Easier to build

### Later Calendar Sync

- Google Calendar API
- Microsoft Outlook Calendar API
- Two-way sync
- Availability checking
- Conflict avoidance

### Exit Criteria

- Job completion can create next appointment
- Customer can receive calendar invite
- Appointment status is stored

## Phase 7 — Payment Reminders

### Goal

Reduce unpaid invoices.

### Features

- Overdue invoice rules
- Reminder schedule
- Railway scheduled reminder job
- Reminder message template
- Reminder count tracking
- Last reminder date
- Manual pause reminders
- Dashboard card: “Needs chasing”

### Example Reminder Schedule

- Day 0: invoice sent
- Day 3: polite reminder
- Day 7: stronger reminder
- Day 14: final reminder

### Exit Criteria

- App can identify overdue invoices
- Reminders can be sent automatically
- User can see who has been chased

## Phase 8 — Smart Rounds Assistant

### Goal

Group jobs geographically to reduce travel time and cost.

### MVP Features

- Postcode district grouping
- Area-based job list
- Jobs due by area
- Estimated value by area
- Suggested working days by area
- Nearby jobs due soon
- “Working nearby” message template

### Example Output

> You have 22 jobs due next week. I suggest grouping 8 jobs in CM1 on Monday, 6 jobs in CM2 on Tuesday, and 5 jobs in CM77 on Wednesday.

### Later Features

- Map view
- Distance calculation
- Route ordering
- Live traffic estimates
- Best route optimisation
- “Add nearby job to today” button

### Exit Criteria

- User can view upcoming jobs by area
- User can plan week using postcode clusters
- User can identify nearby customers due soon

## Phase 9 — Christmas Lights CRM

### Goal

Turn seasonal Christmas lights work into a managed annual campaign.

### Features

- Christmas lights customer tag
- Seasonal service records
- Previous-year customer list
- November reminder campaign
- Booking status tracker
- Installation schedule
- Removal schedule
- Install invoice/payment flow
- Removal appointment reminders
- Next-year reminder setup

### Campaign Statuses

- Previous customer
- Not contacted
- Reminder sent
- Interested
- Booked
- Quote required
- Installed
- Paid
- Removal booked
- Removed
- Declined

### Exit Criteria

- User can tag Christmas lights customers
- User can send November reminders
- User can track installation and removal bookings
- User can rebook previous customers annually

## Phase 10 — AI Assistant Layer

### Goal

Make Pugsie PA feel like a practical assistant.

### Features

- “Who owes me money?”
- “Who should I chase today?”
- “Plan my week by area.”
- “Find customers due soon near me.”
- “Write a payment reminder.”
- “Start my Christmas lights campaign.”
- Weekly business summary
- Outstanding invoice summary
- Suggested calendar gaps
- Suggested route improvements

### AI Rules

The AI should:

- Use only business data available in Supabase
- Not invent customer details
- Not send messages without user approval unless automation is explicitly enabled
- Keep messages short and practical
- Prioritise actions that save time or recover money

### Exit Criteria

- User can ask practical business questions
- AI can draft useful messages
- AI can suggest route/payment/admin actions

## Phase 11 — Advanced Integrations

### Goal

Make Pugsie PA more automated and scalable.

### Features

- Google Calendar sync
- Outlook Calendar sync
- SMS via Twilio
- WhatsApp Business API
- GoCardless recurring payments
- Xero integration
- QuickBooks integration
- FreeAgent integration
- Advanced map routing
- Staff/team assignment
- Reporting dashboard

### Note on teams, rotas and payroll (2026-07-10)

For larger traders: build rotas/job assignment in-app (assign jobs/rounds to staff, per-worker day lists — this is where paid team tiers come from; staff are extra `profiles` on the same `business_id`). Do NOT build payroll — UK payroll (HMRC RTI, pensions auto-enrolment) is a regulated product; integrate/export instead (hours, jobs and revenue per worker to accountant/Xero). Many workers in these trades are self-employed subbies paid a share of the round, so subbie-split reporting matters more than PAYE.

### Exit Criteria

- App can support more serious operators and small teams
- App can connect with existing accounting/calendar tools
- App is ready for broader service business expansion

## Recommended MVP Build Order

1. Supabase setup
2. Auth
3. Core schema
4. RLS policies
5. Railway backend setup
6. Customer database
7. Jobs/calendar
8. Job completion checkbox
9. Invoice generation
10. Cash/payment status
11. Stripe payment links
12. Stripe webhooks
13. Repeat appointment creation
14. Calendar invite sending
15. Payment reminders
16. Postcode route grouping
17. Christmas lights CRM
18. AI assistant

## Milestone View

## MVP 1 — Basic Admin

**Outcome:** User can manage customers and appointments.

Includes:

- Login
- Customers
- Jobs
- Daily list
- Basic calendar
- Job status

## MVP 2 — Complete Job and Invoice

**Outcome:** User can finish a job and send invoice immediately.

Includes:

- Job complete checkbox
- Invoice generation
- Cash payment
- Manual paid/unpaid
- Invoice dashboard

## MVP 3 — Online Payments

**Outcome:** User can send payment links and track online payments.

Includes:

- Stripe link
- Stripe webhook
- Paid status update
- Payment receipt
- Overdue dashboard

## MVP 4 — Repeat Bookings and Invites

**Outcome:** User can book the next visit and send customer calendar invite.

Includes:

- Repeat scheduling
- Next appointment
- ICS invite
- Confirmation message

## MVP 5 — Route Grouping

**Outcome:** User can group work by area.

Includes:

- Postcode grouping
- Due jobs by area
- Suggested route days
- Nearby due customers

## MVP 6 — Christmas Lights

**Outcome:** User can rebook seasonal customers.

Includes:

- Christmas lights tag
- November reminders
- Booking tracker
- Install/removal schedule

## MVP 7 — AI Assistant

**Outcome:** User gets helpful admin guidance.

Includes:

- Payment chasing suggestions
- Route planning suggestions
- Message drafting
- Weekly summary

## Risk Management

## Risk: App becomes too complicated

Mitigation:

- Keep MVP checkbox-led
- Avoid too many settings
- Keep daily workflow front and centre

## Risk: Calendar sync becomes hard

Mitigation:

- Start with ICS invites
- Add Google/Outlook sync later

## Risk: WhatsApp API slows build

Mitigation:

- Start with email
- Add SMS next
- Add WhatsApp later

## Risk: Payments add complexity

Mitigation:

- Use Stripe-hosted payment pages first
- Avoid holding payment data directly

## Risk: Route optimisation becomes too technical

Mitigation:

- Start with postcode grouping
- Add maps and route APIs later

## Risk: User does not keep data updated

Mitigation:

- Minimise typing
- Use defaults
- Auto-create next steps after job completion

## Future Direction — Multi-Trade Expansion (noted 2026-07-10)

The core loop (customer → job → complete → invoice → payment → next visit) is trade-agnostic. Once proven with window cleaners, the same app suits landscapers, gardeners, ironing services, domestic cleaners, and similar round-based local trades. Expansion is mostly copy, onboarding ("What trade are you?"), and terminology — not a rebuild.

**Bolt-on pattern:** Christmas lights is the window-cleaner bolt-on — seasonal, high-value, repeat-annual work layered on the core loop. Other trades will have their own equivalents (e.g. gardeners: spring tidy-ups, hedge cutting season; landscapers: quoting/project work; cleaners: end-of-tenancy deep cleans). Some of these bolt-ons will need deeper trade knowledge or smarter logic (quoting, seasonality rules, materials) — that's where the AI layer and specialist knowledge access earn their keep. Design the seasonal_services concept generically so Christmas lights becomes the first instance of a reusable pattern, not a one-off.

**Decision — customer self-booking (Calendly etc.): rejected.** These businesses are round-based; the tradesman controls the schedule, so slot-picking fights Smart Rounds. If customer-initiated booking is ever wanted, it should be a lightweight "request a visit" link that lands as a pending job — later phase, if at all.

**Rule:** don't broaden until window cleaners are using it daily and paying. One niche first.

## Commercial Launch Plan (added 2026-07-21)

**Sequencing rule: finish the money loop first** (domain live → test invoice → payment reminders → Stripe payment links). The app must collect money for tradesmen before it asks tradesmen for money.

**Pricing (informed by RESEARCH-cross-pollination.md competitor scan):** market sits at Aworka £10–12, Squeegee £16+, CleanerPlanner £30, Jobber $39+. Land at ONE simple solo plan **£12/mo or £99/yr**, 30-day free trial, no card upfront. Founding-member deal **£8/mo for the first 25–50 users** — pitched as "founding price, kept while you stay subscribed" (Ringo's call 2026-07-21: do NOT promise "forever" — hollow if the business folds; keep the wording honest and time-bound to the subscription). Recruit via window-cleaning Facebook groups/forums. Paul free (user zero + case study). **Mate's OK on using his likeness for the mascot: DONE (confirmed 2026-07-21).** Team tier later (rotas/job assignment — see Phase 11 note); payroll never (integrate/export instead). Billing = Stripe Billing subscriptions — separate from and AFTER Phase 5 payment links.

**Launch checklist (unglamorous but required before charging strangers):** terms + privacy policy (UK GDPR — we hold their customers' personal data), support email on roundmate.co.uk, verified Supabase backups, marketing landing page at roundmate.co.uk with app at app.roundmate.co.uk, pitch copy ("Finish the job. Tap complete. Everything else is sorted.").

**UI/UX polish pass:** mobile-first audit of the daily loop (dashboard → job → complete), bigger touch targets, faster perceived loads, consistent empty states; keep checkbox-led, minimal typing.

**Trade-personalised mascot:** same caricature character re-drawn per trade (squeegee / hedge trimmer / valet sponge / oven gloves), selected automatically by a "What's your trade?" onboarding question — which is also the first building block of multi-trade expansion. Generate variants from the existing logo as reference. NOTE: character is based on Ringo's mate — get his explicit OK before commercial use of his likeness.

## Final Roadmap Principle

Build around money first:

> Jobs completed, invoices sent, payments tracked, next visits booked.

Then add route savings and seasonal revenue.

AI comes last, once the app has useful business data to work with.
