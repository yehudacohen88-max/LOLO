-- Local only. Marks the seeded demo event so the guest page shows the label.
-- Does not insert rows and does not run against a hosted database.
update public.events
set message = rtrim(message) || ' נתונים לדוגמה'
where slug = 'demo-bat-mitzvah-noa'
  and position('נתונים לדוגמה' in message) = 0;
