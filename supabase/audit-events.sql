-- NOT APPLIED to Production.
-- Local Docker and CI apply this file. A person applies it in the Supabase
-- SQL editor only after approval. Do not run it from a deploy, a Preview
-- build, or any script that is not pointed at 127.0.0.1.
--
-- Append-only record of who did what. Service role insert and select only.
-- RLS is on and there are no policies, so anon and authenticated have no
-- access. Update and delete are rejected by trigger, including for the
-- service role. The app helper in lib/audit scrubs secrets before insert.
-- This file does not grant the service role update or delete.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  subject text not null default '',
  at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  constraint audit_events_actor_shape check (
    char_length(actor) between 1 and 80
    and actor ~ '^[a-z][a-z0-9._:-]*$'
  ),
  constraint audit_events_action_shape check (
    char_length(action) between 1 and 80
    and action ~ '^[a-z][a-z0-9._-]*$'
  ),
  constraint audit_events_subject_shape check (
    subject = ''
    or (
      char_length(subject) <= 160
      and subject ~ '^[a-z0-9][a-z0-9:._/-]*$'
    )
  ),
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists audit_events_at_idx
  on public.audit_events (at desc);

create index if not exists audit_events_action_at_idx
  on public.audit_events (action, at desc);

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

-- No policies. Default deny for anon and authenticated. Do not add an anon policy.

revoke all on table public.audit_events from anon, authenticated, public;
grant select, insert on table public.audit_events to service_role;

create or replace function public.audit_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

create or replace function public.audit_events_scrub_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  body text := new.metadata::text;
begin
  if jsonb_typeof(new.metadata) is distinct from 'object' then
    new.metadata := '{}'::jsonb;
    return new;
  end if;

  -- Direct inserts that bypass lib/audit still cannot store these.
  if body ilike '%pbkdf2$%'
     or body ilike '%fafvveudrlovaozazkny%'
     or body ~* '"(password|passwd|secret|token|cookie|authorization|access_code|redemption_code|host_code|code_hash|invite_token|service_role|anon_key|api_key)"\s*:'
  then
    new.metadata := jsonb_build_object('redacted', true);
  end if;

  return new;
end;
$$;

revoke all on function public.audit_events_append_only() from public, anon, authenticated;
revoke all on function public.audit_events_scrub_metadata() from public, anon, authenticated;

drop trigger if exists audit_events_scrub_metadata on public.audit_events;
create trigger audit_events_scrub_metadata
before insert on public.audit_events
for each row
execute procedure public.audit_events_scrub_metadata();

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
before update on public.audit_events
for each row
execute procedure public.audit_events_append_only();

drop trigger if exists audit_events_no_delete on public.audit_events;
create trigger audit_events_no_delete
before delete on public.audit_events
for each row
execute procedure public.audit_events_append_only();

comment on table public.audit_events is
  'Append-only audit log. No anon policies. Not applied to Production until a person runs this file.';
