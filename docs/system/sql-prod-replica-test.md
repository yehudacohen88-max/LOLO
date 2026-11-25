# Production-schema replica test

Date: 2026-11-24. Local Docker only. Draft PR #41. Do not merge.

No connection was opened to the hosted project `fafvveudrlovaozazkny` from this branch. No production credential was read or written. No production row was copied. The structure below is the read-only public-schema report fetched on 24 Nov 2026, checked by rebuilding it from this repo's SQL.

## What the read showed

RLS is enabled on every public table. The tables are `events`, `event_gifts`, `orders`, `order_items`, `event_host_access`, `event_guests`, `stores`, `platform_settings`, `vouchers`, `redemptions`, and `store_redemption_access`.

`stores` has one policy, `Public can read active stores` (SELECT). `event_guests`, `event_host_access`, `order_items`, `orders`, `platform_settings`, `redemptions`, `store_redemption_access`, and `vouchers` each have one ALL policy for `anon` and `authenticated` that denies direct access. `events` and `event_gifts` have no policies.

These non-internal triggers exist: `orders_set_updated_at`, `order_items_match_event`, `stores_set_updated_at`, `platform_settings_set_updated_at`, `vouchers_set_updated_at`, `redemptions_set_updated_at`, `vouchers_guard_issue`, `redemptions_guard_update`, `vouchers_block_delete`, `redemptions_block_delete`.

`stores.pilot_isolated` is absent. None of the new tables exist (`payment_attempts`, `host_identities`, `notification_messages`, `documents`, `settlements`, `audit_events`, `support_notes`, `pilot_feedback`, and the rest).

Column names match the lists in the 24 Nov 2026 report. `events.event_date` and `events.event_time` are text. `events.money_amounts` is `integer[]`. `vouchers` has no `demo_only` column yet.

## How that differs from the previous baseline

The previous replica also started from README steps 1–12 plus `supabase/events-anon-read.sql`. That file list is unchanged. The reason for the last file is now the opposite of the first guess.

`supabase/schema.sql` creates `Public can read events` and `Public can read event gifts`. `supabase/events-server-write.sql` drops the public INSERT policies and revokes anon writes, and it leaves those two SELECT policies in place. `supabase/events-anon-read.sql` is the file that drops the two SELECT policies. Skipping it would leave policies the read did not find. The zero-policy shape is the end state of `events-anon-read.sql`, so the replica still applies that file as part of the baseline.

`scripts/sql-prod-replica.mjs` applies those 13 files, then refuses to continue unless tables, RLS, policy names and commands, non-internal trigger names, and column names match the read. That check passed on 24 Nov 2026 before any synthetic row and before any new file.

## Does the app need anon reads of events?

No. `getSupabaseBrowserClient` is not called. Guest, host, order, and funding reads use the service role, which bypasses RLS. A missing anon policy does not change those server reads.

No file in the new set creates a policy on `events` or `event_gifts`. After both applies, those two tables still have zero policies. Anon, `authenticated`, and `public` also have no table grants on them in the finished local database.

`events-anon-read.sql` does not belong in the Production apply list as a new migration. The fetched structure is already its end state. Running it again only repeats `drop policy if exists` and `revoke select`. Keep it in the local and CI order, because a database built from `schema.sql` opens the read policies and has to close them again. Do not run `supabase/fix-public-read.sql`. That file puts the public read and insert policies back.

## `vouchers_guard_issue`

The trigger is already installed by `supabase/vouchers.sql` (`before insert or update`, row level, calling `vouchers_guard_issue()`). `supabase/pilot-demo-voucher-guard.sql` does not drop or recreate that trigger. It replaces the function with `create or replace function`.

The replacement adds `demo_only` to the columns an update may not change. On insert, a row with `demo_only` returns before the paid-pool check. A monetary insert still compares `voucher_paid_amount` with `voucher_committed_amount`. The second apply of the guard file succeeded, and the trigger name was still present.

The live function body was not in the structure read. This comparison is against `supabase/vouchers.sql`, which is the file that creates the trigger. The guard file overwrites the body either way. A byte-level diff of the current function would need read-only definitions for `vouchers_guard_issue()`, `issue_gift_voucher`, `redeem_voucher`, `cancel_voucher`, `voucher_paid_amount`, and `voucher_committed_amount`. Those definitions are not required to apply the file.

## What was applied on top

`node scripts/sql-prod-replica.mjs` drops and recreates `public` inside the running loopback container. It does not call `supabase db reset`. It then:

1. Applies the 13 baseline files and checks them against the read.
2. Inserts `scripts/sql-prod-replica-fixture.sql` (invented rows only, labeled `נתונים לדוגמה`). The fixture store slug is `demo-schema-replica`, so the demo seed still creates `demo-ofanaim`.
3. Applies every other file in `profiles.full`, in that order.
4. Applies that same new-file list a second time.

`schema.sql` and `events-anon-read.sql` are not in the second pass. Re-running `schema.sql` would reopen the read policies.

Both new-file passes finished with `ON_ERROR_STOP=1`. The script then required this report:

```json
{"payment_attempts":true,"payment_refunds":true,"host_identities":true,"notification_messages":true,"documents":true,"settlements":true,"audit_events":true,"pilot_feedback":true,"fixture_event":true,"demo_event":true,"isolate_column_absent":true,"guard_function":true,"events_policies":0,"event_gift_policies":0,"guard_trigger":true}
```

`node scripts/run-verify.mjs` with `LOLO_LOCAL_DB=1` and `LOLO_LOCAL_PROFILE=full` on that database: 300 passed, 0 failed.

`npx playwright test -c playwright.local.config.ts` on the same database: 5 passed, 0 failed (home and host create, guest demo checkout through `שולם בהדגמה`, host edit and simulated recovery, admin lists, store desk refusing the demo voucher).

`supabase/fix-public-read.sql` and `supabase/demo-cleanup.sql` were not applied.
