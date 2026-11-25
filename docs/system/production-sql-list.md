# Production SQL list

Only the files below are run on Production, in this order, and only after the matching code is on `main`. This is not the local or CI order. `docs/system/sql-apply-order.md` and `docs/security/local-database.md` still apply `supabase/events-anon-read.sql` on a fresh database. Production already has that file's end state (no policies on `events` or `event_gifts`), so it is not in this list.

Do not run `supabase/schema.sql`, `supabase/events-server-write.sql`, `supabase/events-anon-read.sql`, `supabase/fix-public-read.sql`, `supabase/demo-seed.sql`, `supabase/demo-cleanup.sql`, `supabase/settlements.sql`, `supabase/settlement-exclude-demo.sql`, `supabase/pilot-feedback.sql`, `supabase/pilot-isolate-test-data.sql`, `scripts/audit-demo-vouchers.sql`, or `supabase/readonly/test-data-inventory.sql` as part of this list. Settlements stay off until a separate approval, and those two settlement files are applied together only then, with `settlement-exclude-demo.sql` immediately after `settlements.sql` and only after the guard below. The feedback page stays closed until its table exists; that file is not required for a safe deploy.

None of these seven files open a transaction. Local and CI use `psql` with `ON_ERROR_STOP`, so each statement commits on its own and a failure stops the file. Treat a SQL-editor paste the same way: do not assume the editor rolled the whole paste back. If a file stops in the middle, the statements above the error are already applied. Recovery is to re-run that same file. Do not start the next file until its post-check passes. Re-running is safe: new tables and columns use `if not exists`, functions use `create or replace`, policies and triggers use `drop if exists` before create, and constraints are added only when the name is absent.

`ADD COLUMN ... NOT NULL DEFAULT <constant>` and `ADD COLUMN` of a nullable column take a short access-exclusive lock and do not rewrite existing rows on the Postgres version Production runs. Existing rows read the default. There is no backfill of voucher rows, orders, or events.

Pre-check and post-check queries are read-only. Run them through the read-only connector. Do not insert a row to test a function.

## 1. `supabase/pilot-demo-voucher-guard.sql`

Merge stage: before the deploy that includes #29 (and therefore #36, #38, and #40, which contain the same app check).

Changes:

- Column `vouchers.demo_only boolean not null default false`.
- Table `payment_provider_allowlist` (empty). RLS enabled. No policy. `revoke all` from `public`, `anon`, `authenticated`.
- Replaces `payment_provider_is_real`, `voucher_paid_amount`, `voucher_simulated_amount`, `voucher_committed_amount`, `voucher_demo_committed_amount`, `vouchers_guard_issue`, `issue_gift_voucher`, `redeem_voucher`.
- Adds `voucher_demo_guard_version()` returning 1.
- Does not drop or recreate the trigger `vouchers_guard_issue`. The existing trigger keeps calling the replaced function.
- Does not replace `cancel_voucher`. The file only revokes execute on it from `public`, `anon`, and `authenticated`, and grants execute to `service_role`, together with the functions it does replace.

Existing rows: every current voucher reads `demo_only` as false. No row is updated. Redeem still refuses a voucher whose amount, or the monetary amount already committed on that gift, is above `voucher_paid_amount`. That amount counts a paid order only when `payment_provider_is_real` is true, and that is true only for a name present in `payment_provider_allowlist`. The table is created empty, so after this file every positive voucher fails redeem with `voucher_demo_blocked` until a reviewed provider name is inserted. That is the intended fail-closed. It is also the reason to stop if Production is redeeming vouchers today.

Idempotent: yes. A second run replaces the same functions and does not add a second column or a second trigger.

Mid-file failure: the column or the allow-list table may exist while the old function bodies are still installed, or the opposite. Recovery: re-run this file. Do not drop `vouchers`. Do not drop the trigger `vouchers_guard_issue`. Undo, only if the file must be removed and the new table is still empty: restore the previous function bodies from the already-applied `supabase/vouchers.sql`, then `alter table public.vouchers drop column if exists demo_only` and `drop table if exists public.payment_provider_allowlist`.

Pre-check:

```sql
select to_regprocedure('public.voucher_demo_guard_version()') is null as guard_absent;
select count(*) = 0 as demo_only_absent
from information_schema.columns
where table_schema = 'public' and table_name = 'vouchers' and column_name = 'demo_only';
select to_regclass('public.payment_provider_allowlist') is null as allowlist_absent;
select count(*) = 1 as guard_trigger_present
from pg_trigger
where tgname = 'vouchers_guard_issue' and not tgisinternal;
select payment_provider, payment_status, count(*)
from public.orders
group by 1, 2
order by 1, 2;
select count(*) as voucher_count from public.vouchers;
```

Stop if `guard_trigger_present` is false, or if the provider mix shows paid orders whose provider is not one you have decided to allow-list. An empty allow-list blocks redeem of every positive voucher.

Post-check:

```sql
select public.voucher_demo_guard_version() = 1 as guard_version_ok;
select count(*) = 0 as allowlist_empty from public.payment_provider_allowlist;
select public.payment_provider_is_real('demo') is false as demo_not_real;
select public.payment_provider_is_real('cardcom') is false as unknown_not_real;
select count(*) = 0 as no_null_demo_only
from public.vouchers
where demo_only is null;
select count(*) = 1 as guard_trigger_present
from pg_trigger
where tgname = 'vouchers_guard_issue' and not tgisinternal;
```

`payment_provider_is_real` is `security definer` and granted to `service_role` only. If the read-only role cannot call it, the column, table, version, and trigger checks are enough; do not grant execute in order to run the check.

## 2. `supabase/payments-attempts.sql`

Merge stage: before the deploy that includes #36.

Changes:

- Tables `payment_attempts` and `payment_refunds`.
- Nullable columns on `platform_settings`: `refund_window_days`, `refund_approver`, `refund_allow_partial`, `refund_blocks_issued_voucher`.
- Checks that force `payment_attempts.provider = 'demo'` and simulated-only rows.
- Unique indexes on provider reference, provider event, one capture, and refund reference.
- RLS enabled on both new tables. No policy. `revoke all` from `anon`, `authenticated`, `public`. `grant all` to `service_role`.
- Does not alter `orders` or existing voucher rows. Does not set a refund window.

Existing rows: the default `platform_settings` row keeps the four new columns null. Orders are untouched.

Idempotent: yes (`create table if not exists`, `add column if not exists`, constraints only when missing).

Mid-file failure: one of the two tables may exist, or the columns may exist without the checks. Recovery: re-run this file. Undo, only while both new tables are empty and the four columns are still null: drop `payment_refunds`, drop `payment_attempts`, and drop the four columns.

Pre-check:

```sql
select to_regclass('public.payment_attempts') is null as attempts_absent;
select to_regclass('public.payment_refunds') is null as refunds_absent;
select count(*) = 0 as refund_columns_absent
from information_schema.columns
where table_schema = 'public'
  and table_name = 'platform_settings'
  and column_name in (
    'refund_window_days',
    'refund_approver',
    'refund_allow_partial',
    'refund_blocks_issued_voucher'
  );
```

Post-check:

```sql
select to_regclass('public.payment_attempts') is not null as attempts_present;
select to_regclass('public.payment_refunds') is not null as refunds_present;
select refund_window_days is null
  and refund_approver is null
  and refund_allow_partial is null
  and refund_blocks_issued_voucher is null as refund_policy_unset
from public.platform_settings
where id = 'default';
select count(*) = 0 as no_attempt_policies
from pg_policies
where schemaname = 'public' and tablename in ('payment_attempts', 'payment_refunds');
```

## 3. `supabase/voucher-term-defaults.sql`

Merge stage: before the deploy that includes #38.

Changes:

- Nullable columns on `platform_settings`: `voucher_default_validity_days`, `voucher_default_allow_partial`, `voucher_default_allow_topup`, `voucher_default_redemption_method`.
- Check constraints: validity is null or between 1 and 3650; the method is null or 1–80 characters.
- Does not set 365. Does not update existing rows. Does not replace `issue_gift_voucher`, `redeem_voucher`, or `cancel_voucher`.

Existing rows: the four columns read null. Issued vouchers keep the snapshot columns they already have.

Idempotent: yes.

Mid-file failure: some of the four columns may exist. Recovery: re-run this file. Undo, only while all four are still null: drop the two check constraints and the four columns.

Pre-check:

```sql
select count(*) = 0 as term_columns_absent
from information_schema.columns
where table_schema = 'public'
  and table_name = 'platform_settings'
  and column_name in (
    'voucher_default_validity_days',
    'voucher_default_allow_partial',
    'voucher_default_allow_topup',
    'voucher_default_redemption_method'
  );
```

Post-check:

```sql
select voucher_default_validity_days is null
  and voucher_default_allow_partial is null
  and voucher_default_allow_topup is null
  and voucher_default_redemption_method is null as term_defaults_unset
from public.platform_settings
where id = 'default';
```

## 4. `supabase/host-identity.sql`

Merge stage: before the deploy that includes #40.

Changes:

- Tables `host_identities`, `host_identity_events`, `host_recovery_challenges`, with the indexes in the file.
- `event_host_access.session_version integer not null default 0`, plus a non-negative check.
- `events.invitation_greeting text not null default ''`, plus a length check of 500.
- RLS enabled. One ALL policy per new table, named `No direct access to host identities`, `No direct access to host identity events`, and `No direct access to host recovery challenges`, for `anon` and `authenticated`, using false.
- `revoke all` from `anon`, `authenticated`, `public`. `grant all` to `service_role`.
- No backfill. Existing events stay on the access code. No email is copied.

Existing rows: every current `event_host_access` row reads `session_version` 0. Every current event reads `invitation_greeting` as an empty string. No host row is inserted.

Idempotent: yes.

Mid-file failure: a new table may exist without its policy, or one of the two columns may exist. Recovery: re-run this file. Undo, only while the three new tables are empty: drop the three tables, drop `session_version` (this drops the version check with it), and drop `invitation_greeting`. Do not drop `event_host_access` or `events`.

Pre-check:

```sql
select to_regclass('public.host_identities') is null as identities_absent;
select count(*) = 0 as host_columns_absent
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'event_host_access' and column_name = 'session_version')
    or (table_name = 'events' and column_name = 'invitation_greeting')
  );
```

Post-check:

```sql
select count(*) = 0 as identities_empty from public.host_identities;
select count(*) = 0 as session_version_nulls
from public.event_host_access
where session_version is null;
select count(*) = 0 as greeting_nulls
from public.events
where invitation_greeting is null;
select polname
from pg_policies
where schemaname = 'public'
  and tablename in ('host_identities', 'host_identity_events', 'host_recovery_challenges')
order by 1;
```

The policy query should return exactly the three names above.

## 5. `supabase/support-notes.sql`

Merge stage: before the deploy that includes #39.

Changes:

- Table `support_notes` (`subject_kind` order or event, body 1–2000 characters) and index `support_notes_subject_idx`.
- RLS enabled and forced. No policy, so anon and authenticated cannot read or write.
- `revoke all` from `anon`, `authenticated`, `public`. `grant select, insert` to `service_role` only.
- Function `support_notes_append_only` and triggers `support_notes_no_update`, `support_notes_no_delete`.

Existing rows: none. The table is new. Orders and events are not modified. Saving a note fails closed until this file is applied; the admin screen still opens.

Idempotent: yes.

Mid-file failure: the table may exist without the triggers. Recovery: re-run this file. Undo, only while the table is empty: `drop table public.support_notes`. That drops the triggers with it. Then drop the function if it remains.

Pre-check:

```sql
select to_regclass('public.support_notes') is null as notes_absent;
```

Post-check:

```sql
select count(*) = 0 as notes_empty from public.support_notes;
select count(*) = 0 as no_note_policies
from pg_policies
where schemaname = 'public' and tablename = 'support_notes';
select count(*) = 2 as append_only_triggers
from pg_trigger
where tgname in ('support_notes_no_update', 'support_notes_no_delete')
  and not tgisinternal;
```

## 6. `supabase/notifications-and-documents.sql`

Merge stage: before the deploy that includes #33.

Changes:

- Tables `notification_templates`, `notification_messages`, `documents`, their indexes, and the unique indexes that allow one open document kind per order and one credit per original.
- Replaces `public.set_updated_at()` with the same body already installed by `orders.sql` and `demo-checkout.sql`, and adds `notification_templates_set_updated_at`, `notification_messages_set_updated_at`, `documents_set_updated_at`.
- Inserts Hebrew template rows with `on conflict (id) do nothing`.
- Nullable columns on `platform_settings`: `vat_rate_percent`, `vat_included`, `default_document_kind`, `document_currency`, `notification_channels`.
- One data write: sets `notification_channels` to `array['email']` on the `platform_settings` row `id = 'default'` only when that column is null. It does not set a VAT rate.
- RLS enabled on the three tables. No policies. Revoke from `anon`, `authenticated`, and `public`. `grant all` to `service_role`.

Existing rows: orders, vouchers, and events are not updated. VAT columns stay null. The settings row gains `notification_channels = {email}` when it was null.

Idempotent: yes. The settings update does nothing once the column is non-null. Template inserts do nothing on conflict.

Mid-file failure: a table or a column may exist without the template rows or the settings update. Recovery: re-run this file. Undo, only while the three tables are empty and the VAT columns are still null: drop `documents`, `notification_messages`, and `notification_templates`, drop the five columns, and leave `set_updated_at()` in place (other tables use it). If `notification_channels` was set to `{email}` by this file and nobody has changed it, set it back to null before dropping the column.

Pre-check:

```sql
select to_regclass('public.notification_templates') is null as templates_absent;
select to_regclass('public.notification_messages') is null as messages_absent;
select to_regclass('public.documents') is null as documents_absent;
select count(*) = 0 as settings_columns_absent
from information_schema.columns
where table_schema = 'public'
  and table_name = 'platform_settings'
  and column_name in (
    'vat_rate_percent',
    'vat_included',
    'default_document_kind',
    'document_currency',
    'notification_channels'
  );
```

Post-check:

```sql
select vat_rate_percent is null
  and vat_included is null
  and default_document_kind is null
  and document_currency is null
  and notification_channels = array['email']::text[] as vat_unset_and_email_channel
from public.platform_settings
where id = 'default';
select count(*) = 0 as no_document_policies
from pg_policies
where schemaname = 'public'
  and tablename in ('notification_templates', 'notification_messages', 'documents');
select count(*) > 0 as templates_seeded from public.notification_templates;
```

## 7. `supabase/audit-events.sql`

Merge stage: before the deploy that includes #32.

Changes:

- Table `audit_events` and indexes `audit_events_at_idx`, `audit_events_action_at_idx`.
- RLS enabled and forced. No policy.
- `revoke all` from `anon`, `authenticated`, `public`. `grant select, insert` to `service_role` only.
- Functions `audit_events_append_only` and `audit_events_scrub_metadata`.
- Triggers `audit_events_scrub_metadata`, `audit_events_no_update`, `audit_events_no_delete`.

Existing rows: none. No other table is modified.

Idempotent: yes. The file header says it is not applied until a person runs it.

Mid-file failure: the table may exist without the triggers. Recovery: re-run this file. Undo, only while the table is empty: `drop table public.audit_events`, then drop the two functions if they remain. Do not drop the table once it holds rows; that deletes the trail.

Pre-check:

```sql
select to_regclass('public.audit_events') is null as audit_absent;
```

Post-check:

```sql
select count(*) = 0 as audit_empty from public.audit_events;
select count(*) = 0 as no_audit_policies
from pg_policies
where schemaname = 'public' and tablename = 'audit_events';
select count(*) = 3 as audit_triggers
from pg_trigger
where tgname in (
  'audit_events_scrub_metadata',
  'audit_events_no_update',
  'audit_events_no_delete'
) and not tgisinternal;
select has_table_privilege('anon', 'public.audit_events', 'insert') is false as anon_cannot_insert;
```

If the read-only role cannot call `has_table_privilege` for `anon`, the policy count of zero plus the grant in the file is the check. Do not grant anything to make the check pass.
