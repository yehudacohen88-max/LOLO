-- Close anonymous reads of events and event gifts.
-- Run once in the Supabase SQL Editor after the app reads a single event
-- through the Next.js server. Safe to re-run.
--
-- Does not delete or update rows. Does not change orders, payments,
-- vouchers, guests, host access, or stores.
-- The service role used by the server keeps full access and bypasses RLS.
-- If an older events-server-write.sql is run again, run this file afterwards.

alter table public.events enable row level security;
alter table public.event_gifts enable row level security;

drop policy if exists "Public can read events" on public.events;
drop policy if exists "Public can read event gifts" on public.event_gifts;

revoke select on table public.events from anon, authenticated, public;
revoke select on table public.event_gifts from anon, authenticated, public;

grant all on table public.events to service_role;
grant all on table public.event_gifts to service_role;
