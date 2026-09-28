-- Private invited-guest lists for hosts. Run in the SQL Editor.
-- Does not change events, event_gifts, orders, event_host_access, or their RLS.
-- Anon/authenticated must not read or write this table.

create table if not exists public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint event_guests_name_not_blank check (char_length(btrim(name)) > 0),
  constraint event_guests_phone_not_blank check (char_length(btrim(phone)) > 0)
);

create index if not exists event_guests_event_id_idx
  on public.event_guests (event_id);

create index if not exists event_guests_event_created_idx
  on public.event_guests (event_id, created_at);

alter table public.event_guests enable row level security;

drop policy if exists "No direct access to event guests" on public.event_guests;
create policy "No direct access to event guests"
  on public.event_guests
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.event_guests from anon, authenticated, public;
grant all on table public.event_guests to service_role;
