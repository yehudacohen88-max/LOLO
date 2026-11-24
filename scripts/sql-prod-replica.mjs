// Loads a local stand-in for the Production schema, then applies the SQL
// files that are not in Production yet. Never uses a hosted URL.
//
// Baseline is the file list docs/system/gap-map.md marks as already applied
// (steps 1–12 plus events-anon-read.sql). No production credentials are used
// and no production rows are copied.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { profiles } from "./local-db-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const baseline = [
  ...profiles.full.slice(0, 12),
  "supabase/events-anon-read.sql",
];

const fresh = profiles.full.filter((file) => !baseline.includes(file));

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function query(sql) {
  const result = spawnSync(process.execPath, ["scripts/local-db.mjs", "query", sql], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status || 1);
  }
  return (result.stdout ?? "").trim();
}

console.error("Resetting the loopback database without applying SQL.");
run(["scripts/local-db.mjs", "wipe"]);

console.error("Applying the Production-schema baseline.");
run(["scripts/local-db.mjs", "apply-files", ...baseline]);

console.error("Inserting synthetic rows.");
run(["scripts/local-db.mjs", "apply-files", "scripts/sql-prod-replica-fixture.sql"]);

console.error("Applying SQL that is not in Production yet.");
run(["scripts/local-db.mjs", "apply-files", ...fresh]);

console.error("Applying that same SQL a second time.");
run(["scripts/local-db.mjs", "apply-files", ...fresh]);

const report = query(`
select json_build_object(
  'payment_attempts', to_regclass('public.payment_attempts') is not null,
  'payment_refunds', to_regclass('public.payment_refunds') is not null,
  'host_identities', to_regclass('public.host_identities') is not null,
  'notification_messages', to_regclass('public.notification_messages') is not null,
  'documents', to_regclass('public.documents') is not null,
  'settlements', to_regclass('public.settlements') is not null,
  'audit_events', to_regclass('public.audit_events') is not null,
  'pilot_feedback', to_regclass('public.pilot_feedback') is not null,
  'fixture_event', exists (select 1 from public.events where slug = 'schema-replica-sample'),
  'demo_event', exists (select 1 from public.events where slug = 'demo-bat-mitzvah-noa'),
  'isolate_column_absent', not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stores' and column_name = 'pilot_isolated'
  ),
  'guard_function', exists (select 1 from pg_proc where proname = 'payment_provider_is_real')
)::text
`);

const parsed = JSON.parse(report);
const failed = Object.entries(parsed).filter(([, value]) => value !== true);
if (failed.length > 0) {
  console.error(report);
  console.error(`Replica checks failed: ${failed.map(([key]) => key).join(", ")}`);
  process.exit(1);
}

console.error(report);
console.error("Production-schema replica applied twice. Rollback column stayed absent.");
