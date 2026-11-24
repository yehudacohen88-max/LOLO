# Audit log

`supabase/audit-events.sql` adds `public.audit_events`. The file is not applied to Production. Local Docker and CI apply it. A person applies it in the SQL editor only after approval.

The table stores `actor`, `action`, `subject`, `at`, and `metadata`. RLS is enabled and forced. There are no policies, so `anon` and `authenticated` have no access. The service role may select and insert. A trigger rejects update and delete. Another trigger replaces metadata that still contains a password-like key, a `pbkdf2$` hash, or the Production project ref.

`lib/audit/record.ts` exports `recordAuditEvent`. It does not throw.

- Missing Supabase env returns `{ recorded: false, reason: "unconfigured" }`.
- A missing `audit_events` table (or a thrown client) returns `{ recorded: false, reason: "unavailable" }`.
- A row that is not a safe actor/action, or an insert the database rejects, returns `{ recorded: false, reason: "rejected" }`.

The helper drops metadata keys such as `password`, `token`, `secret`, `code`, `access_code`, and `code_hash`. It keeps keys such as `error_code`. It redacts JWT-shaped values, `pbkdf2$` hashes, bearer values, the Production project ref, and any string equal to a secret-like environment variable. Logs from a failed insert include the reason and the SQLSTATE or PostgREST code only, not the row and not the database message.

Actor and action must be lowercase identifiers (`admin`, `store:demo-ofanaim`, `admin.login.failure`). Subject is an id or slug. A value that looks like a raw code is stored as an empty subject, or the whole event is rejected when the actor itself is not a safe identifier.

## Call sites

No admin, store, or host route calls the helper yet. Open PRs #28–#30 already edit settlement routes, store redeem, the voucher repository, `package.json`, `proxy.ts`, and `next.config.ts`. Wiring those routes now would collide with them. Later call sites, after those PRs merge: admin login success and failure, store login, host login, redemption-code rotation, voucher cancel, settlement mark-paid, and guest-fee changes.
