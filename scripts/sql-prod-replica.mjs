// Loads a local stand-in for the Production public schema, then applies the
// SQL files that are not in Production yet. Never uses a hosted URL.
//
// The 24 Nov 2026 read-only structure has RLS on and zero policies on
// events and event_gifts. Steps 1–12 leave "Public can read events" and
// "Public can read event gifts". events-anon-read.sql is what drops those
// two policies. It is part of the baseline so the replica matches that
// read, and it is not applied again with the new files. No production
// credentials are used and no production rows are copied.

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

const expectedColumns = {
  events: ["id", "slug", "title", "host_name", "event_type", "event_date", "event_time", "venue_name", "address", "message", "cover_image", "gift_mode", "money_amounts", "allow_custom_amount", "money_display", "created_at"],
  event_gifts: ["id", "event_id", "title", "description", "target_amount", "icon", "priority", "active", "store_id", "store_name", "image_url", "source"],
  event_guests: ["id", "event_id", "name", "phone", "created_at", "invite_token_hash", "invite_token_enc"],
  event_host_access: ["event_id", "code_hash", "created_at"],
  orders: ["id", "event_id", "event_slug", "guest_name", "guest_phone", "guest_email", "wants_confirmation", "greeting_text", "total_amount", "payment_status", "access_token", "created_at", "updated_at", "fee_amount", "charged_amount", "payment_provider", "payment_reference", "paid_at"],
  order_items: ["id", "order_id", "gift_id", "gift_name", "amount"],
  stores: ["id", "name", "slug", "active", "created_at", "updated_at", "logo_url", "website_url", "contact_name", "contact_phone", "contact_email", "commission_percent", "payment_terms_days", "settlement_method", "voucher_redemption_method", "voucher_validity_days", "allow_partial_redemption", "allow_customer_topup", "notes"],
  platform_settings: ["id", "guest_fee_enabled", "guest_fee_percent", "guest_fee_fixed", "updated_at"],
  vouchers: ["id", "event_id", "gift_id", "store_id", "code", "code_key", "qr_secret", "view_token", "amount", "remaining_amount", "status", "issued_at", "expires_at", "idempotency_key", "event_title", "gift_title", "store_name", "store_logo_url", "validity_days", "allow_partial_redemption", "allow_customer_topup", "redemption_method", "validity_is_default", "partial_is_default", "topup_is_default", "method_is_default", "created_at", "updated_at"],
  redemptions: ["id", "voucher_id", "store_id", "amount", "redeemed_at", "channel", "redeemed_by", "reference", "commission_percent_snapshot", "payment_terms_days_snapshot", "settlement_status", "created_at", "updated_at"],
  store_redemption_access: ["store_id", "code_hash", "updated_at"],
};

const expectedPolicies = {
  event_guests: "No direct access to event guests|ALL",
  event_host_access: "No direct access to host access codes|ALL",
  order_items: "No direct guest access to order items|ALL",
  orders: "No direct guest access to orders|ALL",
  platform_settings: "No direct access to platform settings|ALL",
  redemptions: "No direct access to redemptions|ALL",
  store_redemption_access: "No direct access to store redemption codes|ALL",
  stores: "Public can read active stores|SELECT",
  vouchers: "No direct access to vouchers|ALL",
};

const expectedTriggers = [
  "order_items_match_event",
  "orders_set_updated_at",
  "platform_settings_set_updated_at",
  "redemptions_block_delete",
  "redemptions_guard_update",
  "redemptions_set_updated_at",
  "stores_set_updated_at",
  "vouchers_block_delete",
  "vouchers_guard_issue",
  "vouchers_set_updated_at",
];

function sameSet(actual, expected) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertBaseline() {
  const report = JSON.parse(query(`
    select json_build_object(
      'tables', (
        select coalesce(json_agg(c.relname order by c.relname), '[]'::json)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
      ),
      'rls_off', (
        select coalesce(json_agg(c.relname order by c.relname), '[]'::json)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      ),
      'policies', (
        select coalesce(json_agg(
          c.relname || ':' || p.polname || ':' || case p.polcmd
            when 'r' then 'SELECT' when '*' then 'ALL' else p.polcmd::text end
          order by c.relname
        ), '[]'::json)
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
      ),
      'triggers', (
        select coalesce(json_agg(t.tgname order by t.tgname), '[]'::json)
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not t.tgisinternal
      ),
      'columns', (
        select coalesce(json_object_agg(table_name, cols), '{}'::json)
        from (
          select table_name, json_agg(column_name order by column_name) as cols
          from information_schema.columns
          where table_schema = 'public'
          group by table_name
        ) grouped
      )
    )::text
  `));

  const problems = [];
  const tables = Object.keys(expectedColumns);
  if (!sameSet(report.tables, tables)) {
    problems.push(`tables ${JSON.stringify(report.tables)}`);
  }
  if (report.rls_off.length > 0) {
    problems.push(`RLS off ${JSON.stringify(report.rls_off)}`);
  }
  const policies = Object.entries(expectedPolicies).map(([table, spec]) => {
    const [name, cmd] = spec.split("|");
    return `${table}:${name}:${cmd}`;
  });
  if (!sameSet(report.policies, policies)) {
    problems.push(`policies ${JSON.stringify(report.policies)}`);
  }
  if (!sameSet(report.triggers, expectedTriggers)) {
    problems.push(`triggers ${JSON.stringify(report.triggers)}`);
  }
  for (const [table, columns] of Object.entries(expectedColumns)) {
    if (!sameSet(report.columns[table] ?? [], columns)) {
      problems.push(`${table} columns ${JSON.stringify(report.columns[table] ?? [])}`);
    }
  }
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error("Baseline does not match the 24 Nov 2026 Production structure.");
    process.exit(1);
  }
  console.error("Baseline matches the fetched Production public structure.");
}

console.error("Resetting the loopback database without applying SQL.");
run(["scripts/local-db.mjs", "wipe"]);

console.error("Applying the Production-schema baseline.");
run(["scripts/local-db.mjs", "apply-files", ...baseline]);
assertBaseline();

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
  'guard_function', exists (select 1 from pg_proc where proname = 'payment_provider_is_real'),
  'events_policies', (
    select count(*) from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'events'
  ),
  'event_gift_policies', (
    select count(*) from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'event_gifts'
  ),
  'guard_trigger', exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'vouchers'
      and t.tgname = 'vouchers_guard_issue' and not t.tgisinternal
  )
)::text
`);

const parsed = JSON.parse(report);
const failed = Object.entries(parsed).filter(([key, value]) => {
  if (key === "events_policies" || key === "event_gift_policies") {
    return Number(value) !== 0;
  }
  return value !== true;
});
if (failed.length > 0) {
  console.error(report);
  console.error(`Replica checks failed: ${failed.map(([key]) => key).join(", ")}`);
  process.exit(1);
}

console.error(report);
console.error("Production-schema replica applied twice. Rollback column stayed absent.");
