# Local test database

LOLO's automated tests and `npm run db:*` use a Supabase stack in Docker on this machine. They do not connect to a hosted project. The scripts refuse to run when the database host is not `127.0.0.1` (or `localhost`) and when any environment value contains the Production project ref.

`supabase/config.toml` is the local CLI config (`project_id = "lolo"`). `[db.migrations].schema_paths` and `[db.seed]` are empty so `supabase db push` and a hosted `supabase db reset --remote` have no LOLO files to send. SQL is applied only by `scripts/local-db.mjs`, which pipes each file into `psql` inside the local `supabase_db_*` container. `supabase db query` cannot run these files: it sends them as one prepared statement.

## Commands

Install the Supabase CLI (CI uses 3.3.0) and Docker, then:

```bash
npm run db:local
npm run db:reset
npm run db:seed
```

- `db:local` runs `supabase start` and, on an empty database, applies the `ci` profile (no settlements, no demo seed).
- `db:reset` recreates the local database and applies the `full` profile, including settlements and the demo seed file.
- `db:seed` applies only the demo seed file, and only after the local schema exists.

Both database commands talk to Docker. A second `db:local` does not re-apply SQL. Use `db:reset` to rebuild.

The CLI prints local demo keys. Export them without writing over an existing env file:

```bash
node scripts/local-db.mjs export-env
```

Redirect that stdout yourself if you want a file. `.env*` is gitignored. Do not commit it.

`npm run test:e2e` is unchanged. It builds the app and does not use this database.

## Apply order

The order below is the `full` profile. The default `ci` profile is the same list without the settlements file, the demo-exclusion file, and the demo seed. The source of truth is `profiles` in `scripts/local-db-order.mjs`. `npm run verify:ci` fails if this list drifts. The backticks in this section are the full profile, then the two files CI does not apply.

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
13. `supabase/payments-attempts.sql`
14. `supabase/voucher-term-defaults.sql`
15. `supabase/pilot-demo-voucher-guard.sql`
16. `supabase/host-identity.sql`
17. `supabase/support-notes.sql`
18. `supabase/notifications-and-documents.sql`
19. `supabase/pilot-feedback.sql`
20. `supabase/events-anon-read.sql`
21. `supabase/settlements.sql`
22. `supabase/settlement-exclude-demo.sql`
23. `supabase/audit-events.sql`
24. `scripts/audit-demo-vouchers.sql`
25. `supabase/readonly/test-data-inventory.sql`
26. `supabase/pilot-isolate-test-data.sql`
27. `supabase/demo-seed.sql`

Steps 1–12 match the README install order. Step 20 closes anonymous reads of events and gifts, after the host-identity columns. The local database always has the server that reads events, so CI applies that file in the same run as the first install file. Re-running the first file by itself would open anonymous reads again; the script only applies it as part of this list.

Steps 21 and 22 are omitted from the default CI job so that job matches Production, where settlements are not applied. The second CI job and `npm run db:reset` opt in. Step 22 must follow both the settlements file and the pilot demo-voucher guard.

Step 23 is applied on every local database. It is not applied to Production until a person runs it in the SQL editor. See `docs/security/audit-log.md`.

Steps 24–26 are read-only. The isolate file's write block stays commented and ends in ROLLBACK, so CI runs only its SELECT statements.

Step 27 is local test data. It is not part of deploy. It runs only in the `full` profile, last, so the guarded voucher function is already installed and the seed does not redeem demo money. Login details stay in `docs/DEMO.md`.

## Not applied

| File | Why |
| --- | --- |
| `supabase/fix-public-read.sql` | Obsolete. Do not run. It restores anonymous reads of events and gifts. |
| `supabase/demo-cleanup.sql` | Manual local cleanup. It deletes demo rows. It is not an install step. |

Commented SQL in `docs/upload-rate-limit-proposal.md` is not a database file and is not applied.

`npm run verify:ci` checks that every SQL file under `supabase/` is either in a profile or in this skip list.
