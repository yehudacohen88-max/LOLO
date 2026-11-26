# PR #29 merge runbook

PR: https://github.com/yehudacohen88-max/LOLO/pull/29

Branch: `cursor/pilot-demo-voucher-guard-2d6a`

This prepares the merge. It does not merge the pull request, and it does not change Production. The SQL below was applied only to a local PostgreSQL 16 database. Do not run it until the Founder approves it, and do not run it from CI or from an agent.

Production today is `main` at `c3b720fd` (PR #42). This branch contains that commit. `getSupabaseServiceClient` in `lib/supabase/server.ts` still refuses a write-capable Supabase client on Vercel Preview unless `LOLO_ALLOW_PREVIEW_DB_URL` names a non-Production database. `lib/supabase/preview-guard.ts` is the same file as on `main`.

## What #29 changes

Demo and simulated payments no longer fund a voucher that can be spent.

- One classifier, `isSimulatedPayment` in `lib/vouchers/demo-funding.ts`. A paid order is real money only when its provider is on the real-provider allow-list and its reference does not start with `demo-`. Empty, `demo`, `none`, a `demo-` reference, and any other name are simulated. The in-app list `REAL_PROVIDER_ALLOWLIST` ships empty. `demo` and `none` stay simulated even if a test list contains them.
- Issuing and redeeming go through that check in the host issue API and in the store and admin redeem APIs. Until `public.voucher_demo_guard_version()` exists, the app does not call `issue_gift_voucher` for simulated funding and does not call `redeem_voucher` for a voucher it cannot prove is real money. A missing function, or a provider that cannot be read, is a refusal.
- `supabase/pilot-demo-voucher-guard.sql` puts the same rule in `voucher_paid_amount`, `issue_gift_voucher`, and `redeem_voucher`. A simulated voucher is stored with `demo_only` and cannot be redeemed. `anon` and `authenticated` cannot execute the functions.
- Host copy for simulated money is `שובר הדגמה – ללא ערך כספי` and `הדגמה — לא כסף שהתקבל`. A simulated total is not labeled as money received.
- `/v/[token]` stays behind the beta gate. The page is still read-only: no guest phone or email, no host code, and no redeem action.
- A greeting with no gift does not show an empty gift frame or a `ממשיכים · 0 ₪` button. Orders, quotes, payment start, and payment confirm reject a 0 ₪ contribution.
- The checkbox `אני רוצה לקבל אישור על המתנה` is gone. Confirmation is stored only when the client sends `wantsConfirmation: true`.
- In-memory guest limits are 300 reads per minute per IP, and 40 per 15 minutes per IP for orders, quotes, and payment start/confirm. The 429 response and the Vercel firewall ids `lolo-guest-read`, `lolo-guest-write`, and `lolo-image-upload` are unchanged. Counters are per server instance.

## Risk

Applying the SQL changes Production immediately, before the new app is deployed. The file replaces `issue_gift_voucher` and `redeem_voucher`. `payment_provider_allowlist` is created empty, and `payment_provider_is_real` is true only for a name in that table. With an empty table, `voucher_paid_amount` is 0 for every current order, and redeem of every positive voucher raises `voucher_demo_blocked`. That includes vouchers that were issued before this file. Existing rows are not rewritten: `vouchers.demo_only` is added `not null default false`, so current vouchers read false, and they still cannot be redeemed while the allow-list is empty.

The app has the same empty allow-list. After this code is deployed, issue and redeem of positive vouchers fail closed in the app as well, until a reviewed provider name is added in both places. Adding a name is a separate decision. This file does not insert one, and this runbook does not include an `INSERT`.

Stop if Production is redeeming vouchers that must keep working. Merging the pull request does not fix that. An empty allow-list is fail-closed on purpose.

`ADD COLUMN ... boolean not null default false` does not rewrite existing rows on PostgreSQL 11 or newer. It was applied on local PostgreSQL 16.15. This run did not query Production for its version.

The file does not open a transaction. A SQL-editor paste can commit each statement on its own. If it stops in the middle, the statements above the error are already applied. Recovery is to re-run this same file. Do not start the deploy until the post-check passes.

Other files in `docs/system/production-sql-list.md` (on PR #32) are not part of this merge. They belong to later pull requests. Do not apply them for #29.

## SQL that must be applied before the code reaches Production

One file, and only this file:

1. `supabase/pilot-demo-voucher-guard.sql`

Production already has the schema through `supabase/vouchers.sql`, including the trigger `vouchers_guard_issue`. This file does not create that trigger. It replaces the function the trigger already calls. It does not replace `cancel_voucher`. The file only revokes execute on `cancel_voucher` from `public`, `anon`, and `authenticated`, and grants execute to `service_role`, which `supabase/vouchers.sql` already did.

Do not apply, as part of this merge:

- `supabase/schema.sql`, `supabase/events-anon-read.sql`, `supabase/fix-public-read.sql`, `supabase/demo-seed.sql`, `supabase/demo-cleanup.sql`
- `supabase/settlements.sql` (not applied in Production)
- `supabase/payments-attempts.sql` (later, before #36)
- `supabase/voucher-term-defaults.sql` (later, before #38)
- `supabase/host-identity.sql` (later, before #40)
- `supabase/support-notes.sql` (later, before #39)
- `supabase/notifications-and-documents.sql` (later, before #33). That file is the one that moves `platform_settings.updated_at`. This file does not update `platform_settings`.
- `supabase/audit-events.sql` (later, before #32)

`scripts/audit-demo-vouchers.sql` is optional and is `SELECT` only. It does not list a paid order whose provider is an unknown name other than blank, `demo`, or a `demo-` reference. Use the provider group-by below for the full mix. It was not run here.

### Local idempotency

On a disposable local PostgreSQL 16.15 database, the schema was built in the README order from `supabase/schema.sql` through `supabase/vouchers.sql`, then `supabase/events-anon-read.sql`. `supabase/settlements.sql` was not applied. `anon`, `authenticated`, and `service_role` were created as local roles because vanilla PostgreSQL does not have them. A local `storage.buckets` / `storage.objects` stub existed only so `supabase/custom-gifts.sql` could run. That stub is not a Production step.

`supabase/pilot-demo-voucher-guard.sql` was then applied twice with `ON_ERROR_STOP`. Both runs finished. A catalog snapshot after the second run matched the snapshot after the first: column definitions, function bodies, the single `vouchers_guard_issue` trigger, policies, and grants. The second run notices that `demo_only` and `payment_provider_allowlist` already exist. Those notices are the idempotent path, not a failure.

Post-check on that local database after each run: `voucher_demo_guard_version()` returned 1, the allow-list was empty, `payment_provider_is_real` was false for `demo`, `none`, and `cardcom`, no voucher had `demo_only` null, and exactly one `vouchers_guard_issue` trigger existed. `anon` cannot execute `voucher_demo_guard_version()`. `authenticated` cannot execute `redeem_voucher`. `service_role` can. RLS is enabled on `payment_provider_allowlist` and there is no policy. RLS is not forced.

### Effect on the existing Production voucher (checked read-only, 2026-11-26)

Production has one voucher: 150 ₪, status `REDEEMED`, remaining 0, one redemption of 150 (2026-10-13). It is on the gift funded by four paid orders of 150 ₪ each, all with provider `demo` and a `demo-` reference. The guard SQL rewrites no existing row (`demo_only` is added with default false). Redeem of that voucher fails before and after the SQL (`voucher_closed` before, `voucher_demo_blocked` after). No allow-list entry changes that: `demo` cannot be added to the allow-list and the references start with `demo-`. After the SQL, `voucher_paid_amount` for that gift is 0 instead of 600, and an issue for that gift would create a `demo_only` voucher (not redeemable), not a real one.

## Pre-checks

Read-only. Run these on Production through the read-only connector before the paste. Save the results. Do not insert a row to test a function.

```sql
select to_regprocedure('public.voucher_demo_guard_version()') is null as guard_absent;

select count(*) = 0 as demo_only_absent
from information_schema.columns
where table_schema = 'public'
  and table_name = 'vouchers'
  and column_name = 'demo_only';

select to_regclass('public.payment_provider_allowlist') is null as allowlist_absent;

select count(*) = 1 as guard_trigger_present
from pg_trigger
where tgname = 'vouchers_guard_issue'
  and not tgisinternal;

select to_regprocedure('public.issue_gift_voucher(uuid,uuid,uuid,text,text,text,uuid,integer,boolean,boolean,text,boolean,boolean,boolean,boolean,numeric)') is not null as issue_present;

select to_regprocedure('public.redeem_voucher(uuid,text,text,numeric,text,uuid,text,text)') is not null as redeem_present;

select payment_provider, payment_status, count(*)
from public.orders
group by 1, 2
order by 1, 2;

select status, count(*)
from public.vouchers
group by 1
order by 1;

select count(*) as voucher_count from public.vouchers;
select count(*) as redemption_count from public.redemptions;
select count(*) as order_count from public.orders;
```

Stop if `guard_absent`, `demo_only_absent`, or `allowlist_absent` is false (the file was already applied, or a partial apply happened). Stop if `guard_trigger_present`, `issue_present`, or `redeem_present` is false. Stop if the provider mix contains paid orders whose provider must keep redeeming before a separate allow-list approval exists. An empty allow-list blocks redeem of every positive voucher.

## Apply

Needs Founder approval. One file, once, in the Production SQL editor:

1. `supabase/pilot-demo-voucher-guard.sql`

Paste the whole file. Do not wrap it in an extra transaction. Do not append an `INSERT` into `payment_provider_allowlist`. If the editor stops on an error, re-run this same file. Do not drop `public.vouchers`. Do not drop the trigger `vouchers_guard_issue`. Do not start the next step until the post-check passes.

If Production auto-deploys `main`, do this apply and the post-check before merging PR #29. The merge is what ships the code.

## Post-checks

Read-only, after the paste.

```sql
select public.voucher_demo_guard_version() = 1 as guard_version_ok;

select count(*) = 0 as allowlist_empty
from public.payment_provider_allowlist;

select public.payment_provider_is_real('demo') is false as demo_not_real;
select public.payment_provider_is_real('none') is false as none_not_real;
select public.payment_provider_is_real('cardcom') is false as unknown_not_real;

select count(*) = 0 as no_null_demo_only
from public.vouchers
where demo_only is null;

select count(*) = count(*) filter (where demo_only is false) as existing_vouchers_not_flagged
from public.vouchers;

select count(*) = 1 as guard_trigger_present
from pg_trigger
where tgname = 'vouchers_guard_issue'
  and not tgisinternal;

select count(*) = 0 as no_allowlist_policies
from pg_policies
where schemaname = 'public'
  and tablename = 'payment_provider_allowlist';

select has_function_privilege('anon', 'public.voucher_demo_guard_version()', 'execute') is false as anon_cannot_version;
select has_function_privilege('authenticated', 'public.redeem_voucher(uuid,text,text,numeric,text,uuid,text,text)', 'execute') is false as authenticated_cannot_redeem;

select count(*) as voucher_count from public.vouchers;
select count(*) as redemption_count from public.redemptions;
select count(*) as order_count from public.orders;
```

`voucher_count`, `redemption_count`, and `order_count` match the pre-check. `existing_vouchers_not_flagged` is true. `guard_version_ok`, the three `is_real` checks, `allowlist_empty`, `no_null_demo_only`, `guard_trigger_present`, and `no_allowlist_policies` are true.

`payment_provider_is_real` and `voucher_demo_guard_version` are `security definer` and granted to `service_role` only. If the read-only role cannot call them, the column, table, version-function presence, trigger, policy, and row-count checks are enough. Do not grant execute in order to run the check.

```sql
select to_regprocedure('public.voucher_demo_guard_version()') is not null as guard_present;
```

## Merge

After the post-check passes:

1. Confirm the Vercel check on PR #29 is green for this branch.
2. Merge PR #29 on GitHub into `main`. Do not force-push `main`. Do not merge any other pull request in the same step.
3. Wait until the Production deployment for that merge is Ready.
4. Run the smoke checks below. They are GET requests only.

## Post-deploy smoke checks

GET only, against the Production site `https://lolo-sooty.vercel.app`. Do not submit a form. Do not call `POST`. One request each. A missing-event read is enough to see that the app is up. Do not loop it (the miss lock is 12 failures).

The beta gate stays on. Unauthenticated responses:

| Request | Expect |
| --- | --- |
| `GET /beta` | 200, the beta sign-in page, not a 500 |
| `GET /` with redirects disabled | 307 to `/beta?next=/` |
| `GET /v/example-token` with redirects disabled | 307 to `/beta`, not a voucher |
| `GET /e/missing-demo-event` | the friendly heading `האירוע לא נמצא`, not a 500 |
| `GET /no-such-lolo-page` | 404 and `העמוד לא נמצא` |
| `GET /api/events/missing-demo-event` | 404 and `האירוע לא נמצא.` |

`GET /host`, `GET /store`, and `GET /admin` also redirect to `/beta` without a beta session. Do not type a password.

If `/` returns 200 with the public landing page, the beta gate is off. That is not the expected pilot state. Stop and check `BETA_ACCESS_ENABLED` before any further testing.

Do not call `POST /api/orders`, `POST /api/checkout/quote`, `POST /api/payments/start`, `POST /api/payments/confirm`, `POST /api/store/redeem`, `POST /api/admin/vouchers/.../redeem`, or the host issue route.

## Rollback

App and database roll back separately. Rolling the deployment back does not restore the old functions. Restoring the old functions does not restore the old app.

### App

In Vercel, roll Production back to the deployment built from `c3b720fd` (PR #42). Do not force-push `main`. While the new SQL is still installed, the old app still calls `issue_gift_voucher` and `redeem_voucher`, and those functions stay fail-closed until the allow-list has a reviewed name or the SQL rollback below is done.

### Database

Do this only to remove the guard file, and only with Founder approval. The rollback is one SQL file, `supabase/pilot-demo-voucher-guard-rollback.sql`. It is database-only and does not depend on a Vercel rollback. Read first:

```sql
select count(*) as demo_flagged
from public.vouchers
where demo_only is true;

select provider
from public.payment_provider_allowlist
order by 1;
```

The file refuses to run (and changes nothing) if `demo_flagged` is not 0 or the allow-list is not empty. Those vouchers were issued under the guard, and the old `redeem_voucher` does not read `demo_only`, so it would make them redeemable as money. Dropping the allow-list table deletes the reviewed provider names, so copy them out first. If it refuses, stop and ask the Founder.

Paste the whole file in the Production SQL editor, once. It runs as one transaction:

1. Restores the five function bodies that the guard file replaced, exactly as Production had them before the guard (taken from the live Production definitions on 2026-11-26, identical to the backup of 2026-11-25): `voucher_paid_amount(uuid, uuid)`, `voucher_committed_amount(uuid, uuid)`, `vouchers_guard_issue()`, `issue_gift_voucher(...)`, `redeem_voucher(...)`.
2. Resets execute on those functions to `service_role` only.
3. Drops `payment_provider_is_real(text)`, `voucher_simulated_amount(uuid, uuid)`, `voucher_demo_committed_amount(uuid, uuid)`, `voucher_demo_guard_version()`, the column `vouchers.demo_only`, and the table `payment_provider_allowlist`.
4. Asserts the end state. A failed assertion rolls the whole transaction back.

It does not touch `cancel_voucher`, the trigger `vouchers_guard_issue` (it keeps calling the restored function), `public.vouchers` rows, `public.redemptions`, or any order. Running it twice is safe.

Confirm afterwards: `to_regprocedure('public.voucher_demo_guard_version()')` is null, `demo_only` is absent, and `vouchers_guard_issue` is present once. With the guard function gone, the new app (if still deployed) refuses to issue or redeem from simulated funding. That is fail closed.

### Rollback test (local)

Run on a disposable local PostgreSQL 16 restored from the external backup of 2026-11-25 (`-c timezone=UTC`). The sequence was: apply guard, apply again, run rollback (with a test allow-list row to confirm it refuses, then without), run rollback again, re-apply guard, roll back again.

- After each rollback, the function definitions (md5 of `pg_get_functiondef`), execute grants, the trigger definition, every table column, and the table list were identical to the pre-guard baseline. The row md5 of all 11 public tables matched the backup again.
- Applying the guard twice produced an identical catalog. Re-applying after a rollback produced the same catalog as the first apply.
- The rollback refused while the allow-list had a row, and left the guard in place.
- With the guard applied, `redeem_voucher` on the only existing voucher raised `voucher_demo_blocked`. Before the guard it raised `voucher_closed`.
