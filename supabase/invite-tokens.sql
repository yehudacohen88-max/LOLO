-- Personal invitation tokens for event_guests.
-- Run in the SQL Editor after event-guests.sql.
-- Does not change RLS: anon/authenticated still have no access.
-- Existing rows stay readable; the app backfills tokens on host dashboard load
-- and when new guests are created.

alter table public.event_guests
  add column if not exists invite_token_hash text,
  add column if not exists invite_token_enc text;

create unique index if not exists event_guests_invite_token_hash_uidx
  on public.event_guests (invite_token_hash)
  where invite_token_hash is not null;
