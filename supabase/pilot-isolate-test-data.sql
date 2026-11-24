-- REQUIRES APPROVAL. Not applied. Do not run the commented block.
-- The statements above the block comment are SELECT only, same criteria as
-- supabase/readonly/test-data-inventory.sql.
-- Uncommenting the block can hide stores (active = false) and stamp
-- pilot_isolated. It does not DELETE rows. It ends in ROLLBACK on purpose.
-- Events stay publicly reachable until a later code change reads
-- pilot_isolated. See docs/pilot/test-data-inventory.md.

select id, name, slug, active
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

select id, slug, title
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

/*
REQUIRES APPROVAL. Remove this comment only after Yehuda approves a data change.
Then run the whole transaction and read the notices. Leave ROLLBACK in place
unless the same approval explicitly allows COMMIT.

begin;

alter table public.stores
  add column if not exists pilot_isolated boolean not null default false;

alter table public.events
  add column if not exists pilot_isolated boolean not null default false;

update public.stores
set active = false,
    pilot_isolated = true
where active = true
  and (
    name ~ 'בדיקה'
    or name ~ 'טסט'
    or name ~* '(^|[^[:alnum:]_])test([^[:alnum:]_]|$)'
    or slug ~ '^demo-'
    or coalesce(notes, '') ~ 'הדגמה|לא לשימוש|בדיקה'
  );

update public.events
set pilot_isolated = true
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
  );

-- Orders and vouchers are intentionally left as they are.

rollback;

*/
