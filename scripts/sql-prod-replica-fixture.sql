-- Synthetic rows for the production-schema replica. Invented values only.
-- Inserted after the schema that is already in Production, and before the
-- SQL files that are not applied there yet.

insert into public.stores (id, name, slug, active, notes)
values (
  'c1000000-0000-4000-8000-000000000001',
  'חנות סכמה לדוגמה',
  'demo-schema-replica',
  false,
  'נתונים לדוגמה'
)
on conflict (id) do nothing;

insert into public.events (
  id, slug, title, host_name, event_type, event_date, event_time,
  venue_name, address, message, cover_image, gift_mode, money_amounts,
  allow_custom_amount, money_display
)
values (
  'c1000000-0000-4000-8000-000000000002',
  'schema-replica-sample',
  'אירוע סכמה — נתונים לדוגמה',
  'משפחת סכמה',
  'יום הולדת',
  '2026-01-01',
  '12:00',
  'מקום לדוגמה',
  'רחוב לדוגמה 1',
  'נתונים לדוגמה. אין כאן אדם אמיתי ואין כאן תשלום.',
  '',
  'catalog',
  '{}'::integer[],
  true,
  'amounts'
)
on conflict (id) do nothing;

insert into public.event_host_access (event_id, code_hash)
values (
  'c1000000-0000-4000-8000-000000000002',
  'not-a-real-code'
)
on conflict (event_id) do nothing;

insert into public.event_gifts (
  id, event_id, title, description, target_amount, icon, priority, active,
  image_url, source, store_id, store_name
)
values (
  'c1000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000002',
  'מתנה לדוגמה',
  'נתונים לדוגמה',
  100,
  '',
  0,
  true,
  '',
  'custom',
  'c1000000-0000-4000-8000-000000000001',
  'חנות סכמה לדוגמה'
)
on conflict (id) do nothing;

insert into public.event_guests (id, event_id, name, phone)
values (
  'c1000000-0000-4000-8000-000000000004',
  'c1000000-0000-4000-8000-000000000002',
  'אורח לדוגמה',
  '0500000001'
)
on conflict (id) do nothing;

insert into public.orders (
  id, event_id, event_slug, guest_name, guest_phone, guest_email,
  wants_confirmation, greeting_text, total_amount, payment_status,
  access_token, fee_amount, charged_amount, payment_provider, payment_reference
)
values (
  'c1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000002',
  'schema-replica-sample',
  'אורח לדוגמה',
  '0500000001',
  'schema-replica@example.com',
  false,
  'נתונים לדוגמה',
  50,
  'pending',
  'c1000000-0000-4000-8000-000000000006',
  0,
  50,
  'demo',
  'demo-schema-replica'
)
on conflict (id) do nothing;

insert into public.order_items (id, order_id, gift_id, gift_name, amount)
values (
  'c1000000-0000-4000-8000-000000000007',
  'c1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000003',
  'מתנה לדוגמה',
  50
)
on conflict (id) do nothing;
