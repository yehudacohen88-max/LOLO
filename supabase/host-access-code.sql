-- Private host access-code hashes. Run in the SQL Editor.
-- Does not change events, event_gifts, orders, or existing RLS on those tables.
-- Anon/authenticated must not read this table.

create table if not exists public.event_host_access (
  event_id uuid primary key references public.events (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.event_host_access enable row level security;

drop policy if exists "No direct access to host access codes" on public.event_host_access;
create policy "No direct access to host access codes"
  on public.event_host_access
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.event_host_access from anon, authenticated, public;
grant all on table public.event_host_access to service_role;
