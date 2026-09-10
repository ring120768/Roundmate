-- Price book: seed the services table from each business's trade menu,
-- backfill everyone who signed up before the price book existed, and link
-- existing jobs to their service without touching the text on past invoices.
--
-- Safe to run more than once. Every insert is ON CONFLICT DO NOTHING and every
-- DDL statement is IF NOT EXISTS, so a second run is a no-op.
--
-- Run this in the Supabase SQL editor. It is additive only: nothing is
-- deleted, no existing column is rewritten.

begin;

-- ---------------------------------------------------------------------------
-- 1. Make services behave like the rest of the schema
--
-- jobs.business_id already defaults to private.current_business_id(); services
-- did not, so an insert from the app had to set it by hand or fail the RLS
-- check. Same default, same behaviour.
-- ---------------------------------------------------------------------------

alter table public.services
  alter column business_id set default private.current_business_id();

-- Case-insensitive, so a business cannot end up with both "Window cleaning"
-- and "window cleaning" in its price book. ON CONFLICT below must name the
-- same expression for the index to be used.
create unique index if not exists services_business_name_key
  on public.services (business_id, lower(name));

-- ---------------------------------------------------------------------------
-- 2. The trade menus, as data
--
-- GENERATED FROM lib/trades.js on 2026-09-10 - 9 trades, 70 service entries,
-- 56 distinct names (Gutter clearing and Pressure washing appear in 3 trades;
-- Christmas lights and Ironing in 2; Other in all 9).
--
-- This is a seed catalogue, read only when a business is created or changes
-- trade. It is NOT the app's source of truth - lib/trades.js still drives the
-- job form. If you edit one, edit the other, and re-run this file to pick up
-- new entries.
-- ---------------------------------------------------------------------------

create table if not exists public.trade_services (
  trade_key text not null,
  name text not null,
  sort_order int not null,
  primary key (trade_key, name)
);

-- Reference data, identical for every business, so it is readable by anyone
-- signed in and writable by no one through the API.
alter table public.trade_services enable row level security;

drop policy if exists trade_services_select on public.trade_services;
create policy trade_services_select on public.trade_services for select
  to authenticated using (true);

insert into public.trade_services (trade_key, name, sort_order) values
  ('window_cleaning', 'Window cleaning', 0),
  ('window_cleaning', 'Gutter clearing', 1),
  ('window_cleaning', 'Gutter, fascia & soffit wash', 2),
  ('window_cleaning', 'Conservatory roof', 3),
  ('window_cleaning', 'Solar panel cleaning', 4),
  ('window_cleaning', 'Pressure washing', 5),
  ('window_cleaning', 'Christmas lights', 6),
  ('window_cleaning', 'Other', 7),
  ('gardening', 'Grass cutting', 0),
  ('gardening', 'Hedge trimming', 1),
  ('gardening', 'Leaf clearance', 2),
  ('gardening', 'Garden clearance', 3),
  ('gardening', 'Gutter clearing', 4),
  ('gardening', 'Pressure washing', 5),
  ('gardening', 'Fence painting', 6),
  ('gardening', 'Turfing', 7),
  ('gardening', 'Other', 8),
  ('domestic_cleaning', 'Regular clean', 0),
  ('domestic_cleaning', 'Deep clean', 1),
  ('domestic_cleaning', 'End-of-tenancy clean', 2),
  ('domestic_cleaning', 'Oven clean', 3),
  ('domestic_cleaning', 'Carpet cleaning', 4),
  ('domestic_cleaning', 'Holiday-let changeover', 5),
  ('domestic_cleaning', 'Ironing', 6),
  ('domestic_cleaning', 'Other', 7),
  ('oven_cleaning', 'Single oven', 0),
  ('oven_cleaning', 'Double oven', 1),
  ('oven_cleaning', 'Range cooker', 2),
  ('oven_cleaning', 'Aga / Rayburn', 3),
  ('oven_cleaning', 'Hob', 4),
  ('oven_cleaning', 'Extractor', 5),
  ('oven_cleaning', 'Microwave', 6),
  ('oven_cleaning', 'BBQ clean', 7),
  ('oven_cleaning', 'Other', 8),
  ('valeting', 'Exterior wash', 0),
  ('valeting', 'Mini valet', 1),
  ('valeting', 'Full valet', 2),
  ('valeting', 'Interior valet', 3),
  ('valeting', 'Machine polish', 4),
  ('valeting', 'Engine bay', 5),
  ('valeting', 'Caravan / motorhome', 6),
  ('valeting', 'Other', 7),
  ('ironing_laundry', 'Ironing', 0),
  ('ironing_laundry', 'Wash & iron', 1),
  ('ironing_laundry', 'Collection & delivery', 2),
  ('ironing_laundry', 'Other', 3),
  ('pest_control', 'General pest visit', 0),
  ('pest_control', 'Regular contract visit', 1),
  ('pest_control', 'Rodent treatment', 2),
  ('pest_control', 'Wasp / hornet nest', 3),
  ('pest_control', 'Insect treatment', 4),
  ('pest_control', 'Bed bug treatment', 5),
  ('pest_control', 'Bird proofing', 6),
  ('pest_control', 'Other', 7),
  ('locksmith', 'Lock change', 0),
  ('locksmith', 'Lock repair', 1),
  ('locksmith', 'Lockout / gain entry', 2),
  ('locksmith', 'uPVC door mechanism', 3),
  ('locksmith', 'Key cutting', 4),
  ('locksmith', 'Security survey', 5),
  ('locksmith', 'Landlord changeover', 6),
  ('locksmith', 'Other', 7),
  ('handyman', 'General repairs', 0),
  ('handyman', 'Painting & decorating', 1),
  ('handyman', 'Flat-pack assembly', 2),
  ('handyman', 'Fence & gate repair', 3),
  ('handyman', 'Gutter clearing', 4),
  ('handyman', 'Pressure washing', 5),
  ('handyman', 'Christmas lights', 6),
  ('handyman', 'Other', 7)
on conflict (trade_key, name) do update set sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 3. Seeding
--
-- ADDS the trade's services, never replaces. A window cleaner who adds
-- gardening still has window cleaning customers on the books, so removing the
-- old menu would strand them.
--
-- default_price is left null on purpose. Null means "no book price yet", which
-- the job form already handles - the tradesman types the number, exactly as
-- today. Price resolution stays: the job's own price, then the customer's
-- agreed price, then the book.
--
-- SECURITY DEFINER because the trigger below runs as whoever inserted the
-- business, and the services insert policy only lets owners write. The seed is
-- not a user-supplied write, so it should not be judged as one.
-- ---------------------------------------------------------------------------

create or replace function private.seed_services(b_id uuid, p_trade text)
returns int language plpgsql security definer as $$
declare
  added int;
begin
  insert into public.services (business_id, name, sort_order)
  select b_id, ts.name, ts.sort_order
  from public.trade_services ts
  where ts.trade_key = coalesce(p_trade, 'window_cleaning')
  on conflict (business_id, lower(name)) do nothing;

  get diagnostics added = row_count;
  return added;
end
$$;

alter function private.seed_services(uuid, text) set search_path = public, pg_temp;

create or replace function private.seed_services_on_business()
returns trigger language plpgsql security definer as $$
begin
  perform private.seed_services(new.id, new.trade);
  return new;
end
$$;

alter function private.seed_services_on_business() set search_path = public, pg_temp;

-- Fires on creation, and again whenever the trade changes at /trade. Because
-- the seed only ever adds, changing trade grows the price book rather than
-- swapping it.
drop trigger if exists businesses_seed_services on public.businesses;
create trigger businesses_seed_services
  after insert or update of trade on public.businesses
  for each row execute function private.seed_services_on_business();

-- ---------------------------------------------------------------------------
-- 4. Backfill the businesses that already exist
-- ---------------------------------------------------------------------------

insert into public.services (business_id, name, sort_order)
select b.id, ts.name, ts.sort_order
from public.businesses b
join public.trade_services ts
  on ts.trade_key = coalesce(b.trade, 'window_cleaning')
on conflict (business_id, lower(name)) do nothing;

-- Services this business has actually sold that are not in its current trade
-- menu. Real case in the live data: a business now set to pest_control has
-- jobs recorded as "Lock change" and "Window cleaning" from before it switched
-- trade. Without this they would be missing from the price book and the job
-- history would reference services that do not exist.
insert into public.services (business_id, name, sort_order)
select distinct j.business_id, trim(j.service_type), 900
from public.jobs j
where j.service_type is not null and trim(j.service_type) <> ''
on conflict (business_id, lower(name)) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Link jobs to the price book without rewriting them
--
-- jobs.service_type stays exactly as it is - free text, and the wording that
-- appears on the invoice. service_id is added beside it, the same snapshot
-- pattern as billed_to_name: rename a price-book entry and no past invoice
-- changes. Nullable, so the 12 jobs that exist today keep working if the match
-- ever fails.
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists service_id uuid references public.services(id);

create index if not exists jobs_service_id_idx on public.jobs (service_id);

update public.jobs j
set service_id = s.id
from public.services s
where s.business_id = j.business_id
  and lower(s.name) = lower(trim(j.service_type))
  and j.service_id is null;

commit;

-- ---------------------------------------------------------------------------
-- 6. OPTIONAL - suggest prices from history. Do not run this yet.
--
-- The median of what a business has actually charged for a service is a better
-- first offer than a blank box. It is only a suggestion: it fills default_price
-- where the owner has not set one, and never overwrites a price they chose.
--
-- Left commented because the live data today is test data - the medians come
-- out at 1.00 and 20.00. Run it once there is real trading history.
--
-- update public.services s
-- set default_price = m.median_price
-- from (
--   select business_id,
--          lower(trim(service_type)) as name_key,
--          percentile_cont(0.5) within group (order by price) as median_price
--   from public.jobs
--   where price is not null and service_type is not null
--   group by 1, 2
--   having count(*) >= 3
-- ) m
-- where m.business_id = s.business_id
--   and m.name_key = lower(s.name)
--   and s.default_price is null;
-- ---------------------------------------------------------------------------
