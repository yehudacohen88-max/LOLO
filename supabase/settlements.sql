-- Milestone 5: store settlements for redeemed vouchers.
-- Run this entire file in the Supabase SQL Editor. Safe to re-run.
--
-- When to run it:
--   After supabase/vouchers.sql.
--   Does not edit earlier files, does not change their RLS, and does not
--   delete rows. Until it has been applied, settlement screens fail with a
--   server log and a Hebrew message. Nothing here runs on deploy.
--
-- Grouping: an admin creates one settlement for one store. That batch takes
-- every redemption for the store that is still UNSETTLED. A repeated request
-- with the same idempotency key returns the original settlement.
--
-- Money: each line uses the redemption's snapshotted commission percent.
-- Commission is round(gross * percent / 100, 2), half away from zero.
-- Payable is gross minus that commission, so the two always sum to the gross.
-- A null commission snapshot is 0%. Guest fees are not stored here. They
-- belong to paid orders, and LOLO revenue is guest fees plus these commissions.
-- This matches lib/settlements/money.ts.
--
-- Due date: redemption time plus the snapshotted payment_terms_days, as whole
-- UTC days (24 hours). A null terms snapshot is 0 days. The settlement due
-- date is the earliest line due date, so a late batch does not extend terms.
--
-- A redemption can sit on only one open line (partial unique index). Cancelling
-- a PENDING settlement releases its lines and returns those redemptions to
-- UNSETTLED. Marking PAID records paid_at, a reference, and the method, and
-- moves the redemptions to SETTLED. Fully redeemed vouchers follow:
-- SETTLEMENT_PENDING while any redemption is still pending, SETTLED when all
-- are settled, and back to REDEEMED if a pending batch is cancelled.

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  status text not null default 'PENDING',
  idempotency_key uuid not null,
  store_name text not null default '',
  settlement_method text,
  gross_amount numeric(14, 2) not null,
  commission_amount numeric(14, 2) not null,
  payable_amount numeric(14, 2) not null,
  due_at timestamptz not null,
  paid_at timestamptz,
  payment_reference text,
  payment_method text,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.settlements add column if not exists store_id uuid;
alter table public.settlements add column if not exists status text;
alter table public.settlements add column if not exists idempotency_key uuid;
alter table public.settlements add column if not exists store_name text;
alter table public.settlements add column if not exists settlement_method text;
alter table public.settlements add column if not exists gross_amount numeric(14, 2);
alter table public.settlements add column if not exists commission_amount numeric(14, 2);
alter table public.settlements add column if not exists payable_amount numeric(14, 2);
alter table public.settlements add column if not exists due_at timestamptz;
alter table public.settlements add column if not exists paid_at timestamptz;
alter table public.settlements add column if not exists payment_reference text;
alter table public.settlements add column if not exists payment_method text;
alter table public.settlements add column if not exists cancelled_at timestamptz;
alter table public.settlements add column if not exists created_at timestamptz;
alter table public.settlements add column if not exists updated_at timestamptz;

create table if not exists public.settlement_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete restrict,
  redemption_id uuid not null references public.redemptions (id) on delete restrict,
  voucher_id uuid not null references public.vouchers (id) on delete restrict,
  gross_amount numeric(14, 2) not null,
  commission_percent numeric(5, 2) not null,
  commission_specified boolean not null default false,
  commission_amount numeric(14, 2) not null,
  payable_amount numeric(14, 2) not null,
  payment_terms_days integer not null,
  terms_specified boolean not null default false,
  redeemed_at timestamptz not null,
  due_at timestamptz not null,
  voucher_code text not null default '',
  gift_title text not null default '',
  event_title text not null default '',
  released_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.settlement_lines add column if not exists settlement_id uuid;
alter table public.settlement_lines add column if not exists redemption_id uuid;
alter table public.settlement_lines add column if not exists voucher_id uuid;
alter table public.settlement_lines add column if not exists gross_amount numeric(14, 2);
alter table public.settlement_lines add column if not exists commission_percent numeric(5, 2);
alter table public.settlement_lines add column if not exists commission_specified boolean;
alter table public.settlement_lines add column if not exists commission_amount numeric(14, 2);
alter table public.settlement_lines add column if not exists payable_amount numeric(14, 2);
alter table public.settlement_lines add column if not exists payment_terms_days integer;
alter table public.settlement_lines add column if not exists terms_specified boolean;
alter table public.settlement_lines add column if not exists redeemed_at timestamptz;
alter table public.settlement_lines add column if not exists due_at timestamptz;
alter table public.settlement_lines add column if not exists voucher_code text;
alter table public.settlement_lines add column if not exists gift_title text;
alter table public.settlement_lines add column if not exists event_title text;
alter table public.settlement_lines add column if not exists released_at timestamptz;
alter table public.settlement_lines add column if not exists created_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_status_values' and conrelid = 'public.settlements'::regclass
  ) then
    alter table public.settlements
      add constraint settlements_status_values
      check (status in ('PENDING', 'PAID', 'CANCELLED'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_amounts_balance' and conrelid = 'public.settlements'::regclass
  ) then
    alter table public.settlements
      add constraint settlements_amounts_balance
      check (
        gross_amount > 0
        and commission_amount >= 0
        and payable_amount >= 0
        and commission_amount + payable_amount = gross_amount
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_name_length' and conrelid = 'public.settlements'::regclass
  ) then
    alter table public.settlements
      add constraint settlements_name_length
      check (char_length(store_name) <= 120);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_method_values' and conrelid = 'public.settlements'::regclass
  ) then
    alter table public.settlements
      add constraint settlements_method_values
      check (
        (
          settlement_method is null
          or settlement_method in ('bank_transfer', 'invoice', 'manual', 'other')
        )
        and (
          payment_method is null
          or payment_method in ('bank_transfer', 'invoice', 'manual', 'other')
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_reference_length' and conrelid = 'public.settlements'::regclass
  ) then
    alter table public.settlements
      add constraint settlements_reference_length
      check (
        payment_reference is null
        or (char_length(btrim(payment_reference)) > 0 and char_length(payment_reference) <= 80)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_lifecycle' and conrelid = 'public.settlements'::regclass
  ) then
    alter table public.settlements
      add constraint settlements_lifecycle
      check (
        (
          status = 'PENDING'
          and paid_at is null
          and cancelled_at is null
          and payment_method is null
          and payment_reference is null
        )
        or (
          status = 'PAID'
          and paid_at is not null
          and cancelled_at is null
          and payment_method is not null
        )
        or (
          status = 'CANCELLED'
          and cancelled_at is not null
          and paid_at is null
          and payment_method is null
          and payment_reference is null
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlement_lines_amounts_balance'
      and conrelid = 'public.settlement_lines'::regclass
  ) then
    alter table public.settlement_lines
      add constraint settlement_lines_amounts_balance
      check (
        gross_amount > 0
        and commission_amount >= 0
        and payable_amount >= 0
        and commission_amount + payable_amount = gross_amount
        and commission_percent >= 0
        and commission_percent <= 100
        and payment_terms_days >= 0
        and payment_terms_days <= 3650
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlement_lines_text_length'
      and conrelid = 'public.settlement_lines'::regclass
  ) then
    alter table public.settlement_lines
      add constraint settlement_lines_text_length
      check (
        char_length(voucher_code) <= 32
        and char_length(gift_title) <= 200
        and char_length(event_title) <= 200
      );
  end if;
end;
$$;

create unique index if not exists settlements_store_idempotency_idx
  on public.settlements (store_id, idempotency_key);

create unique index if not exists settlement_lines_active_redemption_idx
  on public.settlement_lines (redemption_id)
  where released_at is null;

create index if not exists settlements_store_status_due_idx
  on public.settlements (store_id, status, due_at);

create index if not exists settlements_status_due_idx
  on public.settlements (status, due_at);

create index if not exists settlement_lines_settlement_id_idx
  on public.settlement_lines (settlement_id, redeemed_at);

create or replace function public.settlement_split(p_gross numeric, p_percent numeric)
returns table (
  gross_amount numeric,
  commission_amount numeric,
  payable_amount numeric
)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_gross numeric(14, 2);
  v_percent numeric(5, 2);
  v_commission numeric(14, 2);
begin
  if p_gross is null or p_gross <= 0 then
    raise exception 'settlement_amount_invalid';
  end if;
  v_percent := round(coalesce(p_percent, 0), 2);
  if v_percent < 0 or v_percent > 100 then
    raise exception 'settlement_amount_invalid';
  end if;
  v_gross := round(p_gross, 2);
  v_commission := round(v_gross * v_percent / 100, 2);
  gross_amount := v_gross;
  commission_amount := v_commission;
  payable_amount := v_gross - v_commission;
  return next;
end;
$$;

create or replace function public.settlement_payload(p_id uuid, p_idempotent boolean)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'idempotent', p_idempotent,
    'storeId', s.store_id,
    'grossAmount', s.gross_amount,
    'commissionAmount', s.commission_amount,
    'payableAmount', s.payable_amount,
    'dueAt', s.due_at,
    'paidAt', s.paid_at,
    'paymentReference', s.payment_reference,
    'paymentMethod', s.payment_method,
    'lineCount', (
      select count(*)::int
      from public.settlement_lines l
      where l.settlement_id = s.id
    )
  )
  from public.settlements s
  where s.id = p_id;
$$;

create or replace function public.sync_voucher_settlement_status(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  voucher public.vouchers%rowtype;
  unsettled integer;
  pending integer;
  settled integer;
  next_status text;
begin
  select *
    into voucher
  from public.vouchers
  where id = p_voucher_id
  for update;

  if voucher.id is null then
    return;
  end if;

  if voucher.status not in ('REDEEMED', 'SETTLEMENT_PENDING', 'SETTLED') then
    return;
  end if;

  select
    count(*) filter (where settlement_status = 'UNSETTLED'),
    count(*) filter (where settlement_status = 'SETTLEMENT_PENDING'),
    count(*) filter (where settlement_status = 'SETTLED')
  into unsettled, pending, settled
  from public.redemptions
  where voucher_id = p_voucher_id;

  if unsettled > 0 then
    next_status := 'REDEEMED';
  elsif pending > 0 then
    next_status := 'SETTLEMENT_PENDING';
  elsif settled > 0 then
    next_status := 'SETTLED';
  else
    return;
  end if;

  if voucher.status is distinct from next_status then
    update public.vouchers
    set status = next_status
    where id = p_voucher_id;
  end if;
end;
$$;

create or replace function public.settlements_guard_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'PENDING'
      or new.paid_at is not null
      or new.cancelled_at is not null
      or new.payment_method is not null
      or new.payment_reference is not null
    then
      raise exception 'settlement_terms_invalid';
    end if;
    new.updated_at := timezone('utc', now());
    return new;
  end if;

  new.updated_at := timezone('utc', now());

  if new.store_id is distinct from old.store_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.store_name is distinct from old.store_name
    or new.settlement_method is distinct from old.settlement_method
    or new.gross_amount is distinct from old.gross_amount
    or new.commission_amount is distinct from old.commission_amount
    or new.payable_amount is distinct from old.payable_amount
    or new.due_at is distinct from old.due_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'settlement_immutable';
  end if;

  if old.status = new.status then
    if new.paid_at is distinct from old.paid_at
      or new.payment_reference is distinct from old.payment_reference
      or new.payment_method is distinct from old.payment_method
      or new.cancelled_at is distinct from old.cancelled_at
    then
      raise exception 'settlement_immutable';
    end if;
    return new;
  end if;

  if old.status = 'PENDING' and new.status = 'PAID' then
    if new.cancelled_at is not null then
      raise exception 'settlement_closed';
    end if;
    if new.paid_at is null then
      new.paid_at := timezone('utc', now());
    end if;
    if new.payment_method is null
      or new.payment_method not in ('bank_transfer', 'invoice', 'manual', 'other')
    then
      raise exception 'settlement_method_invalid';
    end if;
    if new.payment_reference is not null and (
      char_length(btrim(new.payment_reference)) = 0
      or char_length(new.payment_reference) > 80
    ) then
      raise exception 'settlement_reference_invalid';
    end if;
    return new;
  end if;

  if old.status = 'PENDING' and new.status = 'CANCELLED' then
    if new.paid_at is not null
      or new.payment_method is not null
      or new.payment_reference is not null
    then
      raise exception 'settlement_closed';
    end if;
    if new.cancelled_at is null then
      new.cancelled_at := timezone('utc', now());
    end if;
    return new;
  end if;

  raise exception 'settlement_closed';
end;
$$;

create or replace function public.settlements_apply_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'PENDING' and new.status = 'PAID' then
    update public.redemptions r
    set settlement_status = 'SETTLED'
    from public.settlement_lines l
    where l.settlement_id = new.id
      and l.released_at is null
      and l.redemption_id = r.id
      and r.settlement_status = 'SETTLEMENT_PENDING';
  elsif old.status = 'PENDING' and new.status = 'CANCELLED' then
    update public.settlement_lines
    set released_at = timezone('utc', now())
    where settlement_id = new.id
      and released_at is null;
  end if;
  return null;
end;
$$;

create or replace function public.settlements_require_lines()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
  v_gross numeric(14, 2);
  v_commission numeric(14, 2);
  v_payable numeric(14, 2);
  v_due timestamptz;
begin
  select
    count(*)::int,
    coalesce(sum(gross_amount), 0),
    coalesce(sum(commission_amount), 0),
    coalesce(sum(payable_amount), 0),
    min(due_at)
  into v_count, v_gross, v_commission, v_payable, v_due
  from public.settlement_lines
  where settlement_id = new.id
    and released_at is null;

  if v_count = 0 then
    raise exception 'settlement_none';
  end if;
  if v_gross is distinct from new.gross_amount
    or v_commission is distinct from new.commission_amount
    or v_payable is distinct from new.payable_amount
  then
    raise exception 'settlement_amount_invalid';
  end if;
  if v_due is distinct from new.due_at then
    raise exception 'settlement_due_invalid';
  end if;
  return null;
end;
$$;

create or replace function public.settlement_lines_guard()
returns trigger
language plpgsql
set search_path = public
set timezone = 'UTC'
as $$
declare
  redemption public.redemptions%rowtype;
  parent_store uuid;
  parent_status text;
  v_gross numeric;
  v_commission numeric;
  v_payable numeric;
  expected_due timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.settlement_id is distinct from old.settlement_id
      or new.redemption_id is distinct from old.redemption_id
      or new.voucher_id is distinct from old.voucher_id
      or new.gross_amount is distinct from old.gross_amount
      or new.commission_percent is distinct from old.commission_percent
      or new.commission_specified is distinct from old.commission_specified
      or new.commission_amount is distinct from old.commission_amount
      or new.payable_amount is distinct from old.payable_amount
      or new.payment_terms_days is distinct from old.payment_terms_days
      or new.terms_specified is distinct from old.terms_specified
      or new.redeemed_at is distinct from old.redeemed_at
      or new.due_at is distinct from old.due_at
      or new.voucher_code is distinct from old.voucher_code
      or new.gift_title is distinct from old.gift_title
      or new.event_title is distinct from old.event_title
      or new.created_at is distinct from old.created_at
    then
      raise exception 'settlement_line_immutable';
    end if;

    if old.released_at is not null and new.released_at is distinct from old.released_at then
      raise exception 'settlement_line_immutable';
    end if;

    if old.released_at is null and new.released_at is not null then
      perform 1
      from public.settlements
      where id = new.settlement_id
        and status = 'CANCELLED';
      if not found then
        raise exception 'settlement_line_immutable';
      end if;
    end if;

    return new;
  end if;

  if new.released_at is not null then
    raise exception 'settlement_line_immutable';
  end if;

  select *
    into redemption
  from public.redemptions
  where id = new.redemption_id
  for update;

  if redemption.id is null then
    raise exception 'settlement_redemption_taken';
  end if;

  select store_id, status
    into parent_store, parent_status
  from public.settlements
  where id = new.settlement_id;

  if parent_status is distinct from 'PENDING' then
    raise exception 'settlement_closed';
  end if;
  if redemption.store_id is distinct from parent_store
    or redemption.voucher_id is distinct from new.voucher_id
  then
    raise exception 'settlement_store_mismatch';
  end if;
  if redemption.settlement_status is distinct from 'UNSETTLED' then
    raise exception 'settlement_redemption_taken';
  end if;

  select split_row.gross_amount, split_row.commission_amount, split_row.payable_amount
    into v_gross, v_commission, v_payable
  from public.settlement_split(
    redemption.amount,
    redemption.commission_percent_snapshot
  ) as split_row;

  if new.gross_amount is distinct from v_gross
    or new.commission_amount is distinct from v_commission
    or new.payable_amount is distinct from v_payable
    or new.commission_percent is distinct from coalesce(redemption.commission_percent_snapshot, 0)
    or new.commission_specified is distinct from (redemption.commission_percent_snapshot is not null)
    or new.payment_terms_days is distinct from coalesce(redemption.payment_terms_days_snapshot, 0)
    or new.terms_specified is distinct from (redemption.payment_terms_days_snapshot is not null)
    or new.redeemed_at is distinct from redemption.redeemed_at
  then
    raise exception 'settlement_amount_invalid';
  end if;

  expected_due := redemption.redeemed_at + make_interval(
    days => coalesce(redemption.payment_terms_days_snapshot, 0)
  );
  if new.due_at is distinct from expected_due then
    raise exception 'settlement_due_invalid';
  end if;

  return new;
end;
$$;

create or replace function public.settlement_lines_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.redemptions
  set settlement_status = 'SETTLEMENT_PENDING'
  where id = new.redemption_id
    and settlement_status = 'UNSETTLED';

  if not found then
    raise exception 'settlement_redemption_taken';
  end if;
  return null;
end;
$$;

create or replace function public.settlement_lines_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.released_at is null and new.released_at is not null then
    update public.redemptions
    set settlement_status = 'UNSETTLED'
    where id = new.redemption_id
      and settlement_status = 'SETTLEMENT_PENDING';

    if not found then
      raise exception 'settlement_redemption_taken';
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.redemptions_sync_voucher_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_voucher_settlement_status(new.voucher_id);
  return null;
end;
$$;

create or replace function public.settlements_block_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'settlement_delete_blocked';
end;
$$;

drop trigger if exists settlements_guard_row on public.settlements;
create trigger settlements_guard_row
before insert or update on public.settlements
for each row
execute procedure public.settlements_guard_row();

drop trigger if exists settlements_apply_status on public.settlements;
create trigger settlements_apply_status
after update of status on public.settlements
for each row
execute procedure public.settlements_apply_status();

drop trigger if exists settlements_require_lines on public.settlements;
create constraint trigger settlements_require_lines
after insert on public.settlements
deferrable initially deferred
for each row
execute procedure public.settlements_require_lines();

drop trigger if exists settlement_lines_guard on public.settlement_lines;
create trigger settlement_lines_guard
before insert or update on public.settlement_lines
for each row
execute procedure public.settlement_lines_guard();

drop trigger if exists settlement_lines_claim on public.settlement_lines;
create trigger settlement_lines_claim
after insert on public.settlement_lines
for each row
execute procedure public.settlement_lines_claim();

drop trigger if exists settlement_lines_release on public.settlement_lines;
create trigger settlement_lines_release
after update of released_at on public.settlement_lines
for each row
execute procedure public.settlement_lines_release();

drop trigger if exists redemptions_sync_voucher_settlement on public.redemptions;
create trigger redemptions_sync_voucher_settlement
after update of settlement_status on public.redemptions
for each row
when (old.settlement_status is distinct from new.settlement_status)
execute procedure public.redemptions_sync_voucher_settlement();

drop trigger if exists settlements_block_delete on public.settlements;
create trigger settlements_block_delete
before delete on public.settlements
for each row
execute procedure public.settlements_block_delete();

drop trigger if exists settlement_lines_block_delete on public.settlement_lines;
create trigger settlement_lines_block_delete
before delete on public.settlement_lines
for each row
execute procedure public.settlements_block_delete();

create or replace function public.create_store_settlement(
  p_store_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set timezone = 'UTC'
as $$
declare
  existing public.settlements%rowtype;
  store_name text;
  store_method text;
  redemption record;
  v_gross numeric(14, 2);
  v_commission numeric(14, 2);
  v_payable numeric(14, 2);
  applied_percent numeric(5, 2);
  applied_days integer;
  line_due timestamptz;
  min_due timestamptz;
  total_gross numeric(14, 2) := 0;
  total_commission numeric(14, 2) := 0;
  total_payable numeric(14, 2) := 0;
  redemption_ids uuid[] := '{}';
  voucher_ids uuid[] := '{}';
  grosses numeric(14, 2)[] := '{}';
  percents numeric(5, 2)[] := '{}';
  percent_flags boolean[] := '{}';
  commissions numeric(14, 2)[] := '{}';
  payables numeric(14, 2)[] := '{}';
  term_days integer[] := '{}';
  term_flags boolean[] := '{}';
  redeemed_ats timestamptz[] := '{}';
  due_ats timestamptz[] := '{}';
  codes text[] := '{}';
  gifts text[] := '{}';
  events text[] := '{}';
  settlement_id uuid;
  i integer;
begin
  if p_store_id is null or p_idempotency_key is null then
    raise exception 'settlement_terms_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('lolo-settlement-store'),
    hashtext(p_store_id::text)
  );

  select *
    into existing
  from public.settlements
  where store_id = p_store_id
    and idempotency_key = p_idempotency_key;

  if found then
    return public.settlement_payload(existing.id, true);
  end if;

  select s.name, s.settlement_method
    into store_name, store_method
  from public.stores s
  where s.id = p_store_id
  for share;

  if not found then
    raise exception 'settlement_store_not_found';
  end if;

  for redemption in
    select
      r.id,
      r.voucher_id,
      r.amount,
      r.commission_percent_snapshot,
      r.payment_terms_days_snapshot,
      r.redeemed_at,
      v.code as voucher_code,
      v.gift_title,
      v.event_title
    from public.redemptions r
    join public.vouchers v on v.id = r.voucher_id
    where r.store_id = p_store_id
      and r.settlement_status = 'UNSETTLED'
    order by r.redeemed_at asc, r.id asc
    for update of r
  loop
    select split_row.gross_amount, split_row.commission_amount, split_row.payable_amount
      into v_gross, v_commission, v_payable
    from public.settlement_split(
      redemption.amount,
      redemption.commission_percent_snapshot
    ) as split_row;

    applied_percent := coalesce(redemption.commission_percent_snapshot, 0);
    applied_days := coalesce(redemption.payment_terms_days_snapshot, 0);
    line_due := redemption.redeemed_at + make_interval(days => applied_days);
    if min_due is null or line_due < min_due then
      min_due := line_due;
    end if;

    total_gross := total_gross + v_gross;
    total_commission := total_commission + v_commission;
    total_payable := total_payable + v_payable;
    redemption_ids := array_append(redemption_ids, redemption.id);
    voucher_ids := array_append(voucher_ids, redemption.voucher_id);
    grosses := array_append(grosses, v_gross);
    percents := array_append(percents, applied_percent);
    percent_flags := array_append(percent_flags, redemption.commission_percent_snapshot is not null);
    commissions := array_append(commissions, v_commission);
    payables := array_append(payables, v_payable);
    term_days := array_append(term_days, applied_days);
    term_flags := array_append(term_flags, redemption.payment_terms_days_snapshot is not null);
    redeemed_ats := array_append(redeemed_ats, redemption.redeemed_at);
    due_ats := array_append(due_ats, line_due);
    codes := array_append(codes, left(coalesce(redemption.voucher_code, ''), 32));
    gifts := array_append(gifts, left(coalesce(redemption.gift_title, ''), 200));
    events := array_append(events, left(coalesce(redemption.event_title, ''), 200));
  end loop;

  if coalesce(array_length(redemption_ids, 1), 0) = 0 then
    raise exception 'settlement_none';
  end if;

  insert into public.settlements (
    store_id,
    status,
    idempotency_key,
    store_name,
    settlement_method,
    gross_amount,
    commission_amount,
    payable_amount,
    due_at
  )
  values (
    p_store_id,
    'PENDING',
    p_idempotency_key,
    left(coalesce(store_name, ''), 120),
    store_method,
    total_gross,
    total_commission,
    total_payable,
    min_due
  )
  returning id into settlement_id;

  for i in 1 .. array_length(redemption_ids, 1) loop
    insert into public.settlement_lines (
      settlement_id,
      redemption_id,
      voucher_id,
      gross_amount,
      commission_percent,
      commission_specified,
      commission_amount,
      payable_amount,
      payment_terms_days,
      terms_specified,
      redeemed_at,
      due_at,
      voucher_code,
      gift_title,
      event_title
    )
    values (
      settlement_id,
      redemption_ids[i],
      voucher_ids[i],
      grosses[i],
      percents[i],
      percent_flags[i],
      commissions[i],
      payables[i],
      term_days[i],
      term_flags[i],
      redeemed_ats[i],
      due_ats[i],
      codes[i],
      gifts[i],
      events[i]
    );
  end loop;

  return public.settlement_payload(settlement_id, false);
exception
  when unique_violation then
    select *
      into existing
    from public.settlements
    where store_id = p_store_id
      and idempotency_key = p_idempotency_key;

    if found then
      return public.settlement_payload(existing.id, true);
    end if;
    raise exception 'settlement_redemption_taken';
end;
$$;

create or replace function public.mark_settlement_paid(
  p_settlement_id uuid,
  p_reference text,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settlement public.settlements%rowtype;
  clean_reference text;
  v_method text;
begin
  if p_settlement_id is null then
    raise exception 'settlement_terms_invalid';
  end if;

  select *
    into settlement
  from public.settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'settlement_not_found';
  end if;

  if settlement.status = 'PAID' then
    return public.settlement_payload(settlement.id, true);
  end if;

  if settlement.status = 'CANCELLED' then
    raise exception 'settlement_cancelled';
  end if;

  clean_reference := nullif(btrim(coalesce(p_reference, '')), '');
  if clean_reference is not null and char_length(clean_reference) > 80 then
    raise exception 'settlement_reference_invalid';
  end if;

  v_method := nullif(btrim(coalesce(p_method, '')), '');
  if v_method is null then
    v_method := coalesce(settlement.settlement_method, 'manual');
  end if;
  if v_method not in ('bank_transfer', 'invoice', 'manual', 'other') then
    raise exception 'settlement_method_invalid';
  end if;

  update public.settlements
  set status = 'PAID',
      paid_at = timezone('utc', now()),
      payment_reference = clean_reference,
      payment_method = v_method
  where id = settlement.id;

  return public.settlement_payload(settlement.id, false);
end;
$$;

create or replace function public.cancel_settlement(p_settlement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settlement public.settlements%rowtype;
begin
  if p_settlement_id is null then
    raise exception 'settlement_terms_invalid';
  end if;

  select *
    into settlement
  from public.settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'settlement_not_found';
  end if;

  if settlement.status = 'CANCELLED' then
    return public.settlement_payload(settlement.id, true);
  end if;

  if settlement.status = 'PAID' then
    raise exception 'settlement_already_paid';
  end if;

  update public.settlements
  set status = 'CANCELLED',
      cancelled_at = timezone('utc', now())
  where id = settlement.id;

  return public.settlement_payload(settlement.id, false);
end;
$$;

comment on table public.settlements is
  'One admin batch of unsettled redemptions for a single store. Guest fees are not included.';
comment on column public.settlements.due_at is
  'Earliest line due date. Each line is redeemed_at plus that redemption''s snapshotted payment_terms_days.';
comment on column public.settlements.payable_amount is
  'Gross redeemed amount minus snapshotted store commission. This is what the store is owed.';
comment on table public.settlement_lines is
  'One redemption in a settlement. released_at is set only when a pending settlement is cancelled.';
comment on column public.settlement_lines.commission_amount is
  'round(gross * snapshotted percent / 100, 2). Null snapshot is 0%.';

alter table public.settlements enable row level security;
alter table public.settlement_lines enable row level security;

drop policy if exists "No direct access to settlements" on public.settlements;
create policy "No direct access to settlements"
  on public.settlements
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct access to settlement lines" on public.settlement_lines;
create policy "No direct access to settlement lines"
  on public.settlement_lines
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.settlements from anon, authenticated, public;
revoke all on table public.settlement_lines from anon, authenticated, public;

grant all on table public.settlements to service_role;
grant all on table public.settlement_lines to service_role;

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
        'settlement_split',
        'settlement_payload',
        'sync_voucher_settlement_status',
        'settlements_guard_row',
        'settlements_apply_status',
        'settlements_require_lines',
        'settlement_lines_guard',
        'settlement_lines_claim',
        'settlement_lines_release',
        'redemptions_sync_voucher_settlement',
        'settlements_block_delete',
        'create_store_settlement',
        'mark_settlement_paid',
        'cancel_settlement'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
