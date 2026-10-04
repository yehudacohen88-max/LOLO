-- Optional store link on event gifts. Run in the Supabase SQL Editor
-- after supabase/stores.sql. Does not change orders, payments, guests,
-- or host access, and does not require a store on existing gifts.
-- store_name is a snapshot from publish time. Later store renames do not
-- rewrite it. Deleting a store clears store_id and keeps the snapshot.

alter table public.event_gifts
  add column if not exists store_id uuid;

alter table public.event_gifts
  add column if not exists store_name text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_gifts_store_id_fkey'
      and conrelid = 'public.event_gifts'::regclass
  ) then
    alter table public.event_gifts
      add constraint event_gifts_store_id_fkey
      foreign key (store_id)
      references public.stores (id)
      on delete set null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_gifts_store_name_length'
      and conrelid = 'public.event_gifts'::regclass
  ) then
    alter table public.event_gifts
      add constraint event_gifts_store_name_length
      check (char_length(store_name) <= 120);
  end if;
end;
$$;

create index if not exists event_gifts_store_id_idx
  on public.event_gifts (store_id);
