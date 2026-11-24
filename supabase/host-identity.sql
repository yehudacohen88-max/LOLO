-- Host identity, recovery challenges, session revocation, and invitation greeting.
-- Review before running. Do not apply to Production from the app, CI, or a preview.
-- No backfill. Existing events stay manageable with the access code until a host links an email.
-- Does not store a management code or a one-time code in plaintext.
--
-- Apply order:
--   1. supabase/schema.sql
--   2. supabase/host-access-code.sql
--   3. supabase/event-guests.sql
--   4. this file
--
-- Guest reads use an explicit column list in lib/events/load-guest-event.ts.
-- Do not add recovery email to that list. Email lives only on host_identities.

create table if not exists public.host_identities (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint host_identities_email_shape check (
    email = lower(email)
    and char_length(email) <= 200
    and position('@' in email) > 1
  )
);

create unique index if not exists host_identities_email_key
  on public.host_identities (email);

create table if not exists public.host_identity_events (
  host_identity_id uuid not null references public.host_identities (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  role text not null default 'owner',
  linked_via text not null,
  linked_at timestamptz not null default timezone('utc', now()),
  primary key (host_identity_id, event_id),
  constraint host_identity_events_role check (role = 'owner'),
  constraint host_identity_events_linked_via check (linked_via in ('access_code', 'email_otp'))
);

create index if not exists host_identity_events_host_idx
  on public.host_identity_events (host_identity_id);

create index if not exists host_identity_events_event_idx
  on public.host_identity_events (event_id);

create table if not exists public.host_recovery_challenges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  host_identity_id uuid not null references public.host_identities (id) on delete cascade,
  channel text not null,
  destination_hash text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint host_recovery_challenges_channel check (channel = 'email'),
  constraint host_recovery_challenges_attempts check (attempts >= 0 and attempts <= 5),
  constraint host_recovery_challenges_otp_hash_len check (char_length(otp_hash) between 20 and 300),
  constraint host_recovery_challenges_destination_hash_len check (char_length(destination_hash) between 20 and 200)
);

create index if not exists host_recovery_challenges_destination_created_idx
  on public.host_recovery_challenges (destination_hash, created_at desc);

create index if not exists host_recovery_challenges_event_consumed_idx
  on public.host_recovery_challenges (event_id, consumed_at);

alter table public.event_host_access
  add column if not exists session_version integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_host_access_session_version_nonnegative'
      and conrelid = 'public.event_host_access'::regclass
  ) then
    alter table public.event_host_access
      add constraint event_host_access_session_version_nonnegative
      check (session_version >= 0);
  end if;
end $$;

alter table public.events
  add column if not exists invitation_greeting text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_invitation_greeting_length'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_invitation_greeting_length
      check (char_length(invitation_greeting) <= 500);
  end if;
end $$;

alter table public.host_identities enable row level security;
alter table public.host_identity_events enable row level security;
alter table public.host_recovery_challenges enable row level security;

drop policy if exists "No direct access to host identities" on public.host_identities;
create policy "No direct access to host identities"
  on public.host_identities
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct access to host identity events" on public.host_identity_events;
create policy "No direct access to host identity events"
  on public.host_identity_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct access to host recovery challenges" on public.host_recovery_challenges;
create policy "No direct access to host recovery challenges"
  on public.host_recovery_challenges
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.host_identities from anon, authenticated, public;
revoke all on table public.host_identity_events from anon, authenticated, public;
revoke all on table public.host_recovery_challenges from anon, authenticated, public;
grant all on table public.host_identities to service_role;
grant all on table public.host_identity_events to service_role;
grant all on table public.host_recovery_challenges to service_role;
