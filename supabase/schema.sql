-- LOLO minimum schema for hosted events and gifts.
-- Run this entire file in the Supabase SQL Editor.

create table if not exists public.events (
  id uuid primary key,
  slug text not null unique,
  title text not null default '',
  host_name text not null default '',
  event_type text not null default '',
  event_date text not null default '',
  event_time text not null default '',
  venue_name text not null default '',
  address text not null default '',
  message text not null default '',
  cover_image text not null default '',
  gift_mode text not null default '',
  money_amounts integer[] not null default '{}'::integer[],
  allow_custom_amount boolean not null default true,
  money_display text not null default 'amounts',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_gifts (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null default '',
  description text not null default '',
  target_amount numeric not null default 0,
  icon text not null default '',
  priority integer not null default 0,
  active boolean not null default true
);

create index if not exists event_gifts_event_id_idx
  on public.event_gifts (event_id, priority);

alter table public.events enable row level security;
alter table public.event_gifts enable row level security;

drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
  on public.events
  for select
  using (true);

drop policy if exists "Public can create events" on public.events;
create policy "Public can create events"
  on public.events
  for insert
  with check (true);

drop policy if exists "Public can read event gifts" on public.event_gifts;
create policy "Public can read event gifts"
  on public.event_gifts
  for select
  using (true);

drop policy if exists "Public can create event gifts" on public.event_gifts;
create policy "Public can create event gifts"
  on public.event_gifts
  for insert
  with check (true);

grant usage on schema public to anon, authenticated, public;
grant select, insert on table public.events to anon, authenticated, public;
grant select, insert on table public.event_gifts to anon, authenticated, public;
