-- Notifications and test documents.
-- Run this entire file in the Supabase SQL Editor after supabase/demo-checkout.sql
-- (public.orders and public.platform_settings must already exist).
-- Safe to re-run. The app does not apply this file.
-- Do not run it against a remote database from CI or from a laptop script
-- that points at Production.
--
-- Providers in the app are simulated. Rows written here are a log, not a
-- delivery, and documents are watermarked test copies. VAT rate, VAT
-- treatment, document type, and currency are columns on platform_settings
-- and stay null until someone sets them. This file does not invent a rate.
--
-- RLS is enabled and no policies are created. The service role bypasses RLS.
-- anon, authenticated, and public have no grants.

do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'public.orders is missing. Run supabase/orders.sql first.';
  end if;
  if to_regclass('public.platform_settings') is null then
    raise exception 'public.platform_settings is missing. Run supabase/demo-checkout.sql first.';
  end if;
end;
$$;

create table if not exists public.notification_templates (
  id text primary key,
  event_type text not null,
  locale text not null default 'he',
  channel text not null,
  subject text not null default '',
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_templates add column if not exists event_type text;
alter table public.notification_templates add column if not exists locale text;
alter table public.notification_templates add column if not exists channel text;
alter table public.notification_templates add column if not exists subject text;
alter table public.notification_templates add column if not exists body text;
alter table public.notification_templates add column if not exists created_at timestamptz;
alter table public.notification_templates add column if not exists updated_at timestamptz;

create table if not exists public.notification_messages (
  id uuid primary key default gen_random_uuid(),
  template_id text,
  locale text not null default 'he',
  event_type text not null,
  entity_id text not null,
  recipient text not null,
  channel text not null,
  status text not null,
  provider text not null,
  provider_message_id text,
  provider_response text,
  error text,
  subject text not null default '',
  body text not null,
  related_order_id uuid,
  simulated boolean not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_messages add column if not exists template_id text;
alter table public.notification_messages add column if not exists locale text;
alter table public.notification_messages add column if not exists event_type text;
alter table public.notification_messages add column if not exists entity_id text;
alter table public.notification_messages add column if not exists recipient text;
alter table public.notification_messages add column if not exists channel text;
alter table public.notification_messages add column if not exists status text;
alter table public.notification_messages add column if not exists provider text;
alter table public.notification_messages add column if not exists provider_message_id text;
alter table public.notification_messages add column if not exists provider_response text;
alter table public.notification_messages add column if not exists error text;
alter table public.notification_messages add column if not exists subject text;
alter table public.notification_messages add column if not exists body text;
alter table public.notification_messages add column if not exists related_order_id uuid;
alter table public.notification_messages add column if not exists simulated boolean;
alter table public.notification_messages add column if not exists created_at timestamptz;
alter table public.notification_messages add column if not exists updated_at timestamptz;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  order_ref text not null default '',
  settlement_id uuid,
  payment_reference text,
  kind text not null,
  provider text not null,
  external_id text not null,
  simulated boolean not null,
  demo_order boolean not null,
  watermark text not null,
  body text not null,
  vat_rate_percent numeric(6, 3) not null,
  vat_included boolean not null,
  currency text not null,
  amount_net numeric(12, 2) not null,
  amount_vat numeric(12, 2) not null,
  amount_gross numeric(12, 2) not null,
  status text not null,
  related_document_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.documents add column if not exists order_id uuid;
alter table public.documents add column if not exists order_ref text;
alter table public.documents add column if not exists settlement_id uuid;
alter table public.documents add column if not exists payment_reference text;
alter table public.documents add column if not exists kind text;
alter table public.documents add column if not exists provider text;
alter table public.documents add column if not exists external_id text;
alter table public.documents add column if not exists simulated boolean;
alter table public.documents add column if not exists demo_order boolean;
alter table public.documents add column if not exists watermark text;
alter table public.documents add column if not exists body text;
alter table public.documents add column if not exists vat_rate_percent numeric(6, 3);
alter table public.documents add column if not exists vat_included boolean;
alter table public.documents add column if not exists currency text;
alter table public.documents add column if not exists amount_net numeric(12, 2);
alter table public.documents add column if not exists amount_vat numeric(12, 2);
alter table public.documents add column if not exists amount_gross numeric(12, 2);
alter table public.documents add column if not exists status text;
alter table public.documents add column if not exists related_document_id uuid;
alter table public.documents add column if not exists created_at timestamptz;
alter table public.documents add column if not exists updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_templates_channel'
      and conrelid = 'public.notification_templates'::regclass
  ) then
    alter table public.notification_templates
      add constraint notification_templates_channel
      check (channel in ('email', 'sms', 'whatsapp'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_templates_event_type'
      and conrelid = 'public.notification_templates'::regclass
  ) then
    alter table public.notification_templates
      add constraint notification_templates_event_type
      check (event_type in (
        'purchase_confirmed',
        'contribution_updated',
        'voucher_issued',
        'voucher_redeemed',
        'refund'
      ));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_templates_locale'
      and conrelid = 'public.notification_templates'::regclass
  ) then
    alter table public.notification_templates
      add constraint notification_templates_locale
      check (locale = 'he');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_templates_event_locale_channel'
      and conrelid = 'public.notification_templates'::regclass
  ) then
    alter table public.notification_templates
      add constraint notification_templates_event_locale_channel
      unique (event_type, locale, channel);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_messages_channel'
      and conrelid = 'public.notification_messages'::regclass
  ) then
    alter table public.notification_messages
      add constraint notification_messages_channel
      check (channel in ('email', 'sms', 'whatsapp'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_messages_status'
      and conrelid = 'public.notification_messages'::regclass
  ) then
    alter table public.notification_messages
      add constraint notification_messages_status
      check (status in ('queued', 'sent_simulated', 'failed'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_messages_event_type'
      and conrelid = 'public.notification_messages'::regclass
  ) then
    alter table public.notification_messages
      add constraint notification_messages_event_type
      check (event_type in (
        'purchase_confirmed',
        'contribution_updated',
        'voucher_issued',
        'voucher_redeemed',
        'refund'
      ));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_messages_simulated_provider'
      and conrelid = 'public.notification_messages'::regclass
  ) then
    alter table public.notification_messages
      add constraint notification_messages_simulated_provider
      check (provider <> 'simulated' or simulated = true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_messages_sent_is_simulated'
      and conrelid = 'public.notification_messages'::regclass
  ) then
    alter table public.notification_messages
      add constraint notification_messages_sent_is_simulated
      check (status <> 'sent_simulated' or simulated = true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_messages_idempotency'
      and conrelid = 'public.notification_messages'::regclass
  ) then
    alter table public.notification_messages
      add constraint notification_messages_idempotency
      unique (event_type, entity_id, recipient, channel);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_messages_order_fkey'
      and conrelid = 'public.notification_messages'::regclass
  ) then
    alter table public.notification_messages
      add constraint notification_messages_order_fkey
      foreign key (related_order_id) references public.orders (id) on delete set null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_kind'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_kind
      check (kind in ('receipt', 'invoice', 'credit'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_status'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_status
      check (status in ('issued', 'cancelled'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_simulated_provider'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_simulated_provider
      check (provider <> 'simulated' or simulated = true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_demo_is_simulated'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_demo_is_simulated
      check (demo_order = false or simulated = true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_test_watermark'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_test_watermark
      check (
        simulated = false
        or watermark = 'מסמך בדיקה – אינו מסמך חשבונאי'
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_vat_rate_range'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_vat_rate_range
      check (vat_rate_percent >= 0 and vat_rate_percent <= 100);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_currency_code'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_currency_code
      check (currency ~ '^[A-Z]{3}$');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_order_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_order_fkey
      foreign key (order_id) references public.orders (id) on delete set null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_related_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_related_fkey
      foreign key (related_document_id) references public.documents (id) on delete restrict;
  end if;
end;
$$;

create index if not exists notification_messages_created_at_idx
  on public.notification_messages (created_at desc);
create index if not exists notification_messages_order_idx
  on public.notification_messages (related_order_id);
create index if not exists documents_created_at_idx
  on public.documents (created_at desc);
create index if not exists documents_order_idx
  on public.documents (order_id);

create unique index if not exists documents_one_open_kind_per_order
  on public.documents (order_id, kind)
  where status = 'issued' and order_id is not null and kind in ('receipt', 'invoice');

create unique index if not exists documents_one_credit_per_original
  on public.documents (related_document_id)
  where kind = 'credit' and related_document_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists notification_templates_set_updated_at on public.notification_templates;
create trigger notification_templates_set_updated_at
before update on public.notification_templates
for each row
execute procedure public.set_updated_at();

drop trigger if exists notification_messages_set_updated_at on public.notification_messages;
create trigger notification_messages_set_updated_at
before update on public.notification_messages
for each row
execute procedure public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row
execute procedure public.set_updated_at();

insert into public.notification_templates (id, event_type, locale, channel, subject, body)
values
  (
    'purchase_confirmed.email.he',
    'purchase_confirmed',
    'he',
    'email',
    'אישור השתתפות במתנה – {{eventTitle}}',
    $tpl$שלום {{guestName}},
תודה על ההשתתפות באירוע {{eventTitle}}.
הסכום שחויב: {{chargedAmount}}{{currencySuffix}}
מספר הזמנה: {{orderId}}
{{paymentNote}}$tpl$
  ),
  (
    'purchase_confirmed.sms.he',
    'purchase_confirmed',
    'he',
    'sms',
    '',
    'שלום {{guestName}}, אישרנו השתתפות ב{{eventTitle}} על סך {{chargedAmount}}{{currencySuffix}}. הזמנה {{orderId}}. {{paymentNote}}'
  ),
  (
    'purchase_confirmed.whatsapp.he',
    'purchase_confirmed',
    'he',
    'whatsapp',
    '',
    'שלום {{guestName}}, אישרנו השתתפות ב{{eventTitle}} על סך {{chargedAmount}}{{currencySuffix}}. הזמנה {{orderId}}. {{paymentNote}}'
  ),
  (
    'contribution_updated.email.he',
    'contribution_updated',
    'he',
    'email',
    'עדכון השתתפות – {{eventTitle}}',
    $tpl$שלום {{hostName}},
התקבלה השתתפות חדשה באירוע {{eventTitle}}.
מאת: {{guestName}}
סכום ההשתתפות: {{amount}}{{currencySuffix}}
מספר הזמנה: {{orderId}}
{{paymentNote}}$tpl$
  ),
  (
    'contribution_updated.sms.he',
    'contribution_updated',
    'he',
    'sms',
    '',
    '{{hostName}}, התקבלה השתתפות מ{{guestName}} ל{{eventTitle}} על סך {{amount}}{{currencySuffix}}. הזמנה {{orderId}}.'
  ),
  (
    'contribution_updated.whatsapp.he',
    'contribution_updated',
    'he',
    'whatsapp',
    '',
    '{{hostName}}, התקבלה השתתפות מ{{guestName}} ל{{eventTitle}} על סך {{amount}}{{currencySuffix}}. הזמנה {{orderId}}.'
  ),
  (
    'voucher_issued.email.he',
    'voucher_issued',
    'he',
    'email',
    'הונפק שובר – {{eventTitle}}',
    $tpl$הונפק שובר לאירוע {{eventTitle}}.
מתנה: {{giftTitle}}
סכום: {{amount}}{{currencySuffix}}
קוד שובר: {{voucherCode}}
בית עסק: {{storeName}}$tpl$
  ),
  (
    'voucher_issued.sms.he',
    'voucher_issued',
    'he',
    'sms',
    '',
    'הונפק שובר ל{{eventTitle}} על סך {{amount}}{{currencySuffix}}. קוד {{voucherCode}}.'
  ),
  (
    'voucher_issued.whatsapp.he',
    'voucher_issued',
    'he',
    'whatsapp',
    '',
    'הונפק שובר ל{{eventTitle}} על סך {{amount}}{{currencySuffix}}. קוד {{voucherCode}}.'
  ),
  (
    'voucher_redeemed.email.he',
    'voucher_redeemed',
    'he',
    'email',
    'שובר מומש – {{storeName}}',
    $tpl$שובר מומש.
קוד: {{voucherCode}}
סכום שמומש: {{amount}}{{currencySuffix}}
בית עסק: {{storeName}}
אירוע: {{eventTitle}}$tpl$
  ),
  (
    'voucher_redeemed.sms.he',
    'voucher_redeemed',
    'he',
    'sms',
    '',
    'שובר {{voucherCode}} מומש על סך {{amount}}{{currencySuffix}} ב{{storeName}}.'
  ),
  (
    'voucher_redeemed.whatsapp.he',
    'voucher_redeemed',
    'he',
    'whatsapp',
    '',
    'שובר {{voucherCode}} מומש על סך {{amount}}{{currencySuffix}} ב{{storeName}}.'
  ),
  (
    'refund.email.he',
    'refund',
    'he',
    'email',
    'עדכון החזר – {{eventTitle}}',
    $tpl$שלום {{guestName}},
נרשם החזר עבור הזמנה {{orderId}} באירוע {{eventTitle}}.
סכום ההחזר: {{amount}}{{currencySuffix}}
{{paymentNote}}$tpl$
  ),
  (
    'refund.sms.he',
    'refund',
    'he',
    'sms',
    '',
    'שלום {{guestName}}, נרשם החזר על סך {{amount}}{{currencySuffix}} להזמנה {{orderId}}. {{paymentNote}}'
  ),
  (
    'refund.whatsapp.he',
    'refund',
    'he',
    'whatsapp',
    '',
    'שלום {{guestName}}, נרשם החזר על סך {{amount}}{{currencySuffix}} להזמנה {{orderId}}. {{paymentNote}}'
  )
on conflict (id) do nothing;

alter table public.platform_settings
  add column if not exists vat_rate_percent numeric(6, 3);
alter table public.platform_settings
  add column if not exists vat_included boolean;
alter table public.platform_settings
  add column if not exists default_document_kind text;
alter table public.platform_settings
  add column if not exists document_currency text;
alter table public.platform_settings
  add column if not exists notification_channels text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_vat_rate_range'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_vat_rate_range
      check (vat_rate_percent is null or (vat_rate_percent >= 0 and vat_rate_percent <= 100));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_document_kind'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_document_kind
      check (
        default_document_kind is null
        or default_document_kind in ('receipt', 'invoice')
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_document_currency'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_document_currency
      check (document_currency is null or document_currency ~ '^[A-Z]{3}$');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_notification_channels'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_notification_channels
      check (
        notification_channels is null
        or notification_channels <@ array['email', 'sms', 'whatsapp']::text[]
      );
  end if;
end;
$$;

update public.platform_settings
set notification_channels = array['email']::text[]
where id = 'default'
  and notification_channels is null;

alter table public.notification_templates enable row level security;
alter table public.notification_messages enable row level security;
alter table public.documents enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.notification_templates from anon;
    revoke all on table public.notification_messages from anon;
    revoke all on table public.documents from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.notification_templates from authenticated;
    revoke all on table public.notification_messages from authenticated;
    revoke all on table public.documents from authenticated;
  end if;
  revoke all on table public.notification_templates from public;
  revoke all on table public.notification_messages from public;
  revoke all on table public.documents from public;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.notification_templates to service_role;
    grant all on table public.notification_messages to service_role;
    grant all on table public.documents to service_role;
  end if;
end;
$$;

comment on table public.notification_templates is
  'Hebrew notification copy. Edit rows to change wording. No anon access.';
comment on table public.notification_messages is
  'Send log. One row per event, entity, recipient, and channel. Simulated providers never call a network.';
comment on table public.documents is
  'Receipts, invoices, and credits. simulated documents keep the test watermark. No anon access.';
comment on column public.platform_settings.vat_rate_percent is
  'VAT percent used when issuing a document. Null means unset. No rate is assumed.';
comment on column public.platform_settings.vat_included is
  'True when the charged amount already includes VAT. Null means unset.';
comment on column public.platform_settings.default_document_kind is
  'receipt or invoice. Null means unset, and no document is issued.';
comment on column public.platform_settings.document_currency is
  'ISO currency code snapshotted onto documents. Null means unset.';
comment on column public.platform_settings.notification_channels is
  'Channels used by notification hooks: email, sms, whatsapp. Null means unset.';
