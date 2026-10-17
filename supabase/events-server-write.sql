-- Stop anon/browser writes on events and event_gifts.
-- Reads and writes go through the Next.js server with the service role.
-- Run after public.events and public.event_gifts exist.
-- Also run supabase/events-anon-read.sql. An older copy of this file
-- granted SELECT back to anon; this copy revokes it.

alter table public.events enable row level security;
alter table public.event_gifts enable row level security;

drop policy if exists "Public can create events" on public.events;
drop policy if exists "Public can create event gifts" on public.event_gifts;

revoke select, insert, update, delete on table public.events from anon, authenticated, public;
revoke select, insert, update, delete on table public.event_gifts from anon, authenticated, public;

grant all on table public.events to service_role;
grant all on table public.event_gifts to service_role;
