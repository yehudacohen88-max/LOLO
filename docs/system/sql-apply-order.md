# SQL apply order

Ordered list of every SQL file in this repo. The machine-readable copy is `scripts/local-db-order.mjs`. Local Docker and the pull-request CI workflow apply this order with `psql` inside the database container. Nothing here is applied to the hosted project `fafvveudrlovaozazkny`.

There is no down-migration file in the repo. Rollback is the steps under each file. Re-running a file is safe where the header says so; it does not undo data.

`scripts/local-db.mjs` skips a listed file that is not in the current checkout and applies it once that file is on the branch. Pull request #32 does not contain every file yet. After the other feature branches merge, the same list applies all 27 files.

Profiles:

- `ci` is steps 1–20 and 23–26. It is the default `npm run db:local` profile and the CI job "local database without settlements".
- `full` is all 27 steps. It is `npm run db:reset` and the CI job "local database with settlements and demo seed".
- `seed` is step 27 only, after `full` has already been applied.

On 2026-11-24 the `full` profile applied cleanly to a loopback Supabase database (`supabase start`, Postgres 17 in Docker, API `http://127.0.0.1:54321`). That run is the "local apply" noted below. CI on the draft integration PR is the second apply.

## Applied order

### 1. `supabase/schema.sql`

- Depends on: empty database.
- Changes: `events`, `event_gifts`, and the first public-read policies.
- Risk: high on a database that already has those tables, because a first-install script can reset policies. Local CI starts from an empty database.
- Tested: local full apply, and both CI profiles.
- Rollback: drop `public.events` and `public.event_gifts` on a disposable database only. Do not drop them on Production.

### 2. `supabase/events-server-write.sql`

- Depends on: step 1.
- Changes: removes anonymous and browser writes on events and gifts. Writes go through the Next.js server.
- Risk: medium. A partial run that is not followed by step 20 can leave the old read policies.
- Tested: local full apply, and both CI profiles.
- Rollback: re-apply the previous policies only from a reviewed copy. Do not run `supabase/fix-public-read.sql`.

### 3. `supabase/orders.sql`

- Depends on: steps 1–2.
- Changes: `orders` and `order_items`.
- Risk: medium. New tables, RLS, no anonymous policies.
- Tested: local full apply, and both CI profiles.
- Rollback: drop `public.order_items` and `public.orders` on a disposable database.

### 4. `supabase/host-access-code.sql`

- Depends on: step 1.
- Changes: `event_host_access` (code hash). No anonymous access.
- Risk: low. New private table.
- Tested: local full apply, and both CI profiles.
- Rollback: drop `public.event_host_access` on a disposable database.

### 5. `supabase/event-guests.sql`

- Depends on: step 1.
- Changes: `event_guests`. No anonymous access.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: drop `public.event_guests` on a disposable database. That deletes the guest list.

### 6. `supabase/invite-tokens.sql`

- Depends on: step 5.
- Changes: `invite_token_hash` and `invite_token_enc` on `event_guests`.
- Risk: low. Additive columns.
- Tested: local full apply, and both CI profiles.
- Rollback: drop those two columns. Existing links that stored only the hash still need the hash column.

### 7. `supabase/stores.sql`

- Depends on: none beyond a database that can hold new tables.
- Changes: `stores`. Anonymous read of active rows only.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: drop `public.stores` on a disposable database.

### 8. `supabase/stores-admin-fields.sql`

- Depends on: step 7.
- Changes: logo, contact, commission, payment terms, settlement method, voucher term, and notes columns on `stores`. All added without backfill.
- Risk: low. Nullable business fields.
- Tested: local full apply, and both CI profiles.
- Rollback: drop the added columns. That drops any values a person typed.

### 9. `supabase/event-gifts-store.sql`

- Depends on: steps 1 and 7.
- Changes: optional `store_id` and `store_name` on `event_gifts`.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: drop those two columns.

### 10. `supabase/custom-gifts.sql`

- Depends on: step 1.
- Changes: gift description, image URL, source, and a public `gift-images` storage bucket.
- Risk: medium because of the public bucket.
- Tested: local full apply, and both CI profiles.
- Rollback: drop the columns and remove the bucket on a disposable project. Do not delete the Production bucket from this branch.

### 11. `supabase/demo-checkout.sql`

- Depends on: step 3.
- Changes: payment columns on `orders`, and `platform_settings` (`guest_fee_enabled` default false, percent and fixed amount default 0).
- Risk: medium. Creates the settings row the later files alter.
- Tested: local full apply, and both CI profiles.
- Rollback: drop the payment columns and `platform_settings` only on a disposable database.

### 12. `supabase/vouchers.sql`

- Depends on: steps 3, 7, and 11.
- Changes: `vouchers`, `redemptions`, `store_redemption_access`, and the first issue/redeem/cancel functions. This version still treats every paid order as fundable.
- Risk: high. Money functions. The next guard file replaces them before any seed runs.
- Tested: local full apply, and both CI profiles. Redeem behavior is then replaced by step 15.
- Rollback: drop the three tables and the functions on a disposable database.

### 13. `supabase/payments-attempts.sql`

- Depends on: steps 3 and 11.
- Changes: `payment_attempts`, `payment_refunds`, and nullable refund-policy columns on `platform_settings` (`refund_window_days`, `refund_approver`, `refund_allow_partial`, `refund_blocks_issued_voucher`). Checks force `provider = 'demo'` and `simulated = true`.
- Risk: medium. The header says not to run it on Production until approval. Local CI applies it on purpose. Columns stay null.
- Tested: local full apply, and both CI profiles. Integration test writes attempts only on the loopback database.
- Rollback: drop `payment_refunds` and `payment_attempts`, then drop the four settings columns.

### 14. `supabase/voucher-term-defaults.sql`

- Depends on: step 11.
- Changes: nullable `voucher_default_validity_days`, `voucher_default_allow_partial`, `voucher_default_allow_topup`, `voucher_default_redemption_method`. Does not set 365 days and does not replace issue/redeem.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: drop the four columns.

### 15. `supabase/pilot-demo-voucher-guard.sql`

- Depends on: step 12, and orders from step 11.
- Changes: `vouchers.demo_only` (default false, no backfill), empty `payment_provider_allowlist`, `payment_provider_is_real` (true only for a row in that table), and replacement issue/redeem/cancel functions. A provider name that is merely not `demo` is simulated. `demo` and `none` cannot be inserted into the allow-list.
- Risk: high. Changes who can redeem. The allow-list ships empty, so no existing paid row becomes real money.
- Tested: local full apply, and both CI profiles. Integration test issues, redeems, expires, and blocks demo vouchers on the loopback database, then deletes the temporary `fixture` allow-list row.
- Rollback: restore the functions from `supabase/vouchers.sql` only if the guard must be removed, drop `payment_provider_allowlist`, and drop `vouchers.demo_only` after confirming no row relies on it. Do not do that on Production as part of this branch.

### 16. `supabase/host-identity.sql`

- Depends on: steps 1, 4, and 5.
- Changes: `host_identities`, recovery tables, `session_version` on host access, invitation greeting on events.
- Risk: medium. New auth tables. No backfill.
- Tested: local full apply, and both CI profiles.
- Rollback: drop the new tables and the added columns on a disposable database. That signs every host out of the versioned session.

### 17. `supabase/support-notes.sql`

- Depends on: steps 1 and 3.
- Changes: append-only `support_notes`.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: drop `public.support_notes`.

### 18. `supabase/notifications-and-documents.sql`

- Depends on: steps 3 and 11.
- Changes: `notification_templates`, `notification_messages`, `documents`, and nullable settings columns `vat_rate_percent`, `vat_included`, `default_document_kind`, `document_currency`, `notification_channels`. Does not set a VAT rate.
- Risk: medium. New tables. Documents are still simulated by the app.
- Tested: local full apply, and both CI profiles. Integration test writes a simulated document and a simulated notification on the loopback database.
- Rollback: drop the three tables and the five settings columns.

### 19. `supabase/pilot-feedback.sql`

- Depends on: none beyond a database that can hold a new table.
- Changes: `pilot_feedback`. The file text still contains the approval warning. Applying it locally does not approve Production.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: drop `public.pilot_feedback`.

### 20. `supabase/events-anon-read.sql`

- Depends on: steps 1 and 2, and it must stay after step 16 in the same run as step 1. Re-running `schema.sql` alone reopens anonymous reads.
- Changes: closes anonymous SELECT on events and gifts.
- Risk: medium. Wrong order reopens the catalog.
- Tested: local full apply, and both CI profiles. Integration test checks the anonymous REST catalog is closed.
- Rollback: do not run `supabase/fix-public-read.sql`. Re-apply this file to close reads again.

### 21. `supabase/settlements.sql` (full profile only)

- Depends on: step 12.
- Changes: `settlements`, `settlement_lines`, and the first settlement functions.
- Risk: high. Money movement between the platform and a store. Omitted from the default CI profile so Production-shaped checks still see the table as absent.
- Tested: local full apply, and the CI job "local database with settlements and demo seed".
- Rollback: drop the two tables and the settlement functions on a disposable database.

### 22. `supabase/settlement-exclude-demo.sql` (full profile only)

- Depends on: steps 15 and 21. It refuses to run if `vouchers.demo_only` or `settlements` is missing.
- Changes: nullable `default_commission_percent`, `default_payment_terms_days`, `money_rounding`. Replaces settlement functions so `demo_only` redemptions are skipped, and a null commission, term, or rounding refuses the batch.
- Risk: high. Wrong function body could pay a demo redemption or treat null as zero. This version does neither.
- Tested: local full apply, and the full CI profile. Integration test creates one real redemption and one planted demo redemption and checks only the real line leaves `UNSETTLED`.
- Rollback: re-apply `supabase/settlements.sql` to restore the earlier functions, then drop the three settings columns if they must go. Demo rows already settled would need a manual review; this file does not settle them.

### 23. `supabase/audit-events.sql`

- Depends on: steps 1 and 3. It stays after step 20.
- Changes: `audit_events`. Service role writes. No anonymous access.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: drop `public.audit_events`. That deletes the audit trail.

### 24. `scripts/audit-demo-vouchers.sql`

- Depends on: steps 11, 12, and 15 (it reads orders and vouchers).
- Changes: nothing. SELECT only.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: none. The file does not write.

### 25. `supabase/readonly/test-data-inventory.sql`

- Depends on: steps 7, 8, 11, and 12 (`stores.notes`, orders, vouchers).
- Changes: nothing. SELECT only.
- Risk: low.
- Tested: local full apply, and both CI profiles.
- Rollback: none.

### 26. `supabase/pilot-isolate-test-data.sql`

- Depends on: the same tables as step 25.
- Changes: nothing when applied as stored. The write block is inside a block comment and ends in `ROLLBACK`. The approval warning stays in the file.
- Risk: high if someone uncomments the write block. The applied text is SELECT only.
- Tested: local full apply, and both CI profiles. `verify:pilot` still requires the approval and rollback text to be present.
- Rollback: none for the applied text. Do not uncomment the write block.

### 27. `supabase/demo-seed.sql` (full profile only, always last)

- Depends on: steps 7, 8, 12, and 15. It must run after the guard so `issue_gift_voucher` is the guarded function. It does not need `settlements.sql` for the columns it writes; `settlement_method` comes from step 8.
- Changes: inserts the demo event `demo-bat-mitzvah-noa`, its store, gifts, and vouchers. With the guard installed, the bike voucher is issued and not redeemed. Without the guard, the file still redeems `DEMO-SHOW-CARD-0002`.
- Risk: medium. Inserts demo rows. Last so those vouchers are `demo_only` and cannot be redeemed for money.
- Tested: local full apply. The CI full profile applies it and expects the demo event row. The CI profile without settlements does not apply it.
- Rollback: run `supabase/demo-cleanup.sql` only on the local database, and only when the intent is to delete that demo event. It is not part of CI.

## Not applied

| File | Why it is skipped |
| --- | --- |
| `supabase/fix-public-read.sql` | Header says do not run. Restores anonymous reads of events and gifts. |
| `supabase/demo-cleanup.sql` | Deletes the demo event's rows. Manual local cleanup only. |
