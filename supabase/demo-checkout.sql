-- Milestone 3: demo checkout, guest service fee, and payment fields.
-- Run this entire file in the Supabase SQL Editor. Safe to re-run.
--
-- When to run it:
--   1. After supabase/orders.sql (public.orders and public.order_items exist).
--   2. Alongside the rest of the database used by M1 and M2. This file does not
--      read or modify supabase/stores-admin-fields.sql or supabase/custom-gifts.sql.
--   3. Before or together with the Milestone 3 deploy. Until it has been applied,
--      checkout and fee settings fail with a server log and a generic Hebrew message.
--
-- Does not drop columns or rows, does not change existing payment_status values,
-- and does not change RLS or grants on events, gifts, orders, or stores.
-- total_amount stays the gift contribution. Null fee on a legacy row means 0.

alter table public.orders add column if not exists fee_amount numeric not null default 0;
alter table public.orders add column if not exists charged_amount numeric;
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists paid_at timestamptz;

update public.orders
set charged_amount = coalesce(total_amount, 0) + coalesce(fee_amount, 0)
where charged_amount is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_fee_amount_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_fee_amount_nonnegative
      check (fee_amount >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_charged_amount_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_charged_amount_nonnegative
      check (charged_amount is null or charged_amount >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_provider_length'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_provider_length
      check (
        payment_provider is null
        or (char_length(payment_provider) between 1 and 40)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_reference_length'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_reference_length
      check (
        payment_reference is null
        or (char_length(payment_reference) between 1 and 80)
      );
  end if;
end;
$$;

comment on column public.orders.total_amount is
  'Gift contribution only. Does not include the guest service fee.';
comment on column public.orders.fee_amount is
  'Guest service fee charged at checkout. Legacy rows are 0.';
comment on column public.orders.charged_amount is
  'Amount charged to the guest (contribution + fee). Null means total_amount + fee_amount.';
comment on column public.orders.payment_provider is
  'Payment provider that confirmed the order. demo is not real money.';
comment on column public.orders.payment_reference is
  'Provider payment reference. Demo references are prefixed with demo-.';
comment on column public.orders.paid_at is
  'When the order first became paid. Not overwritten by a repeated confirmation.';

create index if not exists orders_event_payment_status_idx
  on public.orders (event_id, payment_status);

create table if not exists public.platform_settings (
  id text primary key,
  guest_fee_enabled boolean not null default false,
  guest_fee_percent numeric(5, 2) not null default 0,
  guest_fee_fixed numeric(12, 2) not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_settings
  add column if not exists guest_fee_enabled boolean not null default false;
alter table public.platform_settings
  add column if not exists guest_fee_percent numeric(5, 2) not null default 0;
alter table public.platform_settings
  add column if not exists guest_fee_fixed numeric(12, 2) not null default 0;
alter table public.platform_settings
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_single_row'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_single_row
      check (id = 'default');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_guest_fee_percent_range'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_guest_fee_percent_range
      check (guest_fee_percent >= 0 and guest_fee_percent <= 100);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_guest_fee_fixed_nonnegative'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_guest_fee_fixed_nonnegative
      check (guest_fee_fixed >= 0);
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row
execute procedure public.set_updated_at();

insert into public.platform_settings (
  id,
  guest_fee_enabled,
  guest_fee_percent,
  guest_fee_fixed
)
values ('default', false, 0, 0)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "No direct access to platform settings" on public.platform_settings;
create policy "No direct access to platform settings"
  on public.platform_settings
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.platform_settings from anon, authenticated, public;
grant all on table public.platform_settings to service_role;

comment on table public.platform_settings is
  'LOLO platform settings. Guest fee defaults to off. No anon access.';
