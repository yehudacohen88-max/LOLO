-- Custom gifts: image URL and origin marker on event_gifts, plus a public
-- gift-images bucket. Run once in the Supabase SQL Editor before the app
-- version that writes these columns is deployed. Safe to re-run.
--
-- Does not change events, orders, payments, guests, host access, stores,
-- or existing RLS/grants on those tables. Does not rewrite existing gift
-- rows beyond filling defaults on the new columns.
--
-- title, description, and target_amount already exist. description is
-- repeated below only so a partial schema still gains the column.

alter table public.event_gifts
  add column if not exists description text not null default '';

alter table public.event_gifts
  add column if not exists image_url text not null default '';

alter table public.event_gifts
  add column if not exists source text not null default 'catalog';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_gifts_image_url_length'
      and conrelid = 'public.event_gifts'::regclass
  ) then
    alter table public.event_gifts
      add constraint event_gifts_image_url_length
      check (char_length(image_url) <= 500);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_gifts_source_check'
      and conrelid = 'public.event_gifts'::regclass
  ) then
    alter table public.event_gifts
      add constraint event_gifts_source_check
      check (source in ('custom', 'catalog'));
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-images',
  'gift-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read of this bucket only. No insert/update/delete policy: anon and
-- authenticated cannot write. The service role bypasses storage RLS and is
-- the only writer (server route handler).
drop policy if exists "Gift images are publicly readable" on storage.objects;
create policy "Gift images are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'gift-images');

drop policy if exists "Public can upload gift images" on storage.objects;
drop policy if exists "Public can update gift images" on storage.objects;
drop policy if exists "Public can delete gift images" on storage.objects;
