-- Re-run this in the SQL Editor if public SELECT still fails.
-- Does not allow UPDATE or DELETE.

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
