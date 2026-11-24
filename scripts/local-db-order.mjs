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

// Schema from the open PRs. Each file's prerequisites are already in readmeSchema
// or earlier in this list. events-anon-read stays after every events change.
const sharedAfterVouchers = [
  "supabase/payments-attempts.sql",
  "supabase/voucher-term-defaults.sql",
  "supabase/pilot-demo-voucher-guard.sql",
  "supabase/host-identity.sql",
  "supabase/support-notes.sql",
  "supabase/notifications-and-documents.sql",
  "supabase/pilot-feedback.sql",
  "supabase/events-anon-read.sql",
];

// Read-only checks. They run after the tables they select exist.
// pilot-isolate-test-data.sql executes only its SELECT statements. The write
// block stays inside a block comment and ends in ROLLBACK.
const sharedReads = [
  "supabase/audit-events.sql",
  "scripts/audit-demo-vouchers.sql",
  "supabase/readonly/test-data-inventory.sql",
  "supabase/pilot-isolate-test-data.sql",
];

const settlements = "supabase/settlements.sql";
const settlementExcludeDemo = "supabase/settlement-exclude-demo.sql";
const demoSeed = "supabase/demo-seed.sql";

const ci = [...readmeSchema, ...sharedAfterVouchers, ...sharedReads];

export const profiles = {
  // Default CI job and `npm run db:local`. Settlements are not in Production,
  // so this profile leaves that table absent. Every other SQL change is applied
  // on the loopback database, including files whose headers say not to run them
  // against Production.
  ci,
  // Opt-in CI job and `npm run db:reset`. Settlements, the demo exclusion, and
  // the demo seed run only here. The seed is last so issue_gift_voucher is the
  // guarded function and demo vouchers are not redeemed.
  full: [
    ...readmeSchema,
    ...sharedAfterVouchers,
    settlements,
    settlementExcludeDemo,
    ...sharedReads,
    demoSeed,
  ],
  // `npm run db:seed`. Requires the full profile already applied.
  seed: [demoSeed],
};

export const skippedSql = {
  "supabase/fix-public-read.sql":
    "do-not-run: header says Do not run. Restores anonymous reads of events and gifts.",
  "supabase/demo-cleanup.sql":
    "manual local cleanup only. Deletes demo rows. Not an install step and not run by CI.",
};
