-- Read-only audit of demo and simulated orders and the vouchers on those gifts.
-- SELECT only. Do not add UPDATE, DELETE, or function calls that write.
-- Run it yourself in the Supabase SQL editor. This file is not executed by the app.
-- Guest phone numbers and email addresses are not selected.

-- Paid orders that are not real-provider money.
select
  o.id as order_id,
  o.event_id,
  o.event_slug,
  o.payment_status,
  o.payment_provider,
  o.payment_reference,
  o.total_amount,
  o.fee_amount,
  o.charged_amount,
  o.paid_at,
  o.created_at
from public.orders o
where o.payment_status = 'paid'
  and (
    o.payment_provider is null
    or btrim(o.payment_provider) = ''
    or lower(btrim(o.payment_provider)) = 'demo'
    or coalesce(o.payment_reference, '') like 'demo-%'
  )
order by o.created_at;

-- Vouchers whose gift has at least one simulated paid contribution.
select
  v.id as voucher_id,
  v.event_id,
  v.gift_id,
  v.store_id,
  v.status,
  v.amount,
  v.remaining_amount,
  v.issued_at,
  v.expires_at,
  v.store_name,
  v.gift_title,
  v.event_title
from public.vouchers v
where exists (
  select 1
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.gift_id = v.gift_id
    and o.event_id = v.event_id
    and o.payment_status = 'paid'
    and oi.amount > 0
    and (
      o.payment_provider is null
      or btrim(coalesce(o.payment_provider, '')) = ''
      or lower(btrim(o.payment_provider)) = 'demo'
      or coalesce(o.payment_reference, '') like 'demo-%'
    )
)
order by v.issued_at;
