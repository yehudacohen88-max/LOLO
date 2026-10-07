-- LOLO demo event. Optional, manual, and safe to run more than once.
-- Run in the Supabase SQL Editor after supabase/settlements.sql.
-- This file does not change RLS, grants, or earlier schema files.
-- If the demo event already exists, it changes nothing.
-- Remove it later with supabase/demo-cleanup.sql only.
--
-- Host login
--   Event address: demo-bat-mitzvah-noa
--   Host code:     DEMO-LOLO
--   The code hash below was produced with the same PBKDF2 settings as
--   lib/host/access-code.ts (sha256, 210000 iterations). Regenerate with
--   node scripts/hash-demo-access.mjs
--
-- Store login
--   Only stores this file creates (slug demo-ofanaim / demo-sefer) receive
--   the code DEMO-SHOP-CODE. They are inserted inactive. Activate the store
--   in admin before signing in at /store. An existing store keeps its own
--   code and its active flag.

do $$
declare
  event_slug constant text := 'demo-bat-mitzvah-noa';
  event_id uuid := 'b1000000-0000-4000-8000-000000000001';
  gift_bike uuid := 'b2000000-0000-4000-8000-000000000001';
  gift_books uuid := 'b2000000-0000-4000-8000-000000000002';
  gift_headphones uuid := 'b2000000-0000-4000-8000-000000000003';
  host_hash constant text := 'pbkdf2$sha256$210000$Pi0ky5cWo3-7jr1CYexXvQ$Nun-jtMJBiMF9jP_CbQrJGjgT0wKBDezhIcp3mVzFe4';
  store_hash constant text := 'pbkdf2$sha256$210000$OZjp_-jdyHUZdsXWOfqYYw$9SY_oxw89flpvxIgbSSACMEpZEGSpBuFAK8nmrgb1D0';
  store_a_id uuid;
  store_b_id uuid;
  store_a_name text;
  store_b_name text;
  store_a_slug text;
  store_b_slug text;
  store_a_active boolean;
  store_b_active boolean;
  skip_vouchers boolean := false;
  issued jsonb;
  open_voucher uuid;
begin
  if exists (select 1 from public.events where slug = event_slug) then
    raise notice 'Demo event % already exists. Nothing was changed.', event_slug;
    return;
  end if;

  select id, name, slug, active
    into store_a_id, store_a_name, store_a_slug, store_a_active
  from public.stores
  where slug not like 'demo-%'
  order by active desc, name
  limit 1;

  if store_a_id is null then
    insert into public.stores (
      id, name, slug, active, commission_percent, payment_terms_days,
      settlement_method, voucher_redemption_method, voucher_validity_days,
      allow_partial_redemption, allow_customer_topup, notes, contact_name
    )
    values (
      'a1000000-0000-4000-8000-000000000001',
      'אופנים — הדגמה',
      'demo-ofanaim',
      false,
      10,
      30,
      'bank_transfer',
      'בחנות',
      365,
      true,
      true,
      'חנות הדגמה של LOLO. לא לשימוש אמיתי.',
      'צוות הדגמה'
    )
    on conflict (slug) do nothing;

    select id, name, slug, active
      into store_a_id, store_a_name, store_a_slug, store_a_active
    from public.stores
    where slug = 'demo-ofanaim';
  end if;

  select id, name, slug, active
    into store_b_id, store_b_name, store_b_slug, store_b_active
  from public.stores
  where slug not like 'demo-%'
    and id is distinct from store_a_id
  order by active desc, name
  limit 1;

  if store_b_id is null and store_a_slug like 'demo-%' then
    insert into public.stores (
      id, name, slug, active, commission_percent, payment_terms_days,
      settlement_method, voucher_redemption_method, voucher_validity_days,
      allow_partial_redemption, allow_customer_topup, notes, contact_name
    )
    values (
      'a1000000-0000-4000-8000-000000000002',
      'חנות הספרים — הדגמה',
      'demo-sefer',
      false,
      8,
      30,
      'bank_transfer',
      'בחנות',
      365,
      true,
      false,
      'חנות הדגמה של LOLO. לא לשימוש אמיתי.',
      'צוות הדגמה'
    )
    on conflict (slug) do nothing;

    select id, name, slug, active
      into store_b_id, store_b_name, store_b_slug, store_b_active
    from public.stores
    where slug = 'demo-sefer';
  end if;

  if store_b_id is null then
    store_b_id := store_a_id;
    store_b_name := store_a_name;
    store_b_slug := store_a_slug;
    store_b_active := store_a_active;
  end if;

  if store_a_id is null then
    raise exception 'Could not resolve a store for the demo event.';
  end if;

  insert into public.events (
    id, slug, title, host_name, event_type, event_date, event_time,
    venue_name, address, message, cover_image, gift_mode, money_amounts,
    allow_custom_amount, money_display
  )
  values (
    event_id,
    event_slug,
    'בת המצווה של נועה',
    'משפחת לוי',
    'בת מצווה',
    '2026-11-20',
    '19:00',
    'אולם הדגמה',
    'רחוב הדגמה 1, תל אביב',
    'אירוע הדגמה של LOLO. השמות והטלפונים כאן בדויים.',
    '',
    'catalog',
    '{}'::integer[],
    true,
    'amounts'
  );

  insert into public.event_host_access (event_id, code_hash)
  values (event_id, host_hash);

  insert into public.event_gifts (
    id, event_id, title, description, target_amount, icon, priority, active,
    image_url, source, store_id, store_name
  )
  values
    (
      gift_bike, event_id, 'אופניים חדשים',
      'אופניים לדרך לבית הספר. יעד הדגמה, בלי תקרה.',
      2500, '🚲', 0, true, '', 'custom', store_a_id, store_a_name
    ),
    (
      gift_books, event_id, 'ספרייה קטנה',
      'ספרים שהיא באמת רוצה לקרוא.',
      600, '📚', 1, true, '', 'custom', store_b_id, store_b_name
    ),
    (
      gift_headphones, event_id, 'אוזניות',
      'אוזניות טובות למוזיקה בדרך.',
      900, '🎧', 2, true, '', 'custom', store_a_id, store_a_name
    );

  insert into public.event_guests (id, event_id, name, phone)
  values
    ('b3000000-0000-4000-8000-000000000001', event_id, 'יעל כהן', '0500001101'),
    ('b3000000-0000-4000-8000-000000000002', event_id, 'דני אברהם', '0500001102'),
    ('b3000000-0000-4000-8000-000000000003', event_id, 'מיכל רוזן', '0500001103'),
    ('b3000000-0000-4000-8000-000000000004', event_id, 'רחל מזרחי', '0500001104');

  insert into public.orders (
    id, event_id, event_slug, guest_name, guest_phone, guest_email,
    wants_confirmation, greeting_text, total_amount, payment_status,
    access_token, fee_amount, charged_amount, payment_provider,
    payment_reference, paid_at
  )
  values
    (
      'b4000000-0000-4000-8000-000000000001', event_id, event_slug,
      'יעל כהן', '0500001101', 'yael.demo@example.com', true,
      'נועה, שתמיד תרקדי בדרך. אוהבת, יעל.',
      1800, 'paid', 'b4100000-0000-4000-8000-000000000001',
      90, 1890, 'demo', 'demo-seed-bike-1', timezone('utc', now())
    ),
    (
      'b4000000-0000-4000-8000-000000000002', event_id, event_slug,
      'דני אברהם', '0500001102', 'dani.demo@example.com', true,
      'לנסיעות הראשונות, באהבה מדני.',
      1200, 'paid', 'b4100000-0000-4000-8000-000000000002',
      60, 1260, 'demo', 'demo-seed-bike-2', timezone('utc', now())
    ),
    (
      'b4000000-0000-4000-8000-000000000003', event_id, event_slug,
      'מיכל רוזן', '0500001103', 'michal.demo@example.com', true,
      'ספר שילווה אותך השנה, מיכל.',
      200, 'paid', 'b4100000-0000-4000-8000-000000000003',
      10, 210, 'demo', 'demo-seed-books-1', timezone('utc', now())
    ),
    (
      'b4000000-0000-4000-8000-000000000004', event_id, event_slug,
      'רחל מזרחי', '0500001104', 'rachel.demo@example.com', true,
      'שתשמעי את העולם כמו שאת רוצה.',
      900, 'paid', 'b4100000-0000-4000-8000-000000000004',
      45, 945, 'demo', 'demo-seed-headphones-1', timezone('utc', now())
    ),
    (
      'b4000000-0000-4000-8000-000000000005', event_id, event_slug,
      'עומר חדד', '0500001105', 'omer.demo@example.com', true,
      'עוד ספר בדרך, מחכים לאשר את התשלום.',
      150, 'pending', 'b4100000-0000-4000-8000-000000000005',
      7.50, 157.50, null, null, null
    );

  insert into public.order_items (id, order_id, gift_id, gift_name, amount)
  values
    ('b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', gift_bike, 'אופניים חדשים', 1800),
    ('b5000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000002', gift_bike, 'אופניים חדשים', 1200),
    ('b5000000-0000-4000-8000-000000000003', 'b4000000-0000-4000-8000-000000000003', gift_books, 'ספרייה קטנה', 200),
    ('b5000000-0000-4000-8000-000000000004', 'b4000000-0000-4000-8000-000000000004', gift_headphones, 'אוזניות', 900),
    ('b5000000-0000-4000-8000-000000000005', 'b4000000-0000-4000-8000-000000000005', gift_books, 'ספרייה קטנה', 150);

  insert into public.store_redemption_access (store_id, code_hash)
  select id, store_hash
  from public.stores
  where id in (store_a_id, store_b_id)
    and slug like 'demo-%'
  on conflict (store_id) do nothing;

  if store_a_active is distinct from true then
    if store_a_slug like 'demo-%' then
      update public.stores set active = true where id = store_a_id;
    else
      skip_vouchers := true;
      raise notice 'Store % is inactive, so demo vouchers were not issued.', store_a_slug;
    end if;
  end if;

  if not skip_vouchers then
    issued := public.issue_gift_voucher(
      event_id,
      gift_bike,
      store_a_id,
      'DEMO-BIKE-GIFT-0001',
      'demo-qr-secret-bat-mitzvah-bike-0001',
      'demo-view-bat-mitzvah-bike-0001-aaaa',
      'c1000000-0000-4000-8000-000000000001',
      365,
      true,
      true,
      'בחנות',
      false,
      false,
      false,
      false,
      3000
    );
    perform public.redeem_voucher(
      store_a_id,
      'store',
      'demo-seed',
      null,
      'demo-seed',
      (issued->>'id')::uuid,
      null,
      null
    );

    issued := public.issue_gift_voucher(
      event_id,
      gift_headphones,
      store_a_id,
      'DEMO-SHOW-CARD-0002',
      'demo-qr-secret-bat-mitzvah-show-0002',
      'demo-view-bat-mitzvah-show-0002-aaaa',
      'c1000000-0000-4000-8000-000000000002',
      365,
      true,
      true,
      'בחנות',
      false,
      false,
      false,
      false,
      900
    );
    open_voucher := (issued->>'id')::uuid;

    if store_a_slug like 'demo-%' then
      update public.stores
      set active = coalesce(store_a_active, false)
      where id = store_a_id;
    end if;
  end if;

  raise notice 'Demo event ready: %', event_slug;
  raise notice 'Primary store: % (%)', store_a_name, store_a_slug;
  raise notice 'Second store: % (%)', store_b_name, store_b_slug;
  if open_voucher is not null then
    raise notice 'Open demo voucher id: %', open_voucher;
  end if;
  if store_a_slug like 'demo-%' or store_b_slug like 'demo-%' then
    raise notice 'Demo stores stay inactive. Activate one in admin before /store login.';
  else
    raise notice 'Existing store redemption codes were not changed.';
  end if;
end;
$$;
