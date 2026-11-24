# Staged merge and deploy plan

Do not execute this plan from PR #41. Do not merge `cursor/integration-premerge`. Do not squash. After each parent merges, retarget the next child onto `main` without rebasing. Production deploys from `main`, so every merge below is a production deploy even when the diff is docs.

Hard limits for the person who runs this later:

- No write and no service-role use against project `fafvveudrlovaozazkny` except a reviewed SQL file pasted into the SQL editor in the stage that names it.
- Post-deploy checks are read-only.
- Do not change Vercel env, firewall, or domains in these stages. `BETA_ACCESS_ENABLED`, `LEGAL_DRAFTS_ENABLED`, and `SETTLEMENTS_ENABLED` stay unset or false. `PAYMENT_PROVIDER` stays `demo` until a separate vendor decision.
- Do not apply `supabase/demo-seed.sql`, `supabase/fix-public-read.sql`, or `supabase/demo-cleanup.sql` to Production.
- Do not schedule `supabase/events-anon-read.sql` as a new Production migration. The 24 Nov 2026 read already has its end state. It stays in the local and CI order only.
- Do not uncomment the write block in `supabase/pilot-isolate-test-data.sql`.
- Stop at the first failed pre-check or post-check. Do not start the next stage.

Current tips before this plan (2026-11-24): `main` is `bf8527ac810e3e9a4908bff54a36f5f20cc623d0`. Feature tips are recorded in `docs/system/integration-report.md`.

## Fail-closed voucher ordering

`planFundedVoucherIssue` refuses demo-funded issue when `voucher_demo_guard_version()` is missing or is not 1. The app then throws `voucher_demo_blocked`. That check is already in #29 (`4331939`), and #36, #38, and #40 contain it because they are stacked on #29.

Apply `supabase/pilot-demo-voucher-guard.sql` before the deploy that first includes #29. That is stage 1. Do not merge #38 (or deploy a tree that contains #38) if that file is not already in Production. A deploy of #38 without the guard SQL fails closed: demo issue returns `voucher_demo_blocked` instead of issuing a demo-only voucher.

The guard file depends on `supabase/vouchers.sql` and the order columns from `supabase/demo-checkout.sql`. The 24 Nov 2026 read shows those tables, columns, and the `vouchers_guard_issue` trigger are already in Production. The guard file replaces `vouchers_guard_issue()` with `create or replace function` and does not drop the trigger. Do not drop that trigger before applying the file. It does not depend on `payments-attempts.sql`. The allow-list ships empty, so existing paid rows do not become real money.

## Events and gifts

The same read found RLS on, and no policies, on `events` and `event_gifts`. In this repo `schema.sql` creates `Public can read events` and `Public can read event gifts`, and `events-server-write.sql` leaves those two policies. `events-anon-read.sql` drops them. The fetched structure is already that end state, so the file is not a pending Production step. A local rebuild still runs it, because `schema.sql` opens the policies. `fix-public-read.sql` would put them back. Do not run it.

Guest, host, and funding reads use the service role. No new SQL file adds a policy on `events` or `event_gifts`. The replica applied the new files twice and both tables still had zero policies.

## Stage 0 — before any merge

Pre-checks:

- `main` is still `bf8527a`. If it moved, stop and rebuild the integration branch.
- Draft #41 CI is green on both local-database jobs, including the Playwright smoke on the `full` profile.
- The 24 Nov 2026 read already shows the eleven current public tables, RLS on, no policies on `events` or `event_gifts`, `Public can read active stores` as the only store policy, one ALL deny policy on each other listed table, and `vouchers_guard_issue` present. New tables were absent. If a later read shows `Public can read events`, stop.
- Read-only: confirm Production does not already have `payment_provider_is_real`. If it does, stop and do not re-apply the guard blindly.
- Vercel Production env still has no live payment provider, beta gate closed, legal drafts off, settlements flag unset.

Stop: any of the above fails.

Rollback: nothing has been merged.

## Stage 1 — #29 demo voucher guard

Merge: merge commit of #29 `cursor/pilot-demo-voucher-guard-2d6a` into `main`.

SQL before the deploy goes live: `supabase/pilot-demo-voucher-guard.sql`. Apply it in the SQL editor, then merge, or merge only when the file is already applied. The Vercel production deploy starts when the merge commit lands.

SQL after: none.

Pre-checks: stage 0. The #29 tip includes the four guard fixes named in the integration report (unknown provider is simulated, seed does not redeem when the guard exists, idempotent issue, local-only allow-list helper).

Post-deploy, read-only:

- `select voucher_demo_guard_version();` returns 1.
- `select count(*) from payment_provider_allowlist;` is 0.
- Guest demo checkout on a production event is not part of this check. Do not create a row. A staff browser may open an existing demo event only if that event already exists; do not run the Playwright suite against Production or against a Vercel Preview.

Stop: version is not 1, or the allow-list is not empty. Do not merge #36.

Rollback: revert the merge commit. Restoring the previous issue/redeem functions is the rollback in `docs/system/sql-apply-order.md` step 15. Do that only if demo issue must work again before the guard can be fixed. Dropping `vouchers.demo_only` is not the first response.

## Stage 2 — #28 pilot readiness

Merge: merge commit of #28 `cursor/pilot-readiness-b92f` into `main`. Base is already `main`.

SQL before: none. `supabase/pilot-feedback.sql` may be applied after the deploy if the feedback table is wanted. It does not approve a pilot. `supabase/readonly/test-data-inventory.sql` is SELECT-only and may be run with a read-only connection. Do not apply the isolate write.

SQL after: optional `pilot-feedback.sql` only.

Deploy: production deploy of #28.

Pre-checks: stage 1 post-checks passed. `SETTLEMENTS_ENABLED` is still unset, so settlement routes stay on the unavailable page.

Post-deploy, read-only: open `/` and `/admin` login page. Do not submit. Confirm the beta gate still blocks a random visitor if the gate is enabled; if the gate is off, do not turn it on. Confirm settlement nav does not write.

Stop: a page 500s, or the settlements flag was turned on. Do not merge #30.

Rollback: revert the merge commit. Feedback table, if created, can stay; it has no money effect.

## Stage 3 — #30 legal drafts

Merge: merge commit of #30 `cursor/legal-privacy-drafts-7410` into `main`.

SQL: none.

Deploy: production deploy. `LEGAL_DRAFTS_ENABLED` stays off, so `/legal` stays hidden. The drafts still contain `[להשלמה]`.

Pre-checks: stage 2 passed. The flag is not set in Vercel.

Post-deploy, read-only: `GET /legal` is 404 while the flag is off.

Stop: the legal pages are publicly visible. Do not merge #36.

Rollback: revert the merge commit. No schema change.

## Stage 4 — #36 payments core

Retarget: set #36 `cursor/p1-payments-core` base to `main` after #29 is on `main`. Do not rebase. Then merge commit.

SQL before the deploy: `supabase/payments-attempts.sql`. It adds `payment_attempts` and `payment_refunds` and nullable refund-policy columns. It does not set a refund window. The header says not to run it until this stage is approved; this stage is that approval for the tables, not for a refund policy number.

Deploy: production deploy of #36 (includes #29).

Pre-checks: guard version is still 1. Refund columns are null after apply (`refund_window_days` is null).

Post-deploy, read-only: `to_regclass('public.payment_attempts')` and `to_regclass('public.payment_refunds')` are not null. Do not insert a payment. Do not post a webhook.

Stop: either table is missing, or a refund column was filled with a number. Do not merge #38.

Rollback: revert the merge commit. The new tables can stay empty. Dropping them is the step-13 rollback and deletes any attempt rows created after the deploy; do not drop them if a row exists until that row is reviewed.

## Stage 5 — #38 voucher terms

Retarget: set #38 `cursor/p2-voucher-terms` base to `main`. Do not rebase. Merge commit.

SQL before the deploy: `supabase/voucher-term-defaults.sql` (nullable columns only; it does not set 365 days). The guard SQL from stage 1 must already be applied. This is the stage the fail-closed note calls out: merging #38 without stage 1 leaves demo issue on `voucher_demo_blocked`.

Deploy: production deploy of #38.

Pre-checks: stage 1 and stage 4 post-checks. `voucher_default_validity_days` is null after the file runs.

Post-deploy, read-only: the four `voucher_default_*` columns exist and are null. `voucher_demo_guard_version()` is still 1.

Stop: a default was filled in, or the guard version is not 1. Do not merge #40.

Rollback: revert the merge commit. Drop the four columns only if they are still null.

## Stage 6 — #40 host and guest

Retarget: set #40 `cursor/p5-host-guest` base to `main`. Do not rebase. Merge commit.

SQL before the deploy: `supabase/host-identity.sql`. Without it, identity and recovery routes fail closed on the missing tables. The file does not backfill and does not copy management codes.

Deploy: production deploy of #40.

Pre-checks: stage 5 passed. The inactive-store edit fix is on this branch (an unchanged gift store is not re-checked as a new store).

Post-deploy, read-only: `to_regclass('public.host_identities')` is not null. Do not request a recovery code. Do not create an event.

Stop: the table is missing. Do not merge #34.

Rollback: revert the merge commit. Dropping the identity tables signs versioned host sessions out; do that only if the new routes must be removed.

## Stage 7 — #34 settlements

Retarget: set #34 `cursor/p3-settlement` base to `main` after #28 is on `main`. Do not rebase. Merge commit.

SQL: do not apply `supabase/settlements.sql` or `supabase/settlement-exclude-demo.sql` in this stage, and do not set `SETTLEMENTS_ENABLED`. The code ships behind the flag. `settlements.sql` is already in the `main` tree and is still not installed on Production.

A later, separate approval may apply those two files, in that order, only after stage 1's guard is present, and only in the same window as turning the flag on. `settlement-exclude-demo.sql` must run before any settlement batch, so a `demo_only` redemption cannot enter a batch. This plan does not grant that approval.

Deploy: production deploy of #34 with the flag still off.

Pre-checks: stage 2 and stage 6 passed. Flag unset.

Post-deploy, read-only: settlement pages still show the unavailable state. `to_regclass('public.settlements')` is still null.

Stop: the flag is on, or the settlements table exists without `settlement-exclude-demo.sql`. Do not merge #39.

Rollback: revert the merge commit. No schema change in this stage.

## Stage 8 — #39 store and admin

Retarget: set #39 `cursor/p6-store-admin` base to `main`. Do not rebase. Merge commit.

SQL before the deploy: `supabase/support-notes.sql`. Append-only notes. No money columns.

Deploy: production deploy of #39. Settlements UI stays gated.

Pre-checks: stage 7 passed.

Post-deploy, read-only: `to_regclass('public.support_notes')` is not null. Open the admin login page. Do not sign in against Production for a write test.

Stop: a 500 on the admin or store login page. Do not merge #33.

Rollback: revert the merge commit. The notes table can stay.

## Stage 9 — #33 notifications and documents

Merge: #33 `cursor/p4-notifications-invoices` is already based on `main`. Merge commit.

SQL before the deploy: `supabase/notifications-and-documents.sql`. It adds the log tables and nullable VAT columns. It does not set a VAT rate. Leave `vat_rate_percent` null. The app refuses to issue a document until those settings exist, and a simulated document stays watermarked.

Deploy: production deploy of #33. No email, SMS, or WhatsApp vendor is configured. Do not add one in Vercel.

Pre-checks: stage 8 passed.

Post-deploy, read-only: `notification_messages` and `documents` exist. VAT columns are null. Do not send a message.

Stop: a VAT number was written, or a provider other than the simulated one is set. Do not merge #32.

Rollback: revert the merge commit. Drop the three tables only if they are empty.

## Stage 10 — #32 audit and CI

Merge: #32 `cursor/p7-ci-testdb-audit` is already based on `main`. Merge commit.

SQL before the deploy: `supabase/audit-events.sql`. Service-role writes, no anonymous policy. `scripts/audit-demo-vouchers.sql` is SELECT-only and may be run read-only after vouchers exist.

Deploy: production deploy of #32. CI changes do not run on Production.

Pre-checks: stage 9 passed.

Post-deploy, read-only: `to_regclass('public.audit_events')` is not null. Anonymous REST on `audit_events` returns no rows.

Stop: anonymous insert is possible. Do not merge #31 until that is closed.

Rollback: revert the merge commit. Dropping `audit_events` deletes the trail; leave the table if any row exists.

## Stage 11 — #31 gap map

Merge: #31 `cursor/system-gap-map-1b7e` is docs only and is already based on `main`. Merge commit. It still triggers a production deploy of the same application.

SQL: none.

Pre-checks: stage 10 passed.

Post-deploy, read-only: the site still serves `/`. No schema change.

Rollback: revert the merge commit.

## What stays after all eleven stages

Listed in the next section. None of these stages open the beta gate, enable legal drafts, enable settlements, set VAT, set a refund window, apply the demo seed, or point a Vercel Preview at a new database.

## Remaining gaps

`docs/system/gap-map.md` was written before P1–P7. The rows it marks missing for payments, vouchers, settlements, notifications, host identity, admin lists, audit, CI, and the local database are built on the open PRs and on this integration branch. They are not re-opened here. These items are still open:

| Gap | Why it is still open |
| --- | --- |
| Live card processor | Needs a vendor and an allow-list row. The app throws `PAYMENTS_LIVE_NOT_ENABLED` for a non-demo provider. |
| Real email, SMS, or WhatsApp | Needs a vendor. Only the simulated provider sends, and it does not leave the server. The host's browser can open a WhatsApp share link; the server does not call it. |
| Accounting documents | Needs a vendor. VAT stays null on purpose. The simulator refuses to issue until settings exist and marks the file as a test document. |
| Refund window, commission default, voucher validity, currency rounding | Commercial numbers. The columns exist and stay null. This plan does not invent them. |
| Legal drafts | Placeholders `[להשלמה]` remain. `LEGAL_DRAFTS_ENABLED` stays off. |
| Settlement batches and bank payout | `SETTLEMENTS_ENABLED` stays off until `settlements.sql` and `settlement-exclude-demo.sql` are applied together under a separate approval. No payout vendor. |
| `search_path` on existing functions | Needs an advisor export that lists the functions. Guessing a pin list is not a fix. |
| SheetJS `xlsx` 0.18.5 | Guest Excel import and one e2e fixture still import it. Replacing the parser is local code, and it changes how guest rows are read. It was not swapped in this pass. |
| Content-Security-Policy and HSTS | A strict CSP breaks Next and the store QR scanner. HSTS would pin `127.0.0.1` for the local app. The other headers are set. |
| Per-person admin and extra store staff | Not asked for. One admin password and one store code remain. |
| Backups and an error sink | Supabase backups are a dashboard setting. Sentry or similar is a new vendor. |
| Vercel Preview writes | Previews still share the Production database. No Preview env was changed. See the free-cloud note in the integration PR report. A code guard that disables hosted writes was not added. |
| `pilot_isolated` | The write stays commented until someone approves isolating rows. |
