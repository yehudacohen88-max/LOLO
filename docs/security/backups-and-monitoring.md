# Backups and monitoring

Nothing in this change buys a backup add-on, a log drain, or an error tracker. Nothing here queries Production or changes a Supabase setting.

## What was observed

The Production project ref is `fafvveudrlovaozazkny`. The Supabase connection available while writing this note does not include that project, so this document does not claim a plan, a backup list, or a point-in-time recovery setting for it. No SQL was run against it.

## What Supabase publishes

From the Supabase database backups guide (read 24 November 2026, https://supabase.com/docs/guides/platform/backups):

- Pro, Team, and Enterprise projects get daily physical backups. Retention in the dashboard is 7 days on Pro, 14 on Team, and up to 30 on Enterprise.
- Free projects do not get those dashboard backups. Supabase's guidance for the free tier is to export with the Supabase CLI `db dump` command and keep copies off the platform.
- Point-in-time recovery is a paid add-on for Pro, Team, and Enterprise, and it needs at least a Small compute add-on. While it is on, daily backups are not also taken. The published list price starts near 100 USD per month for 7 days of recovery.
- Database backups do not include Storage objects. Restoring a backup does not put back a file deleted from Storage after that backup.
- Deleting a project deletes its backups.

A person with access to that project should open Database, then Backups, and write down whether any backup is listed and whether point-in-time recovery is on. That check is read-only. This repository does not perform it and does not recommend turning the add-on on.

If the project is on the Free plan, there is no automatic backup until someone chooses to pay or a person takes an off-site dump from a trusted machine. Do not commit a dump. Do not run a dump from GitHub Actions. Do not point `supabase db dump` at Production from the scripts in this repo. Those scripts refuse any host that is not loopback.

Restore, if a backup exists, is a dashboard action by a person. The project is unavailable while it restores. This repo cannot restore Production, and CI must not try.

## Monitoring

The repo has no Sentry project, no OpenTelemetry exporter, and no health route beyond the app itself. There is nothing to purchase in this change.

What exists today:

- Vercel keeps deployment and runtime logs for the hosted app.
- Supabase keeps API and database logs in its dashboard for the project.
- Missing schema is already fail-closed in the app: checkout, vouchers, and settlements return a Hebrew unavailable or "not enabled yet" message and log a server-side code. The audit helper does the same kind of fail-soft skip when `audit_events` is absent, and it does not log the row.

A later monitoring pass, still without buying a product until someone asks, can be:

1. A person looks at Vercel runtime errors for 5xx on `/api/payments`, `/api/store/redeem`, and `/api/admin` after a deploy.
2. A person exports Supabase advisors read-only before any new SQL that pins `search_path` on existing functions. Do not add `supabase/function-search-path.sql` until that export lists the functions. The new audit trigger functions in `supabase/audit-events.sql` already set `search_path` to empty.
3. Treat a log line `[LOLO] audit_events insert skipped` with reason `unavailable` as the signal that the audit file is still not applied. The user-facing action should still succeed.
4. Leave rate limits as they are: in-memory limits are active, and the Vercel Firewall rules named in `docs/upload-rate-limit-proposal.md` stay unpublished until someone with firewall access creates them.

## When something looks wrong

- Hebrew "השירות אינו זמין כרגע" on a page that needs the database usually means a required env var is missing, or the service role was removed. Preview should fail that way rather than use Production. See `docs/security/preview-environment.md`.
- "הנפקת השוברים עדיין לא הופעלה." means `supabase/vouchers.sql` is not on that database.
- "ההתחשבנות עדיין לא הופעלה." means `supabase/settlements.sql` is not on that database. That is still the Production state. Do not apply it from CI.
- Do not re-run `supabase/schema.sql` on a database that already had `supabase/events-anon-read.sql`. That reopens anonymous reads. Run the anonymous-read file again afterwards if it happens.
- Do not restore Production from a laptop, and do not run `supabase/demo-seed.sql` or `supabase/demo-cleanup.sql` against it.
