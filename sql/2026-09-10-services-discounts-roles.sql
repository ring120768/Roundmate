-- Services price book, discounts/promotions, and the role column.
--
-- RECORD OF WORK ALREADY APPLIED. These statements were run ad-hoc in the
-- Supabase SQL editor on 2026-09-09/10 and are written up here so the repo
-- matches the database. Every statement is idempotent, so running this file
-- against the live project is a no-op and safe.
--
-- Verified applied on 2026-09-10 via the Supabase security advisor and a
-- direct check of pg_policies, pg_proc and information_schema.

-- ---------------------------------------------------------------------------
-- 1. Roles
--
-- profiles.role was originally added nullable with no default, which would
-- have locked existing owners out of any policy testing role = 'owner'
-- (null is not equal to anything). Backfilled, defaulted and constrained.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists role text;

update public.profiles set role = 'owner' where role is null;

alter table public.profiles
  alter column role set default 'owner',
  alter column role set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner','member'));

comment on column public.profiles.role is
  'owner = full access. member = operational access only. See PLAN-teams.md.';

-- Deliberately NOT named current_role(): CURRENT_ROLE is reserved in Postgres.
create or replace function private.current_member_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- SECURITY DEFINER functions must pin search_path, or a caller who can create
-- objects in an earlier schema on the path could shadow what they resolve.
alter function private.current_member_role() set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. Dispatch
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists assigned_to uuid references public.profiles(id);

create index if not exists jobs_assigned_to_idx
  on public.jobs (assigned_to, appointment_date);

-- ---------------------------------------------------------------------------
-- 3. Services price book
--
-- Seeded from the business's trade menu in lib/trades.js at onboarding, then
-- editable by the owner, who can also add their own. Job price resolution
-- order is: the job's own price, then customers.default_price, then this
-- table. The customer's agreed price deliberately beats the book so a price
-- rise never silently reprices an existing customer.
-- ---------------------------------------------------------------------------

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  default_price numeric,
  active boolean not null default true,
  sort_order int,
  created_at timestamptz not null default now()
);

alter table public.services enable row level security;

create index if not exists services_business_idx
  on public.services (business_id, active, sort_order);

-- ---------------------------------------------------------------------------
-- 4. Discounts and promotions
--
-- One mechanism, not two: a promotion is a discount with a name and a date
-- range attached to several customers; a one-off customer discount is the
-- same record attached to one.
-- ---------------------------------------------------------------------------

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('percent','amount')),
  value numeric not null,
  starts_on date,
  ends_on date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.discounts enable row level security;

alter table public.customers
  add column if not exists discount_id uuid references public.discounts(id);

-- No ON DELETE clause is deliberate: a discount referenced by a customer
-- cannot be deleted, which is the behaviour we want.

-- ---------------------------------------------------------------------------
-- 5. Policies
--
-- Everyone in the business READS services and discounts - a member needs the
-- service price to raise a job, and the discount to show on an invoice.
-- Only the owner WRITES them.
--
-- There is no DELETE policy on either table, deliberately. RLS denies by
-- default, so the absence of a policy is the protection. Retire a service
-- with active = false; a discount in use cannot be removed at all.
-- ---------------------------------------------------------------------------

drop policy if exists services_select on public.services;
create policy services_select on public.services for select using (
  business_id = private.current_business_id()
);

drop policy if exists services_insert on public.services;
create policy services_insert on public.services for insert with check (
  business_id = private.current_business_id()
  and private.current_member_role() = 'owner'
);

drop policy if exists services_update on public.services;
create policy services_update on public.services for update using (
  business_id = private.current_business_id()
  and private.current_member_role() = 'owner'
);

drop policy if exists discounts_select on public.discounts;
create policy discounts_select on public.discounts for select using (
  business_id = private.current_business_id()
);

drop policy if exists discounts_insert on public.discounts;
create policy discounts_insert on public.discounts for insert with check (
  business_id = private.current_business_id()
  and private.current_member_role() = 'owner'
);

drop policy if exists discounts_update on public.discounts;
create policy discounts_update on public.discounts for update using (
  business_id = private.current_business_id()
  and private.current_member_role() = 'owner'
);

-- ---------------------------------------------------------------------------
-- 6. Advisor housekeeping applied at the same time
--
-- These three are not SECURITY DEFINER, so the risk was lower, but the
-- Supabase linter flags any function without a pinned search_path.
-- ---------------------------------------------------------------------------

alter function public.take_invoice_number(b_id uuid) set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.refresh_listing_rating() set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 7. Seeding the price book  (INVESTIGATED 2026-09-10, NOT YET WRITTEN)
--
-- lib/trades.js still holds each trade's menu as a plain array of strings:
-- 9 trades, 71 services in total, no ids and no prices. jobs.service_type is
-- free text written from components/JobForm.js (servicesForTrade(trade),
-- defaulting to serviceTypes[0]) and read back in ~10 places, including
-- components/AccountsExport.js and app/api/optimize-route/route.js.
--
-- public.services is empty for every business that exists today, so the price
-- book ships blank unless we seed it. The plan:
--
--   a. Seed on onboarding. When a business picks its trade, insert one row per
--      servicesForTrade(trade) with default_price null and sort_order = index.
--      Null price means "no book price yet", which the job form treats exactly
--      as it does today - the tradesman types the number.
--
--   b. Backfill existing businesses with the same insert, keyed on
--      (business_id, name) so it is safe to re-run.
--
--   c. Changing trade at /trade must ADD the new trade's services, never
--      replace. A tradesman who adds gardening to window cleaning still has
--      window cleaning customers on the books.
--
--   d. Keep jobs.service_type as free text. Add a nullable jobs.service_id FK
--      alongside it rather than replacing it - the same snapshot pattern as
--      billed_to_name. Renaming a price-book entry then never rewrites the
--      wording on a past invoice, and the 12 jobs that already exist keep
--      working with service_id null.
--
--   e. Suggested prices can be derived, not invented: the median of
--      jobs.price grouped by service_type per business is a better first
--      offer than a blank box, and it is only a suggestion.
--
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- NOT in this migration, and still outstanding from PLAN-teams.md:
--
--   invites table
--   customers.created_by / archived_at / occupier_changed_at / round_owner
--   jobs.payment_recorded_by / cash_settled_at
--   jobs.billed_to_name / billed_to_address   (invoice identity snapshot)
--   jobs.service_id + the services seed and backfill (section 7 above)
--   the rework of the customers policies for member access
--   businesses UPDATE restricted to owners
--   the profiles trigger that stops a member writing their own role
--
-- Three of those - archive-instead-of-delete, the invoice snapshot, and the
-- New occupier action - close real holes in the accounts export that exist
-- today and are worth shipping whether or not teams is ever built.
--
-- Known outstanding advisor findings, both pre-dating this work and belonging
-- to the directory/portal side rather than RoundMate:
--   ERROR security_definer_view: public.gtm_reply_stats, public.gtm_enquiries_by_source
--   INFO  rls_enabled_no_policy: public.portal_events, public.staging_directory
-- ---------------------------------------------------------------------------
