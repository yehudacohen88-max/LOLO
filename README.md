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
- `BETA_ACCESS_ENABLED` (ברירת מחדל: ההגבלה פעילה. רק `false` מבטל אותה)
- `BETA_ACCESS_PASSWORD`
- `BETA_ACCESS_SECRET`
- `NEXT_PUBLIC_APP_URL` (אופציונלי)
- `PAYMENT_PROVIDER` (אופציונלי. ריק = תשלום הדגמה)
- `PAYMENT_WEBHOOK_SECRET` (אופציונלי. בלי ערך, עדכון תשלום מדומה נדחה)

## בסיס הנתונים

מריצים ידנית בעורך ה-SQL, לפי הסדר. לא מריצים מחדש קובץ שכבר הוחל. אף קובץ כאן לא רץ אוטומטית בפריסה.

לא מריצים את `supabase/fix-public-read.sql`. הוא פותח מחדש קריאה אנונימית לאירועים ולמתנות.

`supabase/schema.sql` מיועד להתקנה ראשונה בלבד. הרצה חוזרת שלו אחרי `supabase/events-anon-read.sql` מחזירה את אותה קריאה אנונימית, ולכן לא מריצים אותו שוב.

1. `supabase/schema.sql` — התקנה ראשונה בלבד
2. `supabase/events-server-write.sql`
3. `supabase/orders.sql`
4. `supabase/host-access-code.sql`
5. `supabase/event-guests.sql`
6. `supabase/invite-tokens.sql`
7. `supabase/stores.sql`
8. `supabase/stores-admin-fields.sql`
9. `supabase/event-gifts-store.sql`
10. `supabase/custom-gifts.sql`
11. `supabase/demo-checkout.sql`
12. `supabase/vouchers.sql`
13. `supabase/settlements.sql`

אחרי אישור, ולא לפני כן, מריצים גם את `supabase/payments-attempts.sql` (אחרי `demo-checkout.sql`). הקובץ מוסיף `payment_attempts` ו־`payment_refunds` ומשאיר את מדיניות ההחזרים ריקה. עד אז התשלום נכשל עם "רישום התשלומים עדיין לא הופעל." לא מריצים אותו על Production מתוך הקוד.

Production כבר בלי מדיניות על events ועל event_gifts. זה מצב הסיום של `supabase/events-anon-read.sql`, ולכן הקובץ לא נמצא ברשימת ה-SQL ל-Production. הוא נשאר בסדר המקומי וב-CI, כי הרצה חוזרת של `supabase/schema.sql` פותחת את הקריאה מחדש. לא מריצים את `supabase/fix-public-read.sql`.

אירוע הדגמה, אופציונלי ולא הורס נתונים קיימים:

14. `supabase/demo-seed.sql`

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
