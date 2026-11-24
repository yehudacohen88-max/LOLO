// Machine-readable SQL order for the local Docker database.
// CI and `npm run db:*` import this file. Do not apply these files to a hosted project.

export const PRODUCTION_SUPABASE_REF = "fafvveudrlovaozazkny";

// README.md steps 1–12. schema.sql is first-install only; the local script
// applies it on an empty database and always follows it with events-anon-read.sql
// in the same run so anonymous reads are not left open.
const readmeSchema = [
  "supabase/schema.sql",
  "supabase/events-server-write.sql",
  "supabase/orders.sql",
  "supabase/host-access-code.sql",
  "supabase/event-guests.sql",
  "supabase/invite-tokens.sql",
  "supabase/stores.sql",
  "supabase/stores-admin-fields.sql",
  "supabase/event-gifts-store.sql",
  "supabase/custom-gifts.sql",
  "supabase/demo-checkout.sql",
  "supabase/vouchers.sql",
];

const anonRead = "supabase/events-anon-read.sql";
const auditEvents = "supabase/audit-events.sql";
const settlements = "supabase/settlements.sql";
const demoSeed = "supabase/demo-seed.sql";

export const profiles = {
  // Default CI job and `npm run db:local`. Settlements are not in Production,
  // so this profile leaves that table absent. audit-events.sql is local-only
  // until a person applies it in the SQL editor.
  ci: [...readmeSchema, anonRead, auditEvents],
  // Opt-in CI job and `npm run db:reset`. demo-seed.sql runs only here.
  full: [...readmeSchema, anonRead, settlements, auditEvents, demoSeed],
  // `npm run db:seed`. Requires the full profile already applied.
  seed: [demoSeed],
};

export const skippedSql = {
  "supabase/fix-public-read.sql":
    "do-not-run: header says Do not run. Restores anonymous reads of events and gifts.",
  "supabase/demo-cleanup.sql":
    "manual local cleanup only. Deletes demo rows. Not an install step and not run by CI.",
};
