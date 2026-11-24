-- SELECT only. Safe to run in the Supabase SQL editor when an operator wants
-- the current rows. This file was not executed against Production.
-- It does not change rows, schema, grants, or settlement functions.
-- Copy the result into the operator's notes. Do not commit the result:
-- guest names can appear.

-- 1. Active test stores.
-- The stores table has no test flag. The host picker hides a store when the
-- name contains בדיקה or טסט, or the Latin word test
-- (app/design/host-stores.ts). Demo seed slugs and demo notes are included
-- so an active demo store is not missed.
select
  id,
  name,
  slug,
  active,
  notes,
  created_at
from public.stores
where active = true
  and (
    name ~ 'בדיקה'
    or name ~ 'טסט'
    or name ~* '(^|[^[:alnum:]_])test([^[:alnum:]_]|$)'
    or slug ~ '^demo-'
    or coalesce(notes, '') ~ 'הדגמה|לא לשימוש|בדיקה'
  )
order by name;

-- 2. Inactive demo stores created by supabase/demo-seed.sql, plus any other
-- store whose name or notes already say it is a demo. These are not the
-- active set above unless someone turned them on.
select
  id,
  name,
  slug,
  active,
  notes,
  created_at
from public.stores
where active = false
  and (
    slug in ('demo-ofanaim', 'demo-sefer')
    or slug ~ '^demo-'
    or name ~ 'הדגמה|בדיקה|טסט'
    or name ~* '(^|[^[:alnum:]_])test([^[:alnum:]_]|$)'
    or coalesce(notes, '') ~ 'הדגמה|לא לשימוש|בדיקה'
  )
order by name;

-- 3. Named QA and beta test events, plus the optional demo-seed event.
-- Titles are matched exactly, including the dash characters used when the
-- events were named. Slugs catch a renamed title.
select
  id,
  slug,
  title,
  host_name,
  event_type,
  event_date,
  created_at
from public.events
where slug in (
    'lolo-z75i3d2in8',
    'lolo-2-6555knha5y',
    'demo-bat-mitzvah-noa',
    'demo-event'
  )
  or title in (
    'QA PR9 — אירוע בדיקה (לא לשימוש)',
    'אירוע בדיקה LOLO – בטא',
    'אירוע בדיקה LOLO - בטא',
    'LOLO | בדיקת משתמשים — בטא 2'
  )
order by created_at;

-- 4. Extra event candidates for a person to accept or reject.
-- "בטא" alone is not enough: a real pilot event might use that word.
-- This query is review-only. The isolation proposal does not update these
-- rows unless they also match query 3.
select
  id,
  slug,
  title,
  host_name,
  created_at
from public.events
where title ~ 'בדיקה|QA|טסט'
   or title ~* '(^|[^[:alnum:]_])test([^[:alnum:]_]|$)'
   or slug ~ '^demo-'
order by created_at;

-- 5. Orders on the named test events. Phone and email are omitted.
select
  o.id,
  o.event_slug,
  e.title as event_title,
  o.guest_name,
  o.payment_status,
  o.payment_provider,
  o.total_amount,
  o.fee_amount,
  o.charged_amount,
  o.created_at
from public.orders o
join public.events e on e.id = o.event_id
where e.slug in (
    'lolo-z75i3d2in8',
    'lolo-2-6555knha5y',
    'demo-bat-mitzvah-noa',
    'demo-event'
  )
  or e.title in (
    'QA PR9 — אירוע בדיקה (לא לשימוש)',
    'אירוע בדיקה LOLO – בטא',
    'אירוע בדיקה LOLO - בטא',
    'LOLO | בדיקת משתמשים — בטא 2'
  )
order by o.created_at;

-- 6. Vouchers on those same events. The code is included so a later cleanup
-- can point at a row. Do not paste codes into git or chat.
select
  v.id,
  e.slug as event_slug,
  e.title as event_title,
  v.status,
  v.amount,
  v.store_name,
  v.code,
  v.created_at
from public.vouchers v
join public.events e on e.id = v.event_id
where e.slug in (
    'lolo-z75i3d2in8',
    'lolo-2-6555knha5y',
    'demo-bat-mitzvah-noa',
    'demo-event'
  )
  or e.title in (
    'QA PR9 — אירוע בדיקה (לא לשימוש)',
    'אירוע בדיקה LOLO – בטא',
    'אירוע בדיקה LOLO - בטא',
    'LOLO | בדיקת משתמשים — בטא 2'
  )
order by v.created_at;
