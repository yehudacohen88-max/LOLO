# LOLO

LOLO היא פלטפורמה עברית, מותאמת למובייל, למתנות באירוע. מארח יוצר אירוע ובוחר מתנות עם יעד וחנות. אורחים נכנסים מקישור אישי, משתתפים בסכום שמתאים להם ומשאירים ברכה. המארח מנפיק שובר על הסכום ששולם, גם מעל 100% מהיעד. החנות מממשת את השובר, והניהול מסכם התחשבנות: ברוטו, דמי שירות, עמלה, הכנסות LOLO, לתשלום, תאריך יעד וסטטוס.

היעד של מתנה אינו תקרה.

## סטאק

Next.js 16 (App Router), React 19, TypeScript, Supabase, Tailwind CSS 4, Vercel.

## משתני סביבה

השמות בלבד. ערכים לדוגמה והסבר קצר נמצאים ב־`.env.example`. אין לשמור סודות בגיט.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HOST_SESSION_SECRET`
- `INVITE_TOKEN_SECRET`
- `ADMIN_SESSION_SECRET`
- `STORE_SESSION_SECRET`
- `LOLO_ADMIN_PASSWORD`
- `NEXT_PUBLIC_APP_URL` (אופציונלי)
- `PAYMENT_PROVIDER` (אופציונלי. ריק = תשלום הדגמה)

## בסיס הנתונים

מריצים ידנית בעורך ה-SQL, לפי הסדר. לא מריצים מחדש קבצים ישנים אחרי שהם כבר הוחלו. אף קובץ כאן לא רץ אוטומטית בפריסה.

1. `supabase/schema.sql`
2. `supabase/fix-public-read.sql`
3. `supabase/events-server-write.sql`
4. `supabase/orders.sql`
5. `supabase/host-access-code.sql`
6. `supabase/event-guests.sql`
7. `supabase/invite-tokens.sql`
8. `supabase/stores.sql`
9. `supabase/stores-admin-fields.sql`
10. `supabase/event-gifts-store.sql`
11. `supabase/custom-gifts.sql`
12. `supabase/demo-checkout.sql`
13. `supabase/vouchers.sql`
14. `supabase/settlements.sql`

אירוע הדגמה, אופציונלי ולא הורס נתונים קיימים:

15. `supabase/demo-seed.sql`

מחיקה של שורות ההדגמה בלבד: `supabase/demo-cleanup.sql`. פרטי הכניסה והמסלול: `docs/DEMO.md`.

## פקודות

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run build
npm run start
npm run verify:sessions
npm run verify:checkout
npm run verify:vouchers
npm run verify:settlements
npm run test:e2e
node scripts/hash-demo-access.mjs
```

`npm run test:e2e` בונה את האפליקציה ומריץ בדיקת עשן מול `next start`, בלי בסיס נתונים חי.

## אבני דרך

העבודה יושבת בשרשרת בקשות משיכה, בלי מיזוג ל־`main`:

1. הפרדת סשנים
2. מתנות מותאמות
3. תשלום הדגמה ומימון
4. שוברים ומימוש בחנות
5. התחשבנות מול חנויות
6. ליטוש להדגמה: עקביות במסכים, עמודי שגיאה, מסלול שובר, נתוני הדגמה ומסמך המסלול
