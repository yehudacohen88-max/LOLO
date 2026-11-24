# Local test database

LOLO's automated tests and `npm run db:*` use a Supabase stack in Docker on this machine. They do not connect to a hosted project. The scripts refuse to run when the database host is not `127.0.0.1` (or `localhost`) and when any environment value contains the Production project ref.

`supabase/config.toml` is the local CLI config (`project_id = "lolo"`). `[db.migrations].schema_paths` and `[db.seed]` are empty so `supabase db push` and a hosted `supabase db reset --remote` have no LOLO files to send. SQL is applied only by `scripts/local-db.mjs`.

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

The order below is the `full` profile. The default `ci` profile is the same list without the settlements file and without the demo seed. Removing those two leaves the audit file immediately after the anonymous-read file. The source of truth is `profiles` in `scripts/local-db-order.mjs`. `npm run verify:ci` fails if this list drifts.

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
14. `supabase/settlements.sql`
15. `supabase/audit-events.sql`
16. `supabase/demo-seed.sql`

Steps 1–12 match the README install order. Step 13 closes anonymous reads of events and gifts. The README runs that file once in Production after the server reads events. The local database always has that server code, so CI applies it in the same run as `schema.sql`. Re-running `schema.sql` by itself would open anonymous reads again; the script only applies it as part of this list, which ends that run with step 13.

Step 14 is omitted from the default CI job so that job matches Production, where settlements are not applied. The second CI job and `npm run db:reset` opt in.

Step 15 is applied on every local database. It is not applied to Production until a person runs it in the SQL editor. See `docs/security/audit-log.md`.

Step 16 is local test data. It is not part of deploy. It runs only in the `full` profile, after settlements, because the seed file requires that schema. Login details for the demo rows stay in `docs/DEMO.md`.

## Not applied

| File | Why |
| --- | --- |
| `supabase/fix-public-read.sql` | Obsolete. Do not run. It restores anonymous reads of events and gifts. |
| `supabase/demo-cleanup.sql` | Manual local cleanup. It deletes demo rows. It is not an install step. |

Commented SQL in `docs/upload-rate-limit-proposal.md` is not a file under `supabase/` and is not applied.

`npm run verify:ci` checks that every `supabase/**/*.sql` file is either in a profile or in this skip list.
