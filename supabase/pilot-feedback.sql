-- REQUIRES APPROVAL. Do not run this file until Yehuda approves it.
-- Deploy does not apply it. /feedback stays closed until public.pilot_feedback exists.
-- This file creates one new table. It does not read or change events, gifts,
-- orders, stores, vouchers, redemptions, or settlements.

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  role text not null,
  device text not null,
  completed text not null,
  clarity smallint not null,
  demo_payment_clear boolean not null,
  would_use text not null,
  notes text not null default '',
  constraint pilot_feedback_role_values check (role in ('host', 'guest', 'store')),
  constraint pilot_feedback_device_values check (device in ('phone', 'desktop')),
  constraint pilot_feedback_completed_values check (completed in ('yes', 'partial', 'no')),
  constraint pilot_feedback_clarity_range check (clarity between 1 and 5),
  constraint pilot_feedback_would_use_values check (would_use in ('yes', 'maybe', 'no')),
  constraint pilot_feedback_notes_length check (char_length(notes) <= 1000)
);

create index if not exists pilot_feedback_created_at_idx
  on public.pilot_feedback (created_at desc);

alter table public.pilot_feedback enable row level security;

revoke all on table public.pilot_feedback from anon, authenticated, public;
grant select, insert on table public.pilot_feedback to service_role;

comment on table public.pilot_feedback is
  'Closed-pilot feedback. Service role only. No anon policies.';
