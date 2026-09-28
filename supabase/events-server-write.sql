-- Stop anon/browser INSERT on events and event_gifts.
-- Guests still need SELECT. Writes go through the Next.js server API.
-- Run after public.events and public.event_gifts exist.

alter table public.events enable row level security;
alter table public.event_gifts enable row level security;

drop policy if exists "Public can create events" on public.events;
drop policy if exists "Public can create event gifts" on public.event_gifts;

revoke insert, update, delete on table public.events from anon, authenticated, public;
revoke insert, update, delete on table public.event_gifts from anon, authenticated, public;

grant select on table public.events to anon, authenticated, public;
grant select on table public.event_gifts to anon, authenticated, public;

grant all on table public.events to service_role;
grant all on table public.event_gifts to service_role;
