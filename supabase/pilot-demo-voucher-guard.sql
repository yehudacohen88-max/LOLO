-- Pilot guard: demo and simulated payments are not money.
-- NEEDS APPROVAL BEFORE APPLYING. Do not run this against production until reviewed.
-- Safe to re-run. Does not delete rows. Existing vouchers stay in place.
--
-- Apply in the Supabase SQL editor after supabase/vouchers.sql.
-- Until this file is applied, the app refuses to issue a voucher from demo
-- funding and refuses to redeem one. It does not call issue_gift_voucher or
-- redeem_voucher for that money. After this file is applied, the database
-- rejects the same calls even if they come from the service role directly.
-- anon and authenticated still cannot execute these functions.
--
-- A paid order counts as real money only when payment_provider_is_real
-- returns true and payment_reference does not start with "demo-".
-- payment_provider_is_real stays false until a live provider is reviewed.
-- "demo" and "none" are never real. Every other name is simulated too,
-- including a name that is merely not "demo". Demo vouchers are labeled
-- in the app and cannot be redeemed.

alter table public.vouchers
  add column if not exists demo_only boolean not null default false;

comment on column public.vouchers.demo_only is
  'True when the voucher was funded only by a demo or simulated payment. It has no monetary value and cannot be redeemed.';

-- Empty on purpose. A reviewed provider is inserted here, not inferred from
-- "anything except demo". "demo" and "none" cannot be inserted.
create table if not exists public.payment_provider_allowlist (
  provider text primary key,
  constraint payment_provider_allowlist_name check (
    provider = lower(provider)
    and char_length(provider) > 0
    and provider <> 'demo'
    and provider <> 'none'
  )
);

alter table public.payment_provider_allowlist enable row level security;
revoke all on table public.payment_provider_allowlist from public, anon, authenticated;

create or replace function public.payment_provider_is_real(p_provider text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.payment_provider_allowlist
    where provider = lower(btrim(coalesce(p_provider, '')))
  );
$$;

comment on function public.payment_provider_is_real(text) is
  'True only for a name stored in payment_provider_allowlist. That table ships empty.';
comment on table public.payment_provider_allowlist is
  'Providers that may count as real money. Ships empty. demo and none are rejected.';

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
    and oi.amount > 0
    and public.payment_provider_is_real(o.payment_provider)
    and coalesce(o.payment_reference, '') not like 'demo-%';
$$;

create or replace function public.voucher_simulated_amount(p_gift_id uuid, p_event_id uuid)
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
    and oi.amount > 0
    and not (
      public.payment_provider_is_real(o.payment_provider)
      and coalesce(o.payment_reference, '') not like 'demo-%'
    );
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
    and v.demo_only is not true
    and (p_except_id is null or v.id <> p_except_id);
$$;

create or replace function public.voucher_demo_committed_amount(
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
    and v.demo_only is true
    and (p_except_id is null or v.id <> p_except_id);
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
      or new.demo_only is distinct from old.demo_only
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

  if coalesce(new.demo_only, false) then
    if round(coalesce(new.amount, 0), 2) <= 0 then
      raise exception 'voucher_amount_invalid';
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
  simulated numeric;
  demo_committed numeric;
  uncovered numeric;
  available numeric;
  demo_available numeric;
  issue_amount numeric;
  issue_demo boolean;
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
  simulated := public.voucher_simulated_amount(p_gift_id, p_event_id);
  demo_committed := public.voucher_demo_committed_amount(p_gift_id, null);
  uncovered := greatest(0, round(committed - paid, 2));
  available := round(paid - committed, 2);
  demo_available := round(simulated - demo_committed - uncovered, 2);
  if available < 0 then
    available := 0;
  end if;
  if demo_available < 0 then
    demo_available := 0;
  end if;

  issue_demo := false;
  issue_amount := available;
  if available <= 0 then
    if demo_available <= 0 then
      raise exception 'voucher_none_available';
    end if;
    issue_demo := true;
    issue_amount := demo_available;
  end if;

  if p_expected_amount is not null and round(p_expected_amount, 2) <> issue_amount then
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
      method_is_default,
      demo_only
    )
    values (
      p_event_id,
      p_gift_id,
      p_store_id,
      p_code,
      p_qr_secret,
      p_view_token,
      issue_amount,
      issue_amount,
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
      coalesce(p_method_is_default, false),
      issue_demo
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

  return public.voucher_issue_payload(created_id, issue_amount, issue_amount, 'ISSUED', false);
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
  real_paid numeric;
  monetary_committed numeric;
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

  if coalesce(voucher.demo_only, false) then
    raise exception 'voucher_demo_blocked';
  end if;

  real_paid := public.voucher_paid_amount(voucher.gift_id, voucher.event_id);
  monetary_committed := public.voucher_committed_amount(voucher.gift_id, null);
  if round(voucher.amount, 2) > round(real_paid, 2)
    or round(monetary_committed, 2) > round(real_paid, 2) then
    raise exception 'voucher_demo_blocked';
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

create or replace function public.voucher_demo_guard_version()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 1;
$$;

comment on function public.voucher_demo_guard_version() is
  'Returns 1 only after the pilot demo-voucher guard is installed. The app treats a missing function as not ready and fails closed.';

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
        'payment_provider_is_real',
        'voucher_paid_amount',
        'voucher_simulated_amount',
        'voucher_committed_amount',
        'voucher_demo_committed_amount',
        'voucher_demo_guard_version',
        'vouchers_guard_issue',
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
