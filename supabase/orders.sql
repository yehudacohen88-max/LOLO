-- Production orders schema.
-- Run this entire file in the Supabase SQL Editor after public.events
-- and public.event_gifts already exist.
--
-- Guests must not read, list, insert, update, or delete these tables
-- with the anon key. Writes go through the Next.js server API.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  event_slug text not null,
  guest_name text not null default '',
  guest_phone text not null default '',
  guest_email text not null default '',
  wants_confirmation boolean not null default true,
  greeting_text text not null default '',
  total_amount numeric not null default 0 check (total_amount >= 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'cancelled')),
  access_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  gift_id uuid not null references public.event_gifts (id) on delete restrict,
  gift_name text not null,
  amount numeric not null check (amount > 0)
);

create index if not exists orders_event_id_idx on public.orders (event_id);
create index if not exists orders_event_slug_idx on public.orders (event_slug);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_gift_id_idx on public.order_items (gift_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row
execute procedure public.set_updated_at();

create or replace function public.order_item_matches_event()
returns trigger
language plpgsql
as $$
declare
  order_event_id uuid;
  gift_event_id uuid;
begin
  select event_id into order_event_id
  from public.orders
  where id = new.order_id;

  select event_id into gift_event_id
  from public.event_gifts
  where id = new.gift_id;

  if order_event_id is null or gift_event_id is null or order_event_id <> gift_event_id then
    raise exception 'order item gift does not belong to the order event';
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_match_event on public.order_items;
create trigger order_items_match_event
before insert or update on public.order_items
for each row
execute procedure public.order_item_matches_event();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "No direct guest access to orders" on public.orders;
create policy "No direct guest access to orders"
  on public.orders
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct guest access to order items" on public.order_items;
create policy "No direct guest access to order items"
  on public.order_items
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.orders from anon, authenticated, public;
revoke all on table public.order_items from anon, authenticated, public;

grant all on table public.orders to service_role;
grant all on table public.order_items to service_role;
