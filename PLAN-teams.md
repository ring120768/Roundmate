# Teams Plan — small crews on the trade side

*Drafted 2026-09-09. Decisions taken in-session are recorded as decisions, not
options. This plan went through two wrong turns before landing; both are recorded
at the end because the reasons are worth keeping.*

---

## What this feature is

A round run by two or three self-employed lads. Not an employer managing staff —
**a team of entrepreneurs sharing a round**, where the customer database is the
shared asset every one of them depends on.

So the feature is three things:

1. **Dispatch** — say who is doing which jobs, so each person opens the app and
   sees their own day.
2. **Attribution** — know who took the cash, who recorded a payment, who added
   that new customer.
3. **CRM integrity** — the round cannot be damaged. Not because anyone is
   suspected, but because a shared asset with several hands on it drifts and
   degrades unless something holds it steady.

That third one is the honest framing. This is **not** protection against a
member copying the round — they can see all of it, and they need to. It is
protection against the round being *changed or lost*.

### The round is houses, not people

A window cleaner's round is a list of **properties**. The address, the frequency,
the price and the access notes belong to the house. The name, email and mobile
belong to whoever currently lives there — and they move.

`customers` today conflates the two. A proper split into `properties` and
`contacts` is arguably what this trade actually is, but it touches
`jobs.customer_id`, the CSV import, Fill my round, route optimisation and every
email. **That is its own project and must not be smuggled into the teams work** —
bundling them would make both harder to land. The occupancy handling below gives
most of the safety now and makes that refactor easier later, because history
stops depending on the live record.

### Language

Call them **team members**, not workers. In UK employment law "worker" is a
defined status, distinct from employee and from self-employed contractor. For a
crew of self-employed lads, having the software label them workers makes an
implication nobody wants to make. `owner` / `member` in the database, "Team" in
the UI.

---

## Decisions taken

**Two roles: `owner` and `member`.** No manager tier until somebody asks.

**One person, one business.** `profiles.business_id` stays a single FK. A
subcontractor working for two firms needs two logins. This will come up. A
`business_members` join table forces RLS to resolve a "currently selected
business" per session — a much bigger change. Revisit when it costs a real sale.

**Members see the whole customer directory.** They need it: they cover for each
other and they fill their own days.

**Members can create customers.** Ad-hoc work — "can you do next door too" —
is how a round grows, and it usually gets picked up by whoever is standing there.

**Members cannot edit existing customers**, except ones they created themselves.

**Nobody can delete a customer. Ever.** Archive instead.

**Members take payments** — cash, card via Stripe link, bank, mark-as-paid.

**Cash reconciliation ships in v1.**

### Why nobody deletes, including the owner

The accounts export joins `customers` to put names on historical invoices.
Hard-deleting a customer blanks the name on every past invoice in that export,
including ones already sent to an accountant. That is a hole in the books, and
role has nothing to do with it.

`customers.archived_at` gives the owner the same outcome — gone from lists,
gone from Fill my round, gone from the directory — with the record intact
underneath. In RLS terms **no DELETE policy is written at all**, so the database
refuses deletion from any role. The protection is the absence of code.

### Editing has the same problem, and the same shape of fix

The owner must be able to edit name, email and mobile — people move, and the
house stays on the round. But that edit hits the accounts export the same way a
delete does: change the name and every historical invoice line for that property
silently reports the new occupier, including invoices already sent to an
accountant.

An invoice is a historical document and must not change when the customer record
changes. The fix is to stamp the billing identity at send time, alongside the
invoice number that is already stamped there:

```sql
alter table public.jobs
  add column if not exists billed_to_name text,
  add column if not exists billed_to_address text;
```

Set in `sendJobEmail` next to the `take_invoice_number()` call. The accounts
export reads `billed_to_name` and falls back to the live customer for rows
predating the change. Two columns, and the books stop being retroactively
editable.

### Occupancy change is an action, not a field edit

Rather than the owner overwriting three fields by hand, the customer record gets
a **New occupier** action. It keeps address, postcode, frequency, price, access
notes and the entire job history; it replaces the contact details; it records
that the changeover happened.

Same outcome, but it is an event rather than a silent overwrite, and it prevents
the half-edited record — new name, old email — which is how the wrong person ends
up getting an invoice.

**Data retention:** the old occupier's name persists on past invoices via
`billed_to_name`, which is a tax record and legitimately kept for six years.
Their mobile and email are not needed once they have moved, so **New occupier
clears them rather than archiving them**. Simpler to build and the right answer
under UK GDPR.

---

## Data model

```sql
-- Who is what.
alter table public.profiles
  add column if not exists role text not null default 'owner';

alter table public.profiles
  add constraint profiles_role_check check (role in ('owner','member'));

-- Who is doing this job. Null = unassigned.
alter table public.jobs
  add column if not exists assigned_to uuid references public.profiles(id);

create index if not exists jobs_assigned_to_idx
  on public.jobs (assigned_to, appointment_date);

-- Who recorded the payment, and (for cash) whether it has been handed over.
-- Covers every paid path: marking a job "paid - bank transfer" is as much a
-- trust surface as pocketing a tenner, and it costs nothing to know who did it.
alter table public.jobs
  add column if not exists payment_recorded_by uuid references public.profiles(id),
  add column if not exists cash_settled_at timestamptz;

-- Where did this customer come from, and is it still live.
alter table public.customers
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists archived_at timestamptz,
  add column if not exists occupier_changed_at timestamptz;

-- The billing identity as it stood when the invoice went out. An invoice is a
-- historical document; it must not change when the customer record changes.
alter table public.jobs
  add column if not exists billed_to_name text,
  add column if not exists billed_to_address text;

-- How a second person gets an account.
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','member')),
  token_hash text not null,          -- store the hash, never the token
  created_by uuid references public.profiles(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

Existing users backfill correctly: `role` defaults to `owner`, so every current
account keeps full access. `assigned_to` null means unassigned and
`archived_at` null means live, so nothing existing needs migrating.

---

## Permissions

One helper:

```sql
create or replace function private.current_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;
```

### Customers — the heart of it

```sql
-- Read: everyone in the business.
create policy customers_select on public.customers for select using (
  business_id = private.current_business_id()
);

-- Create: everyone in the business. created_by is stamped by the client.
create policy customers_insert on public.customers for insert with check (
  business_id = private.current_business_id()
);

-- Edit: owners, or the member who created that record.
-- The second clause saves every "boss, I've typed the postcode wrong" call.
create policy customers_update on public.customers for update using (
  business_id = private.current_business_id()
  and (private.current_role() = 'owner' or created_by = auth.uid())
);

-- Delete: NO POLICY. Deliberately absent. Nobody deletes a customer.
-- Archiving is an update of archived_at, and so falls under the policy above.
```

### The three other gates

**1. Business settings — owner only.** Protects the Stripe connection, the
accountant destination, the business identity.

```sql
drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses for update using (
  id = private.current_business_id()
  and private.current_role() = 'owner'
);
```

**2. Nobody promotes themselves.** A `before update` trigger on `profiles`
restores `role` and `business_id` to their old values unless the caller is an
owner of that business. A policy can't express "these two columns are frozen".

**3. Invites — owner only** on select, insert and delete.

### Jobs stay open

Job policies do not change. Members see the business's jobs and can complete
them. Assignment is a **default and a filter, not a wall** — covering for someone
off sick is normal.

`jobs.price` **stays editable by members.** They need to charge the right money
when the conservatory gets done as well, and they are the ones taking the
payment. The standing arrangement (`customers.default_price`) is the owner's and
is read-only to members; the individual visit can vary. That split is the whole
idea: **terms are protected, the day is flexible.**

**Why the price does not need locking down.** Price is transparent by the time it
matters: it goes on the invoice, the invoice goes to the customer, the customer
pays that amount, and `price`, `invoice_number`, `paid_at` and `paid_method` are
all recorded against the job. Changing it gains nobody anything, because the
number charged is the number on record and the customer has seen it. The control
is the paper trail, not the permission.

That argument depends on the invoice actually arriving — which only became
reliable in the 2026-08-23 session, when silent email failures started being
reported instead of swallowed.

**Where the argument thins:** a customer with no email address. No receipt, no
third party who saw the number, and the only record is what was typed. As of
2026-09-09 every customer in the database has an email, but 50 of 53 are seeded
test rows — on a real round, email-less customers are normal at the older end of
the book.

**The cheap control, instead of a restriction:** flag price variance. Every
customer has a `default_price` and it is read-only to members, so a job completed
at a different figure is detectable. Surface it to the owner — job, both figures,
who recorded it — as a small "unusual prices" list. The honest reason to build it
is **fingers, not fraud**: 15 typed for 150 is far likelier than skimming, and
today that error stays invisible until the accounts stop adding up months later.
One list catches both.

### What this does and does not protect

Protects: the customer database from being edited or lost by several hands;
business settings, Stripe and the accountant destination from anyone but the
owner; the account itself from being taken over.

Does not protect: the round from being *seen*. Every member sees every customer,
address and price, and can work out the takings from job data whether or not the
Money tab is hidden from them. Hiding `/money` is tidiness, not secrecy. Say so
plainly rather than implying otherwise.

---

## The member's app is your app with less

Same codebase, role-driven. No second app and no second App Store submission.

| | Owner | Member |
|---|---|---|
| Bottom nav | Today · Jobs · Money · Customers · More | Today · Jobs · Customers · More |
| Today | all jobs, day value | own jobs by default, no business day-value |
| Jobs | all, Mine / All / Unassigned filter | same filter, defaults to Mine |
| Job detail + Complete | full | full, including payments and job price |
| Customers | full directory, create, edit, archive, **New occupier** | full directory, create; edit only own additions |
| Fill my round · Calendar · Route | yes | yes |
| Money | full | hidden |
| Settings | business, Stripe, accountant, **Team** | own name and phone, sign out |

Customer form for a member: existing records render as a read-only detail view
with Call and Navigate, no Edit button. Records they created keep the Edit
button.

Owner additions: a **Team** card in Settings (invite, list, deactivate), an
assignment control on the job form and job detail, the Mine / All / Unassigned
filter, and Archive on the customer record.

### The one sharp edge

Gate codes and access notes change on the ground. A member finds a new padlock on
the side gate and, being read-only, cannot record it against the customer.

For v1 the existing job note carries it — they write it on completion and the
owner sees it on the job. **Watch this one.** If it grates in real use, the fix is
a "suggest a change" flag the owner can accept in one tap, not opening up edit.

---

## Cash reconciliation

Every completion stamps `payment_recorded_by`. `/money` gains a **Cash with the
team** section listing jobs where cash was recorded by someone other than the
owner and `cash_settled_at is null`:

> Dave — £85 across 6 jobs · [Settled up]
> Jamie — £30 across 2 jobs · [Settled up]

"Settled up" stamps `cash_settled_at = now()` across that member's outstanding
cash jobs. Card and bank payments never appear — that money already reached the
owner's bank.

Small feature. Removes a weekly argument.

---

## Invite flow

1. Owner enters an email in Settings → Team.
2. Server route (service role) creates an `invites` row storing a **hash** of a
   128-bit random token, and emails the link via Resend, reusing the existing
   sender.
3. Member opens `roundmate.co.uk/join/<token>` — a page with a button, never a
   GET that mutates, because mail scanners pre-fetch links.
4. On accept: sign up or sign in, then a server route validates by hash, checks
   expiry, sets `profiles.business_id` and `profiles.role`, stamps `accepted_at`.

The existing `auth.users` trigger already creates a `profiles` row with a null
`business_id`, so acceptance is a patch rather than a new path.

**Deactivation matters as much as invitation.** Removing a member nulls their
`business_id` immediately and returns their assigned jobs to unassigned so
nothing goes missing off the round. Customers they created stay — they belong to
the business, not the person.

---

## Build order

**Phase 1 — the spine (~2 sessions).** Migration; `current_role()`; the customer
policies; the three gates; invite, accept, deactivate; role-driven nav; Team card
in Settings; read-only customer view for members.

**Phase 2 — dispatch (~1 session).** `assigned_to` on the job form and job
detail; Mine / All / Unassigned filter; Today defaults to own jobs;
**bulk-assign a day to a member** — this is how a round actually gets divided, by
day and area, not job by job.

**Phase 3 — the money (~1 session).** `payment_recorded_by` on every paid path;
Cash with the team on `/money`; settle-up.

**Independent of teams, and worth doing regardless:** archive-instead-of-delete,
the `billed_to_name` / `billed_to_address` invoice snapshot, and the New occupier
action. All three close real holes in the accounts export that exist today,
whether or not anyone ever invites a team member. If teams gets deprioritised,
lift these three out and ship them on their own.

---

## Pricing

Teams is the natural third tier above the £12 base and £18–20 premium. Per-seat
aligns price with value: base plan plus roughly £5–6 per additional member. It
self-limits — a one-man band never sees it.

Per-seat needs the seat count enforced server-side, another reason role lives in
the database rather than the UI.

---

## Risks and open questions

- **Read-only access notes** is the friction point most likely to come back.
  Job notes are the v1 answer; a suggest-a-change flag is the fix if needed.
- **Marking paid is a trust surface.** `payment_recorded_by` gives an audit trail
  but does not prevent a false mark. An owner-facing "payments recorded by the
  team this week" review is the later answer if it becomes a problem.
- **Members see the whole round.** By design. Don't market otherwise.
- **Subcontractors across two firms** will be asked for. Two logins for now.
- **The properties / contacts split** is the real long-term shape of this data
  and is deliberately deferred. The invoice snapshot above is what makes deferring
  it safe.
- **Scope creep is the main danger.** Timesheets, payroll, GPS tracking,
  per-member performance stats and in-app chat are Jobber's territory and each is
  a product in itself. The product test still applies: does it save time, get paid
  faster, reduce travel, or secure repeat work? Dispatch and cash attribution
  pass. The rest do not.

---

## Two wrong turns, and why they're worth remembering

**First draft:** assumed members should be kept away from the round — restricted
to customers on their assigned jobs, prices hidden — and made that the selling
point. Wrong, because members process payments and pick up ad-hoc work, so they
need prices and they need to create customers. Hiding columns was also the one
genuinely hard part of that design: Postgres column privileges are granted per
database role, and owners and members are both `authenticated`, so it needed a
security-definer RPC or triggers. **The hardest part of the design existed only
to serve an assumption about the work that was wrong.**

**Second draft:** over-corrected to full read-write access for members and
concluded there was nothing much to protect. Also wrong. The concern was never
theft — it is integrity. A shared round with several hands on it degrades unless
something holds it steady, and that is worth building even among people who trust
each other completely.

The landing point — read the lot, add freely, change nothing you didn't create,
delete nothing ever — came from Ringo describing how the work actually happens,
twice, after the plan had been written the wrong way round.
