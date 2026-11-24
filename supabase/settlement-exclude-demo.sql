-- Settlement guard: demo redemptions stay out of a batch, and a missing
-- commission or payment term is not silently zero.
-- NEEDS APPROVAL BEFORE APPLYING. Do not run this against production until reviewed.
-- Safe to re-run. Does not delete rows. Does not create a balance table.
-- Does not edit supabase/settlements.sql. Replaces functions that file created.
--
-- Apply in the Supabase SQL editor only after both of these have been applied:
--   1. supabase/settlements.sql
--   2. supabase/pilot-demo-voucher-guard.sql  (owns vouchers.demo_only)
-- This file does not add demo_only and does not copy that guard.
--
-- Money: commission and payment terms come from the redemption snapshot.
-- When a snapshot is null, the matching column on platform_settings
-- (id = 'default') is used. When that column is also null, the batch is refused.
-- Null is never treated as 0% or as "due now".
-- Rounding runs only when platform_settings.money_rounding is
-- half_away_from_zero, the same rule as round(numeric, 2) and as
-- lib/settlements/rounding.ts. Any other value, including null, is refused.
-- No commission rate and no payment-term length is written by this file.
--
-- A redemption whose voucher has demo_only = true cannot be inserted onto a
-- settlement line. create_store_settlement skips those rows, so they stay
-- UNSETTLED. Guest fees are still not part of a batch.

do $$
begin
  if to_regclass('public.settlements') is null
    or to_regclass('public.settlement_lines') is null
    or to_regclass('public.redemptions') is null
    or to_regclass('public.vouchers') is null
    or to_regclass('public.platform_settings') is null
    or to_regclass('public.stores') is null
  then
    raise exception 'settlement_exclude_demo_prerequisites_missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vouchers'
      and column_name = 'demo_only'
  ) then
    raise exception 'settlement_exclude_demo_requires_demo_only';
  end if;
end;
$$;

alter table public.platform_settings
  add column if not exists default_commission_percent numeric(5, 2);

alter table public.platform_settings
  add column if not exists default_payment_terms_days integer;

alter table public.platform_settings
  add column if not exists money_rounding text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_default_commission_range'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_default_commission_range
      check (
        default_commission_percent is null
        or (default_commission_percent >= 0 and default_commission_percent <= 100)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_default_terms_range'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_default_terms_range
      check (
        default_payment_terms_days is null
        or (default_payment_terms_days >= 0 and default_payment_terms_days <= 3650)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_money_rounding_known'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_money_rounding_known
      check (money_rounding is null or money_rounding = 'half_away_from_zero');
  end if;
end;
$$;

comment on column public.platform_settings.default_commission_percent is
  'Used only when a redemption has no commission_percent_snapshot. Null refuses the batch. Not a silent 0%.';
comment on column public.platform_settings.default_payment_terms_days is
  'Used only when a redemption has no payment_terms_days_snapshot. Null refuses the batch. Not a silent due-now.';
comment on column public.platform_settings.money_rounding is
  'Named rounding rule shared with lib/settlements/rounding.ts. Null refuses settlement math.';

create or replace function public.settlement_rounding_rule()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule text;
begin
  select money_rounding
    into v_rule
  from public.platform_settings
  where id = 'default';

  if v_rule is distinct from 'half_away_from_zero' then
    raise exception 'settlement_rounding_unspecified';
  end if;
  return v_rule;
end;
$$;

create or replace function public.settlement_commission_percent(p_snapshot numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_percent numeric;
begin
  perform public.settlement_rounding_rule();

  if p_snapshot is not null then
    v_percent := round(p_snapshot, 2);
  else
    select default_commission_percent
      into v_percent
    from public.platform_settings
    where id = 'default';
    if v_percent is null then
      raise exception 'settlement_commission_unspecified';
    end if;
    v_percent := round(v_percent, 2);
  end if;

  if v_percent < 0 or v_percent > 100 then
    raise exception 'settlement_amount_invalid';
  end if;
  return v_percent;
end;
$$;

create or replace function public.settlement_payment_terms_days(p_snapshot integer)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer;
begin
  if p_snapshot is not null then
    v_days := p_snapshot;
  else
    select default_payment_terms_days
      into v_days
    from public.platform_settings
    where id = 'default';
    if v_days is null then
      raise exception 'settlement_terms_unspecified';
    end if;
  end if;

  if v_days < 0 or v_days > 3650 then
    raise exception 'settlement_terms_invalid';
  end if;
  return v_days;
end;
$$;

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
  if p_percent is null then
    raise exception 'settlement_commission_unspecified';
  end if;
  v_percent := round(p_percent, 2);
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
  v_demo boolean;
  v_percent numeric;
  v_days integer;
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

  select v.demo_only
    into v_demo
  from public.vouchers v
  where v.id = redemption.voucher_id;

  if coalesce(v_demo, false) then
    raise exception 'settlement_demo_excluded';
  end if;

  v_percent := public.settlement_commission_percent(redemption.commission_percent_snapshot);
  v_days := public.settlement_payment_terms_days(redemption.payment_terms_days_snapshot);

  select split_row.gross_amount, split_row.commission_amount, split_row.payable_amount
    into v_gross, v_commission, v_payable
  from public.settlement_split(
    redemption.amount,
    v_percent
  ) as split_row;

  if new.gross_amount is distinct from v_gross
    or new.commission_amount is distinct from v_commission
    or new.payable_amount is distinct from v_payable
    or new.commission_percent is distinct from v_percent
    or new.commission_specified is distinct from (redemption.commission_percent_snapshot is not null)
    or new.payment_terms_days is distinct from v_days
    or new.terms_specified is distinct from (redemption.payment_terms_days_snapshot is not null)
    or new.redeemed_at is distinct from redemption.redeemed_at
  then
    raise exception 'settlement_amount_invalid';
  end if;

  expected_due := redemption.redeemed_at + make_interval(days => v_days);
  if new.due_at is distinct from expected_due then
    raise exception 'settlement_due_invalid';
  end if;

  return new;
end;
$$;

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

  perform public.settlement_rounding_rule();

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
      v.event_title,
      v.demo_only
    from public.redemptions r
    join public.vouchers v on v.id = r.voucher_id
    where r.store_id = p_store_id
      and r.settlement_status = 'UNSETTLED'
      and v.demo_only is not true
    order by r.redeemed_at asc, r.id asc
    for update of r
  loop
    if coalesce(redemption.demo_only, false) then
      raise exception 'settlement_demo_excluded';
    end if;

    applied_percent := public.settlement_commission_percent(redemption.commission_percent_snapshot);
    applied_days := public.settlement_payment_terms_days(redemption.payment_terms_days_snapshot);

    select split_row.gross_amount, split_row.commission_amount, split_row.payable_amount
      into v_gross, v_commission, v_payable
    from public.settlement_split(
      redemption.amount,
      applied_percent
    ) as split_row;

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

comment on function public.create_store_settlement(uuid, uuid) is
  'One batch of unsettled redemptions for one store. demo_only vouchers are left UNSETTLED. Null commission or terms use platform_settings or refuse.';

revoke all on function public.settlement_rounding_rule() from public, anon, authenticated;
revoke all on function public.settlement_commission_percent(numeric) from public, anon, authenticated;
revoke all on function public.settlement_payment_terms_days(integer) from public, anon, authenticated;
revoke all on function public.settlement_split(numeric, numeric) from public, anon, authenticated;
revoke all on function public.settlement_lines_guard() from public, anon, authenticated;
revoke all on function public.create_store_settlement(uuid, uuid) from public, anon, authenticated;

grant execute on function public.settlement_rounding_rule() to service_role;
grant execute on function public.settlement_commission_percent(numeric) to service_role;
grant execute on function public.settlement_payment_terms_days(integer) to service_role;
grant execute on function public.settlement_split(numeric, numeric) to service_role;
grant execute on function public.settlement_lines_guard() to service_role;
grant execute on function public.create_store_settlement(uuid, uuid) to service_role;
