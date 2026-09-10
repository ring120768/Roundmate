-- "My accountant" — where the accounts export gets sent, and how often.
-- Run this in the Supabase SQL editor before deploying.

alter table public.businesses
  add column if not exists accountant_name text,
  add column if not exists accountant_email text,
  add column if not exists accountant_frequency text not null default 'off',
  add column if not exists accountant_last_sent_at timestamptz;

-- Only three settings are valid. Added separately so re-running is safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_accountant_frequency_check'
  ) then
    alter table public.businesses
      add constraint businesses_accountant_frequency_check
      check (accountant_frequency in ('off', 'monthly', 'quarterly'));
  end if;
end $$;

comment on column public.businesses.accountant_email is
  'Where the accounts CSV is emailed. Null = feature off.';
comment on column public.businesses.accountant_frequency is
  'off | monthly | quarterly — read by /api/cron/accountant-report on the 1st.';

-- The send is logged to `messages` with message_type = ''accounts''. If that
-- column has a CHECK constraint listing the allowed types, add it there too,
-- e.g.:
--   alter table public.messages drop constraint messages_message_type_check;
--   alter table public.messages add constraint messages_message_type_check
--     check (message_type in ('invoice','receipt','confirmation','reminder','accounts'));
-- The app treats the log as best-effort, so a missing type never blocks a send.
