-- Business fields for the existing stores catalog.
-- Run in the Supabase SQL Editor after supabase/stores.sql.
-- Does not insert rows and does not change events, gifts, orders, or payments.
-- Existing stores keep their name, slug, and active flag. New fields stay empty.
-- Anon and authenticated may still read only the public catalog columns,
-- and only for active stores. Business fields and all writes stay on the service role.

alter table public.stores add column if not exists logo_url text;
alter table public.stores add column if not exists website_url text;
alter table public.stores add column if not exists contact_name text;
alter table public.stores add column if not exists contact_phone text;
alter table public.stores add column if not exists contact_email text;
alter table public.stores add column if not exists commission_percent numeric(5, 2);
alter table public.stores add column if not exists payment_terms_days integer;
alter table public.stores add column if not exists settlement_method text;
alter table public.stores add column if not exists voucher_redemption_method text;
alter table public.stores add column if not exists voucher_validity_days integer;
alter table public.stores add column if not exists allow_partial_redemption boolean;
alter table public.stores add column if not exists allow_customer_topup boolean;
alter table public.stores add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_logo_url_length'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_logo_url_length
      check (logo_url is null or (char_length(btrim(logo_url)) > 0 and char_length(logo_url) <= 500));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_website_url_length'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_website_url_length
      check (website_url is null or (char_length(btrim(website_url)) > 0 and char_length(website_url) <= 500));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_contact_name_length'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_contact_name_length
      check (contact_name is null or (char_length(btrim(contact_name)) > 0 and char_length(contact_name) <= 120));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_contact_phone_length'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_contact_phone_length
      check (contact_phone is null or (char_length(btrim(contact_phone)) > 0 and char_length(contact_phone) <= 40));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_contact_email_length'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_contact_email_length
      check (contact_email is null or (char_length(btrim(contact_email)) > 0 and char_length(contact_email) <= 160));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_commission_percent_range'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_commission_percent_range
      check (
        commission_percent is null
        or (commission_percent >= 0 and commission_percent <= 100)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_payment_terms_days_range'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_payment_terms_days_range
      check (
        payment_terms_days is null
        or (payment_terms_days >= 0 and payment_terms_days <= 3650)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_settlement_method_values'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_settlement_method_values
      check (
        settlement_method is null
        or settlement_method in ('bank_transfer', 'invoice', 'manual', 'other')
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_voucher_redemption_method_length'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_voucher_redemption_method_length
      check (
        voucher_redemption_method is null
        or (
          char_length(btrim(voucher_redemption_method)) > 0
          and char_length(voucher_redemption_method) <= 80
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_voucher_validity_days_range'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_voucher_validity_days_range
      check (
        voucher_validity_days is null
        or (voucher_validity_days >= 1 and voucher_validity_days <= 3650)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_notes_length'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_notes_length
      check (notes is null or (char_length(btrim(notes)) > 0 and char_length(notes) <= 2000));
  end if;
end;
$$;

revoke all on table public.stores from anon, authenticated, public;
grant select (id, name, slug, active, created_at, updated_at)
  on table public.stores to anon, authenticated;
grant all on table public.stores to service_role;
