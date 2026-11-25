-- Support notes on an order or an event.
-- Run this entire file in the Supabase SQL Editor only after review.
-- Do not run it from the app, from CI, or against Production until that approval.
--
-- Apply after supabase/schema.sql (events) and supabase/orders.sql.
-- This file does not create audit_events, payment_attempts, payment_refunds,
-- or notification_messages. Those belong to other packages.
--
-- Until this file is applied, saving a note fails closed. The admin screen
-- still opens and says the notes table is not available yet.
-- Notes are append-only. There is no update and no delete.

create table if not exists public.support_notes (
  id uuid primary key default gen_random_uuid(),
  subject_kind text not null,
  subject_id uuid not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint support_notes_kind check (subject_kind in ('order', 'event')),
  constraint support_notes_body check (
    char_length(btrim(body)) between 1 and 2000
  )
);

create index if not exists support_notes_subject_idx
  on public.support_notes (subject_kind, subject_id, created_at desc);

alter table public.support_notes enable row level security;
alter table public.support_notes force row level security;

revoke all on table public.support_notes from anon, authenticated, public;
grant select, insert on table public.support_notes to service_role;

create or replace function public.support_notes_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'support_notes is append-only';
end;
$$;

revoke all on function public.support_notes_append_only() from public, anon, authenticated;

drop trigger if exists support_notes_no_update on public.support_notes;
create trigger support_notes_no_update
before update on public.support_notes
for each row
execute procedure public.support_notes_append_only();

drop trigger if exists support_notes_no_delete on public.support_notes;
create trigger support_notes_no_delete
before delete on public.support_notes
for each row
execute procedure public.support_notes_append_only();

comment on table public.support_notes is
  'Admin support notes. No anon policies. Not applied to Production until a person runs this file.';
