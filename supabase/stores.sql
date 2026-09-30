-- Supported store catalog. Run this entire file in the Supabase SQL Editor.
-- Does not change events, event_gifts, orders, guests, invites, or host access.
-- Anon and authenticated may read active stores only. They cannot insert,
-- update, or delete. Management writes stay on the service role.
-- This file does not insert store rows.

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint stores_name_not_blank check (char_length(btrim(name)) > 0),
  constraint stores_name_length check (char_length(name) <= 120),
  constraint stores_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) <= 80
  ),
  constraint stores_slug_unique unique (slug)
);

create or replace function public.stores_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row
execute procedure public.stores_set_updated_at();

alter table public.stores enable row level security;

drop policy if exists "Public can read active stores" on public.stores;
create policy "Public can read active stores"
  on public.stores
  for select
  to anon, authenticated
  using (active = true);

revoke all on table public.stores from anon, authenticated, public;
grant select on table public.stores to anon, authenticated;
grant all on table public.stores to service_role;
