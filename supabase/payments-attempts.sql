-- Payment attempt ledger and refund records.
-- Run this entire file in the Supabase SQL Editor only after it has been reviewed.
-- Do not run it from the app, from CI, or against Production until that approval.
--
-- Prerequisites: public.orders (supabase/orders.sql) and public.platform_settings
-- (supabase/demo-checkout.sql). Safe to re-run. Does not change existing order rows.
--
-- Until this file is applied, payment start, confirm, webhook, cancel, and refund
-- fail closed with "רישום התשלומים עדיין לא הופעל."
--
-- Demo captures and demo refunds are simulated. This file rejects a row that claims
-- to be real money. A live provider needs a later migration; it is not added here.
--
-- Refund policy columns are added empty. The app refuses a refund while any of them
-- is null. Do not put a number of days, an approver, or a voucher rule in application
-- code. Set the four columns on the default settings row when the policy is chosen:
--   refund_window_days, refund_approver ('admin', 'guest', or 'none'),
--   refund_allow_partial, refund_blocks_issued_voucher.

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  idempotency_key text not null,
  provider_reference text,
  provider_event_id text,
  kind text not null,
  status text not null,
  amount numeric(12, 2) not null,
  simulated boolean not null,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  provider_reference text not null,
  payment_reference text not null,
  idempotency_key text not null,
  amount numeric(12, 2) not null,
  status text not null,
  simulated boolean not null,
  reason text,
  approver text not null,
  policy_window_days integer not null,
  policy_allow_partial boolean not null,
  policy_blocks_issued_voucher boolean not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_settings
  add column if not exists refund_window_days integer;
alter table public.platform_settings
  add column if not exists refund_approver text;
alter table public.platform_settings
  add column if not exists refund_allow_partial boolean;
alter table public.platform_settings
  add column if not exists refund_blocks_issued_voucher boolean;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_provider_demo'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_provider_demo
      check (provider = 'demo');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_simulated_only'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_simulated_only
      check (simulated);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_demo_reference'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_demo_reference
      check (provider_reference is null or provider_reference like 'demo-%');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_key_length'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_key_length
      check (char_length(idempotency_key) between 1 and 80);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_kind'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_kind
      check (kind in ('start', 'confirm', 'webhook', 'cancel'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_status'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_status
      check (status in ('started', 'succeeded', 'failed', 'cancelled'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_amount_nonnegative'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_amount_nonnegative
      check (amount >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_paid_at_when_succeeded'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_paid_at_when_succeeded
      check (status <> 'succeeded' or paid_at is not null);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_attempts_order_idempotency_key'
      and conrelid = 'public.payment_attempts'::regclass
  ) then
    alter table public.payment_attempts
      add constraint payment_attempts_order_idempotency_key
      unique (order_id, idempotency_key);
  end if;
end;
$$;

create unique index if not exists payment_attempts_provider_reference_uidx
  on public.payment_attempts (provider, provider_reference)
  where provider_reference is not null;

create unique index if not exists payment_attempts_provider_event_uidx
  on public.payment_attempts (provider, provider_event_id)
  where provider_event_id is not null;

create unique index if not exists payment_attempts_one_capture_uidx
  on public.payment_attempts (order_id)
  where status = 'succeeded' and kind in ('confirm', 'webhook');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_provider_demo'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_provider_demo
      check (provider = 'demo');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_simulated_only'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_simulated_only
      check (simulated);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_demo_reference'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_demo_reference
      check (
        provider_reference like 'demo-%'
        and payment_reference like 'demo-%'
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_amount_positive'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_amount_positive
      check (amount > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_status'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_status
      check (status in ('recorded', 'failed'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_approver'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_approver
      check (approver in ('admin', 'guest'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_window_nonnegative'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_window_nonnegative
      check (policy_window_days >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_key_length'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_key_length
      check (char_length(idempotency_key) between 1 and 80);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_reason_length'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_reason_length
      check (reason is null or char_length(reason) <= 200);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_refunds_order_idempotency_key'
      and conrelid = 'public.payment_refunds'::regclass
  ) then
    alter table public.payment_refunds
      add constraint payment_refunds_order_idempotency_key
      unique (order_id, idempotency_key);
  end if;
end;
$$;

create unique index if not exists payment_refunds_provider_reference_uidx
  on public.payment_refunds (provider, provider_reference)
  where provider_reference is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_refund_window_nonnegative'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_refund_window_nonnegative
      check (refund_window_days is null or refund_window_days >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_refund_approver'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_refund_approver
      check (
        refund_approver is null
        or refund_approver in ('admin', 'guest', 'none')
      );
  end if;
end;
$$;

alter table public.payment_attempts enable row level security;
alter table public.payment_refunds enable row level security;

revoke all on table public.payment_attempts from anon, authenticated, public;
revoke all on table public.payment_refunds from anon, authenticated, public;

grant all on table public.payment_attempts to service_role;
grant all on table public.payment_refunds to service_role;

comment on table public.payment_attempts is
  'Demo payment attempts. simulated must stay true. No anon policies.';
comment on table public.payment_refunds is
  'Demo refund records only. No outbound payment call. No anon policies.';
comment on column public.platform_settings.refund_window_days is
  'Refund window in days. Null means refunds are not configured.';
comment on column public.platform_settings.refund_approver is
  'Who may refund: admin, guest, or none. Null means not configured.';
comment on column public.platform_settings.refund_allow_partial is
  'Whether a partial refund is allowed. Null means not configured.';
comment on column public.platform_settings.refund_blocks_issued_voucher is
  'Whether an issued voucher blocks a refund. Null means not configured.';
