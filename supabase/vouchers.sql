-- Milestone 4: gift vouchers and in-store redemption.
-- Run this entire file in the Supabase SQL Editor. Safe to re-run.
--
-- When to run it:
--   After supabase/demo-checkout.sql.
--   The earlier files this depends on are already required by that stack:
--   orders.sql (orders, order_items), stores.sql, stores-admin-fields.sql
--   (commission_percent, payment_terms_days, voucher term columns), and
--   event-gifts-store.sql (event_gifts.store_id).
--   This file does not modify those files and does not change their RLS.
--
-- Until it has been applied, voucher routes fail with a server log and a
-- generic Hebrew message. Nothing here is executed by the app deploy.
--
-- Issuance is race-safe: issue_gift_voucher locks per gift, and a BEFORE
-- INSERT trigger takes the same lock and rejects an amount above the paid
-- contribution that is not already on a non-cancelled voucher.
-- Paid amount is the sum of paid order_items.amount. Guest fees are not read.
-- A voucher may be issued below the gift target. Later paid contributions
-- stay available for another voucher. Cancelled vouchers with no redemption
-- release their amount. Expired vouchers do not.
--
-- Settlement (next milestone) can sum public.redemptions.amount per store_id
-- where settlement_status is not SETTLED, then apply the snapshotted
-- commission_percent and payment_terms_days (or the live store columns).

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  gift_id uuid not null references public.event_gifts (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  code text not null,
  code_key text generated always as (replace(upper(code), '-', '')) stored,
  qr_secret text not null,
  view_token text not null,
  amount numeric not null,
  remaining_amount numeric not null,
  status text not null default 'ISSUED',
  issued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  idempotency_key uuid not null,
  event_title text not null default '',
  gift_title text not null default '',
  store_name text not null default '',
  store_logo_url text,
  validity_days integer not null,
  allow_partial_redemption boolean not null,
  allow_customer_topup boolean not null,
  redemption_method text not null,
  validity_is_default boolean not null default false,
  partial_is_default boolean not null default false,
  topup_is_default boolean not null default false,
  method_is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.vouchers add column if not exists event_id uuid;
alter table public.vouchers add column if not exists gift_id uuid;
alter table public.vouchers add column if not exists store_id uuid;
alter table public.vouchers add column if not exists code text;
alter table public.vouchers add column if not exists qr_secret text;
alter table public.vouchers add column if not exists view_token text;
alter table public.vouchers add column if not exists amount numeric;
alter table public.vouchers add column if not exists remaining_amount numeric;
alter table public.vouchers add column if not exists status text;
alter table public.vouchers add column if not exists issued_at timestamptz;
alter table public.vouchers add column if not exists expires_at timestamptz;
alter table public.vouchers add column if not exists idempotency_key uuid;
alter table public.vouchers add column if not exists event_title text;
alter table public.vouchers add column if not exists gift_title text;
alter table public.vouchers add column if not exists store_name text;
alter table public.vouchers add column if not exists store_logo_url text;
alter table public.vouchers add column if not exists validity_days integer;
alter table public.vouchers add column if not exists allow_partial_redemption boolean;
alter table public.vouchers add column if not exists allow_customer_topup boolean;
alter table public.vouchers add column if not exists redemption_method text;
alter table public.vouchers add column if not exists validity_is_default boolean;
alter table public.vouchers add column if not exists partial_is_default boolean;
alter table public.vouchers add column if not exists topup_is_default boolean;
alter table public.vouchers add column if not exists method_is_default boolean;
alter table public.vouchers add column if not exists created_at timestamptz;
alter table public.vouchers add column if not exists updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vouchers'
      and column_name = 'code_key'
  ) then
    alter table public.vouchers
      add column code_key text generated always as (replace(upper(code), '-', '')) stored;
  end if;
end;
$$;

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  amount numeric not null,
  redeemed_at timestamptz not null default timezone('utc', now()),
  channel text not null,
  redeemed_by text not null,
  reference text,
  commission_percent_snapshot numeric(5, 2),
  payment_terms_days_snapshot integer,
  settlement_status text not null default 'UNSETTLED',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.redemptions add column if not exists voucher_id uuid;
alter table public.redemptions add column if not exists store_id uuid;
alter table public.redemptions add column if not exists amount numeric;
alter table public.redemptions add column if not exists redeemed_at timestamptz;
alter table public.redemptions add column if not exists channel text;
alter table public.redemptions add column if not exists redeemed_by text;
alter table public.redemptions add column if not exists reference text;
alter table public.redemptions add column if not exists commission_percent_snapshot numeric(5, 2);
alter table public.redemptions add column if not exists payment_terms_days_snapshot integer;
alter table public.redemptions add column if not exists settlement_status text;
alter table public.redemptions add column if not exists created_at timestamptz;
alter table public.redemptions add column if not exists updated_at timestamptz;

create table if not exists public.store_redemption_access (
  store_id uuid primary key references public.stores (id) on delete cascade,
  code_hash text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.store_redemption_access add column if not exists code_hash text;
alter table public.store_redemption_access add column if not exists updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_code_unique' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers add constraint vouchers_code_unique unique (code);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_code_key_unique' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers add constraint vouchers_code_key_unique unique (code_key);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_view_token_unique' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers add constraint vouchers_view_token_unique unique (view_token);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_gift_idempotency_unique' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_gift_idempotency_unique unique (gift_id, idempotency_key);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_amount_positive' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_amount_positive check (amount > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_remaining_nonnegative' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_remaining_nonnegative check (remaining_amount >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_remaining_lte_amount' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_remaining_lte_amount check (remaining_amount <= amount);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_status_values' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_status_values check (
        status in (
          'ISSUED',
          'PARTIALLY_REDEEMED',
          'REDEEMED',
          'EXPIRED',
          'CANCELLED',
          'SETTLEMENT_PENDING',
          'SETTLED'
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_code_format' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_code_format
      check (code ~ '^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_secret_length' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_secret_length
      check (
        char_length(qr_secret) between 32 and 80
        and char_length(view_token) between 32 and 80
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_validity_days_range' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_validity_days_range
      check (validity_days >= 1 and validity_days <= 3650);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_redemption_method_length' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_redemption_method_length
      check (
        char_length(btrim(redemption_method)) > 0
        and char_length(redemption_method) <= 80
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_title_length' and conrelid = 'public.vouchers'::regclass
  ) then
    alter table public.vouchers
      add constraint vouchers_title_length
      check (
        char_length(event_title) <= 200
        and char_length(gift_title) <= 200
        and char_length(store_name) <= 120
        and (store_logo_url is null or char_length(store_logo_url) <= 500)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'redemptions_amount_positive' and conrelid = 'public.redemptions'::regclass
  ) then
    alter table public.redemptions
      add constraint redemptions_amount_positive check (amount > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'redemptions_channel_values' and conrelid = 'public.redemptions'::regclass
  ) then
    alter table public.redemptions
      add constraint redemptions_channel_values check (channel in ('store', 'admin'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'redemptions_actor_length' and conrelid = 'public.redemptions'::regclass
  ) then
    alter table public.redemptions
      add constraint redemptions_actor_length
      check (
        char_length(btrim(redeemed_by)) > 0
        and char_length(redeemed_by) <= 80
        and (reference is null or (char_length(btrim(reference)) > 0 and char_length(reference) <= 80))
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'redemptions_settlement_status_values' and conrelid = 'public.redemptions'::regclass
  ) then
    alter table public.redemptions
      add constraint redemptions_settlement_status_values check (
        settlement_status in ('UNSETTLED', 'SETTLEMENT_PENDING', 'SETTLED')
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'redemptions_commission_snapshot_range' and conrelid = 'public.redemptions'::regclass
  ) then
    alter table public.redemptions
      add constraint redemptions_commission_snapshot_range check (
        commission_percent_snapshot is null
        or (commission_percent_snapshot >= 0 and commission_percent_snapshot <= 100)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'redemptions_terms_snapshot_range' and conrelid = 'public.redemptions'::regclass
  ) then
    alter table public.redemptions
      add constraint redemptions_terms_snapshot_range check (
        payment_terms_days_snapshot is null
        or (payment_terms_days_snapshot >= 0 and payment_terms_days_snapshot <= 3650)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'store_redemption_access_hash_length'
      and conrelid = 'public.store_redemption_access'::regclass
  ) then
    alter table public.store_redemption_access
      add constraint store_redemption_access_hash_length
      check (char_length(code_hash) between 20 and 300);
  end if;
end;
$$;

create index if not exists vouchers_event_issued_idx
  on public.vouchers (event_id, issued_at desc);
create index if not exists vouchers_gift_id_idx
  on public.vouchers (gift_id);
create index if not exists vouchers_store_status_idx
  on public.vouchers (store_id, status);
create index if not exists vouchers_expires_at_idx
  on public.vouchers (expires_at);
create index if not exists redemptions_voucher_id_idx
  on public.redemptions (voucher_id, redeemed_at);
create index if not exists redemptions_store_settlement_idx
  on public.redemptions (store_id, settlement_status, redeemed_at);

create or replace function public.vouchers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists vouchers_set_updated_at on public.vouchers;
create trigger vouchers_set_updated_at
before update on public.vouchers
for each row
execute procedure public.vouchers_set_updated_at();

drop trigger if exists redemptions_set_updated_at on public.redemptions;
create trigger redemptions_set_updated_at
before update on public.redemptions
for each row
execute procedure public.vouchers_set_updated_at();

create or replace function public.voucher_paid_amount(p_gift_id uuid, p_event_id uuid)
returns numeric
language sql
volatile
security definer
set search_path = public
as $$
  select coalesce(round(sum(oi.amount)::numeric, 2), 0)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.gift_id = p_gift_id
    and o.event_id = p_event_id
    and o.payment_status = 'paid'
    and oi.amount > 0;
$$;

create or replace function public.voucher_committed_amount(
  p_gift_id uuid,
  p_except_id uuid default null
)
returns numeric
language sql
volatile
security definer
set search_path = public
as $$
  select coalesce(round(sum(v.amount)::numeric, 2), 0)
  from public.vouchers v
  where v.gift_id = p_gift_id
    and v.status <> 'CANCELLED'
    and (p_except_id is null or v.id <> p_except_id);
$$;

create or replace function public.voucher_issue_payload(
  p_id uuid,
  p_amount numeric,
  p_remaining numeric,
  p_status text,
  p_idempotent boolean
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_id,
    'amount', p_amount,
    'remainingAmount', p_remaining,
    'status', p_status,
    'idempotent', p_idempotent
  );
$$;

create or replace function public.vouchers_guard_issue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available numeric;
begin
  if tg_op = 'UPDATE' then
    if new.amount is distinct from old.amount
      or new.event_id is distinct from old.event_id
      or new.gift_id is distinct from old.gift_id
      or new.store_id is distinct from old.store_id
      or new.code is distinct from old.code
      or new.qr_secret is distinct from old.qr_secret
      or new.view_token is distinct from old.view_token
      or new.idempotency_key is distinct from old.idempotency_key
      or new.issued_at is distinct from old.issued_at
      or new.expires_at is distinct from old.expires_at
    then
      raise exception 'voucher_immutable';
    end if;

    if new.remaining_amount > old.remaining_amount then
      raise exception 'voucher_amount_invalid';
    end if;

    if old.status = 'CANCELLED' and new.status is distinct from 'CANCELLED' then
      raise exception 'voucher_status_invalid';
    end if;

    if old.status = 'REDEEMED'
      and new.status not in ('REDEEMED', 'SETTLEMENT_PENDING', 'SETTLED') then
      raise exception 'voucher_status_invalid';
    end if;

    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('lolo-voucher-gift'),
    hashtext(new.gift_id::text)
  );

  available := round(
    public.voucher_paid_amount(new.gift_id, new.event_id)
      - public.voucher_committed_amount(new.gift_id, new.id),
    2
  );

  if new.status is distinct from 'CANCELLED' and round(new.amount, 2) > available then
    raise exception 'voucher_over_issue';
  end if;

  return new;
end;
$$;

drop trigger if exists vouchers_guard_issue on public.vouchers;
create trigger vouchers_guard_issue
before insert or update on public.vouchers
for each row
execute procedure public.vouchers_guard_issue();

create or replace function public.vouchers_block_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'voucher_delete_blocked';
end;
$$;

drop trigger if exists vouchers_block_delete on public.vouchers;
create trigger vouchers_block_delete
before delete on public.vouchers
for each row
execute procedure public.vouchers_block_delete();

drop trigger if exists redemptions_block_delete on public.redemptions;
create trigger redemptions_block_delete
before delete on public.redemptions
for each row
execute procedure public.vouchers_block_delete();

create or replace function public.redemptions_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.amount is distinct from old.amount
    or new.voucher_id is distinct from old.voucher_id
    or new.store_id is distinct from old.store_id
    or new.redeemed_at is distinct from old.redeemed_at
    or new.channel is distinct from old.channel
    or new.redeemed_by is distinct from old.redeemed_by
    or new.reference is distinct from old.reference
    or new.commission_percent_snapshot is distinct from old.commission_percent_snapshot
    or new.payment_terms_days_snapshot is distinct from old.payment_terms_days_snapshot
  then
    raise exception 'redemption_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists redemptions_guard_update on public.redemptions;
create trigger redemptions_guard_update
before update on public.redemptions
for each row
execute procedure public.redemptions_guard_update();

create or replace function public.issue_gift_voucher(
  p_event_id uuid,
  p_gift_id uuid,
  p_store_id uuid,
  p_code text,
  p_qr_secret text,
  p_view_token text,
  p_idempotency_key uuid,
  p_validity_days integer,
  p_allow_partial boolean,
  p_allow_topup boolean,
  p_redemption_method text,
  p_validity_is_default boolean,
  p_partial_is_default boolean,
  p_topup_is_default boolean,
  p_method_is_default boolean,
  p_expected_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gift_title text;
  gift_event uuid;
  gift_store uuid;
  event_title text;
  linked_active boolean;
  store_name text;
  store_logo text;
  store_active boolean;
  paid numeric;
  committed numeric;
  available numeric;
  issued_at timestamptz;
  expires_at timestamptz;
  created_id uuid;
  existing public.vouchers%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtext('lolo-voucher-gift'),
    hashtext(p_gift_id::text)
  );

  select g.title, g.event_id, g.store_id, e.title
    into gift_title, gift_event, gift_store, event_title
  from public.event_gifts g
  join public.events e on e.id = g.event_id
  where g.id = p_gift_id;

  if gift_event is null or gift_event <> p_event_id then
    raise exception 'voucher_gift_not_found';
  end if;

  select *
    into existing
  from public.vouchers
  where gift_id = p_gift_id
    and idempotency_key = p_idempotency_key;

  if found then
    return public.voucher_issue_payload(
      existing.id,
      existing.amount,
      existing.remaining_amount,
      existing.status,
      true
    );
  end if;

  select s.name, s.logo_url, s.active
    into store_name, store_logo, store_active
  from public.stores s
  where s.id = p_store_id;

  if store_active is distinct from true then
    raise exception 'voucher_store_inactive';
  end if;

  if gift_store is not null then
    select s.active
      into linked_active
    from public.stores s
    where s.id = gift_store;

    if linked_active is true and gift_store <> p_store_id then
      raise exception 'voucher_store_mismatch';
    end if;
  end if;

  if p_validity_days is null
    or p_validity_days < 1
    or p_validity_days > 3650
    or p_allow_partial is null
    or p_allow_topup is null
    or p_redemption_method is null
    or char_length(btrim(p_redemption_method)) = 0
    or char_length(p_redemption_method) > 80
    or p_code is null
    or p_code !~ '^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$'
    or p_qr_secret is null
    or char_length(p_qr_secret) < 32
    or char_length(p_qr_secret) > 80
    or p_view_token is null
    or char_length(p_view_token) < 32
    or char_length(p_view_token) > 80
  then
    raise exception 'voucher_terms_invalid';
  end if;

  paid := public.voucher_paid_amount(p_gift_id, p_event_id);
  committed := public.voucher_committed_amount(p_gift_id, null);
  available := round(paid - committed, 2);

  if available <= 0 then
    raise exception 'voucher_none_available';
  end if;

  if p_expected_amount is not null and round(p_expected_amount, 2) <> available then
    raise exception 'voucher_amount_changed';
  end if;

  issued_at := timezone('utc', now());
  expires_at := issued_at + make_interval(days => p_validity_days);

  begin
    insert into public.vouchers (
      event_id,
      gift_id,
      store_id,
      code,
      qr_secret,
      view_token,
      amount,
      remaining_amount,
      status,
      issued_at,
      expires_at,
      idempotency_key,
      event_title,
      gift_title,
      store_name,
      store_logo_url,
      validity_days,
      allow_partial_redemption,
      allow_customer_topup,
      redemption_method,
      validity_is_default,
      partial_is_default,
      topup_is_default,
      method_is_default
    )
    values (
      p_event_id,
      p_gift_id,
      p_store_id,
      p_code,
      p_qr_secret,
      p_view_token,
      available,
      available,
      'ISSUED',
      issued_at,
      expires_at,
      p_idempotency_key,
      left(coalesce(event_title, ''), 200),
      left(coalesce(gift_title, ''), 200),
      left(coalesce(store_name, ''), 120),
      nullif(left(btrim(coalesce(store_logo, '')), 500), ''),
      p_validity_days,
      p_allow_partial,
      p_allow_topup,
      btrim(p_redemption_method),
      coalesce(p_validity_is_default, false),
      coalesce(p_partial_is_default, false),
      coalesce(p_topup_is_default, false),
      coalesce(p_method_is_default, false)
    )
    returning id into created_id;
  exception
    when unique_violation then
      select *
        into existing
      from public.vouchers
      where gift_id = p_gift_id
        and idempotency_key = p_idempotency_key;

      if found then
        return public.voucher_issue_payload(
          existing.id,
          existing.amount,
          existing.remaining_amount,
          existing.status,
          true
        );
      end if;

      raise exception 'voucher_code_collision';
  end;

  return public.voucher_issue_payload(created_id, available, available, 'ISSUED', false);
end;
$$;

create or replace function public.redeem_voucher(
  p_store_id uuid,
  p_channel text,
  p_redeemed_by text,
  p_amount numeric,
  p_reference text,
  p_voucher_id uuid default null,
  p_code text default null,
  p_qr_secret text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  voucher public.vouchers%rowtype;
  normalized text;
  redeem_amount numeric;
  new_remaining numeric;
  new_status text;
  clean_reference text;
  commission numeric;
  terms_days integer;
  redemption_id uuid;
begin
  if p_channel not in ('store', 'admin')
    or p_redeemed_by is null
    or char_length(btrim(p_redeemed_by)) = 0
    or char_length(p_redeemed_by) > 80
  then
    raise exception 'voucher_terms_invalid';
  end if;

  if p_voucher_id is not null then
    select *
      into voucher
    from public.vouchers
    where id = p_voucher_id
    for update;
  else
    normalized := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    if char_length(normalized) < 8 then
      raise exception 'voucher_not_found';
    end if;

    select *
      into voucher
    from public.vouchers
    where code_key = normalized
    for update;
  end if;

  if voucher.id is null or voucher.store_id <> p_store_id then
    raise exception 'voucher_not_found';
  end if;

  if coalesce(btrim(p_qr_secret), '') <> ''
    and p_qr_secret is distinct from voucher.qr_secret then
    raise exception 'voucher_not_found';
  end if;

  if voucher.status in ('REDEEMED', 'CANCELLED', 'EXPIRED', 'SETTLED', 'SETTLEMENT_PENDING') then
    raise exception 'voucher_closed';
  end if;

  if voucher.status not in ('ISSUED', 'PARTIALLY_REDEEMED') then
    raise exception 'voucher_closed';
  end if;

  if voucher.expires_at <= timezone('utc', now()) then
    raise exception 'voucher_expired';
  end if;

  if p_amount is null then
    redeem_amount := round(voucher.remaining_amount, 2);
  else
    redeem_amount := round(p_amount, 2);
  end if;

  if redeem_amount <= 0 or redeem_amount > round(voucher.remaining_amount, 2) then
    raise exception 'voucher_amount_invalid';
  end if;

  if voucher.allow_partial_redemption is distinct from true
    and redeem_amount <> round(voucher.remaining_amount, 2) then
    raise exception 'voucher_partial_disabled';
  end if;

  clean_reference := nullif(btrim(coalesce(p_reference, '')), '');
  if clean_reference is not null and char_length(clean_reference) > 80 then
    raise exception 'voucher_reference_invalid';
  end if;

  select s.commission_percent, s.payment_terms_days
    into commission, terms_days
  from public.stores s
  where s.id = voucher.store_id;

  insert into public.redemptions (
    voucher_id,
    store_id,
    amount,
    channel,
    redeemed_by,
    reference,
    commission_percent_snapshot,
    payment_terms_days_snapshot,
    settlement_status
  )
  values (
    voucher.id,
    voucher.store_id,
    redeem_amount,
    p_channel,
    btrim(p_redeemed_by),
    clean_reference,
    commission,
    terms_days,
    'UNSETTLED'
  )
  returning id into redemption_id;

  new_remaining := round(voucher.remaining_amount - redeem_amount, 2);
  new_status := case when new_remaining = 0 then 'REDEEMED' else 'PARTIALLY_REDEEMED' end;

  update public.vouchers
  set remaining_amount = new_remaining,
      status = new_status
  where id = voucher.id;

  return jsonb_build_object(
    'redemptionId', redemption_id,
    'voucherId', voucher.id,
    'amount', redeem_amount,
    'remainingAmount', new_remaining,
    'status', new_status
  );
end;
$$;

create or replace function public.cancel_voucher(p_voucher_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  voucher public.vouchers%rowtype;
begin
  select *
    into voucher
  from public.vouchers
  where id = p_voucher_id
  for update;

  if voucher.id is null then
    raise exception 'voucher_not_found';
  end if;

  if voucher.status = 'CANCELLED' then
    return public.voucher_issue_payload(
      voucher.id,
      voucher.amount,
      voucher.remaining_amount,
      voucher.status,
      true
    );
  end if;

  if voucher.status not in ('ISSUED', 'PARTIALLY_REDEEMED')
    or exists (
      select 1 from public.redemptions r where r.voucher_id = voucher.id
    )
    or round(voucher.remaining_amount, 2) <> round(voucher.amount, 2)
  then
    raise exception 'voucher_cancel_blocked';
  end if;

  update public.vouchers
  set status = 'CANCELLED',
      remaining_amount = 0
  where id = voucher.id;

  return public.voucher_issue_payload(voucher.id, voucher.amount, 0, 'CANCELLED', false);
end;
$$;

comment on table public.vouchers is
  'Host-issued store voucher. amount is the paid gift contribution that was still unvouchered at issuance. Target is not a cap.';
comment on column public.vouchers.amount is
  'Issued shekel amount. Equals paid contributions not already on another non-cancelled voucher.';
comment on column public.vouchers.remaining_amount is
  'Unredeemed balance. Partial redemption is allowed only when allow_partial_redemption was snapshotted true.';
comment on column public.vouchers.view_token is
  'Unguessable capability for the printable voucher page. Not the redemption code.';
comment on column public.vouchers.qr_secret is
  'Separate secret embedded in the QR payload. Typed redemption uses the code alone.';
comment on table public.redemptions is
  'Store or admin redemption. Next settlement pass groups by store_id and settlement_status, using commission_percent_snapshot and payment_terms_days_snapshot.';
comment on column public.redemptions.settlement_status is
  'UNSETTLED until the settlement milestone moves a row to SETTLEMENT_PENDING or SETTLED.';

alter table public.vouchers enable row level security;
alter table public.redemptions enable row level security;
alter table public.store_redemption_access enable row level security;

drop policy if exists "No direct access to vouchers" on public.vouchers;
create policy "No direct access to vouchers"
  on public.vouchers
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct access to redemptions" on public.redemptions;
create policy "No direct access to redemptions"
  on public.redemptions
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct access to store redemption codes" on public.store_redemption_access;
create policy "No direct access to store redemption codes"
  on public.store_redemption_access
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.vouchers from anon, authenticated, public;
revoke all on table public.redemptions from anon, authenticated, public;
revoke all on table public.store_redemption_access from anon, authenticated, public;

grant all on table public.vouchers to service_role;
grant all on table public.redemptions to service_role;
grant all on table public.store_redemption_access to service_role;

do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'voucher_paid_amount',
        'voucher_committed_amount',
        'voucher_issue_payload',
        'vouchers_guard_issue',
        'vouchers_block_delete',
        'vouchers_set_updated_at',
        'redemptions_guard_update',
        'issue_gift_voucher',
        'redeem_voucher',
        'cancel_voucher'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
