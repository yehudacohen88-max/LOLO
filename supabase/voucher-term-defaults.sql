-- Voucher term fallbacks on platform_settings.
-- Run this entire file in the Supabase SQL Editor only after it has been reviewed.
-- Do not run it from the app, from CI, or against Production until that approval.
--
-- Prerequisites: public.platform_settings (supabase/demo-checkout.sql).
-- Safe to re-run. Adds four nullable columns. Does not update existing rows,
-- does not set a default of 365 days, and does not replace issue_gift_voucher,
-- redeem_voucher, or cancel_voucher.
-- demo_only stays owned by supabase/pilot-demo-voucher-guard.sql.
--
-- Until this file is applied, issuing a voucher fails closed. The app does not
-- invent a validity, a partial-redeem flag, a top-up flag, or a redemption method.
-- After it is applied the four columns stay null until someone sets them on the
-- default row. A store value still wins. When both are null, issue is refused.
-- Issued vouchers keep the snapshot columns already on public.vouchers.
-- Changing these columns never rewrites an issued voucher.

alter table public.platform_settings
  add column if not exists voucher_default_validity_days integer;
alter table public.platform_settings
  add column if not exists voucher_default_allow_partial boolean;
alter table public.platform_settings
  add column if not exists voucher_default_allow_topup boolean;
alter table public.platform_settings
  add column if not exists voucher_default_redemption_method text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_voucher_default_validity_days_range'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_voucher_default_validity_days_range
      check (
        voucher_default_validity_days is null
        or (
          voucher_default_validity_days >= 1
          and voucher_default_validity_days <= 3650
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_voucher_default_redemption_method_length'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_voucher_default_redemption_method_length
      check (
        voucher_default_redemption_method is null
        or (
          char_length(btrim(voucher_default_redemption_method)) > 0
          and char_length(voucher_default_redemption_method) <= 80
        )
      );
  end if;
end;
$$;

comment on column public.platform_settings.voucher_default_validity_days is
  'Fallback validity in days when the store left voucher_validity_days empty. Null refuses issue. Not copied onto existing vouchers.';
comment on column public.platform_settings.voucher_default_allow_partial is
  'Fallback for allow_partial_redemption. Null refuses issue. The issued voucher keeps its own snapshot.';
comment on column public.platform_settings.voucher_default_allow_topup is
  'Fallback for allow_customer_topup. Null refuses issue. Does not charge a top-up.';
comment on column public.platform_settings.voucher_default_redemption_method is
  'Fallback redemption method shown to the host and the store. Null refuses issue.';
