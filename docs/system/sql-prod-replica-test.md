# Production-schema replica test

Date: 2026-11-24. Local Docker only. Draft PR #41. Do not merge.

No connection was opened to the hosted project `fafvveudrlovaozazkny`. No production credential was read or written. No production row was copied. The baseline is reconstructed from the SQL files this repo already treats as applied.

## What was assumed to already be in Production

`docs/system/gap-map.md` and `scripts/local-db-order.mjs` treat README steps 1–12 as the schema already installed, and treat `supabase/events-anon-read.sql` as the file that closed anonymous reads of events and gifts. Those 13 files are the baseline:

1. `supabase/schema.sql`
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
13. `supabase/events-anon-read.sql`

`schema.sql` is first-install. It was applied once, on the empty local database. It was not part of the second apply. Re-running it after `events-anon-read.sql` can reopen anonymous reads, so the idempotency pass does not include it.

This baseline was not confirmed by a schema dump. If Production is missing `events-anon-read.sql`, or if it has a table or column that steps 1–12 do not create, this replica does not show that. A read-only check that would close the gap, without any write credential:

- Policies on `public.events` and `public.event_gifts`: anonymous `SELECT` should be absent after `events-anon-read.sql`.
- `to_regclass` for `payment_attempts`, `payment_refunds`, `host_identities`, `notification_messages`, `documents`, `settlements`, `audit_events`, and `pilot_feedback` should be null if those files are still unapplied.
- `stores.pilot_isolated` should be absent. The isolate file's write block is still a comment.

Do not fetch that with a service-role or database-password connection from this branch.

## What was applied on top

`node scripts/sql-prod-replica.mjs` drops and recreates `public` inside the already-running loopback container. It does not call `supabase db reset`. It then:

1. Applies the 13 baseline files.
2. Inserts `scripts/sql-prod-replica-fixture.sql` (invented rows only, labeled `נתונים לדוגמה`).
3. Applies every other file in `profiles.full`, in that order, except the 13 baseline files.
4. Applies that same new-file list a second time.

The new files, in apply order, are:

- `supabase/payments-attempts.sql`
- `supabase/voucher-term-defaults.sql`
- `supabase/pilot-demo-voucher-guard.sql`
- `supabase/host-identity.sql`
- `supabase/support-notes.sql`
- `supabase/notifications-and-documents.sql`
- `supabase/pilot-feedback.sql`
- `supabase/settlements.sql`
- `supabase/settlement-exclude-demo.sql`
- `supabase/audit-events.sql`
- `scripts/audit-demo-vouchers.sql` (SELECT only)
- `supabase/readonly/test-data-inventory.sql` (SELECT only)
- `supabase/pilot-isolate-test-data.sql` (SELECT only; the write block stays commented and ends in `ROLLBACK`)
- `supabase/demo-seed.sql`

On the normal install order, `events-anon-read.sql` is step 20, after `host-identity.sql`. On this replica it is applied with the baseline, before the new files. `host-identity.sql` adds columns and does not restore anonymous `SELECT`. The anonymous catalog stays closed. The second pass does not re-apply the baseline.

The fixture store slug is `demo-schema-replica` so `demo-seed.sql` does not adopt it. The seed only attaches to a store whose slug does not start with `demo-`. With that slug, the seed still creates `demo-ofanaim` and the demo shop code. The fixture event slug is `schema-replica-sample`. Phones, names, and amounts in the fixture are invented.

## Result

Both applies finished with `ON_ERROR_STOP=1`. The second apply did not error. Policies and triggers in those files already use `DROP ... IF EXISTS`, and the template insert uses `ON CONFLICT DO NOTHING`.

The script then required every value in this report to be true:

```json
{"payment_attempts":true,"payment_refunds":true,"host_identities":true,"notification_messages":true,"documents":true,"settlements":true,"audit_events":true,"pilot_feedback":true,"fixture_event":true,"demo_event":true,"isolate_column_absent":true,"guard_function":true}
```

`isolate_column_absent` is the rollback check. There is no down-migration file. `stores.pilot_isolated` was not created. The commented `BEGIN` / `ROLLBACK` block in `pilot-isolate-test-data.sql` was not executed. Rollback of the new tables on this disposable database is the drop described per file in `docs/system/sql-apply-order.md`. Those drops were not run against any hosted database.

`node scripts/run-verify.mjs` with `LOLO_LOCAL_DB=1` and `LOLO_LOCAL_PROFILE=full` was run on this replica before the UI smoke. Result: 300 passed, 0 failed. The later UI run called `demo-seed.sql` again; the seed returns immediately when `demo-bat-mitzvah-noa` already exists.

`supabase/fix-public-read.sql` and `supabase/demo-cleanup.sql` were not applied.
