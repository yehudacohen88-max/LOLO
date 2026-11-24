import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PRODUCTION_SUPABASE_REF, profiles, skippedSql } from "./local-db-order.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function listSql(directory: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".temp") {
        continue;
      }
      found.push(...listSql(full));
      continue;
    }
    if (entry.name.endsWith(".sql")) {
      found.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
  return found;
}

describe("local SQL order", () => {
  it("classifies every SQL file and never applies a skipped file", () => {
    const files = listSql(path.join(root, "supabase")).sort();
    const used = new Set<string>([
      ...profiles.ci,
      ...profiles.full,
      ...profiles.seed,
      ...Object.keys(skippedSql),
    ]);
    assert.deepEqual(
      files,
      [...used].filter((file) => file.startsWith("supabase/")).sort(),
    );
    for (const file of used) {
      assert.equal(fs.existsSync(path.join(root, file)), true, file);
    }
    for (const file of Object.keys(skippedSql)) {
      assert.equal(profiles.ci.includes(file), false);
      assert.equal(profiles.full.includes(file), false);
      assert.equal(profiles.seed.includes(file), false);
    }
    assert.match(skippedSql["supabase/fix-public-read.sql"], /do-not-run/i);
  });

  it("follows the README schema order and keeps settlements and demo seed out of the default profile", () => {
    assert.deepEqual(profiles.ci.slice(0, 12), [
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
    ]);
    const fullOnly = [
      "supabase/settlements.sql",
      "supabase/settlement-exclude-demo.sql",
      "supabase/demo-seed.sql",
    ];
    assert.deepEqual(
      profiles.ci,
      profiles.full.filter((file) => !fullOnly.includes(file)),
    );
    assert.equal(profiles.ci.includes("supabase/settlements.sql"), false);
    assert.equal(profiles.ci.includes("supabase/settlement-exclude-demo.sql"), false);
    assert.equal(profiles.ci.includes("supabase/demo-seed.sql"), false);
    assert.ok(
      profiles.full.indexOf("supabase/pilot-demo-voucher-guard.sql") <
        profiles.full.indexOf("supabase/settlement-exclude-demo.sql"),
    );
    assert.ok(
      profiles.full.indexOf("supabase/settlements.sql") <
        profiles.full.indexOf("supabase/settlement-exclude-demo.sql"),
    );
    assert.ok(
      profiles.full.indexOf("supabase/settlement-exclude-demo.sql") <
        profiles.full.indexOf("supabase/demo-seed.sql"),
    );
    assert.ok(
      profiles.full.indexOf("supabase/events-anon-read.sql") <
        profiles.full.indexOf("supabase/audit-events.sql"),
    );
    assert.equal(profiles.full.at(-1), "supabase/demo-seed.sql");
    assert.deepEqual(profiles.seed, ["supabase/demo-seed.sql"]);
    for (const file of [
      "supabase/payments-attempts.sql",
      "supabase/voucher-term-defaults.sql",
      "supabase/pilot-demo-voucher-guard.sql",
      "supabase/host-identity.sql",
      "supabase/support-notes.sql",
      "supabase/notifications-and-documents.sql",
      "supabase/pilot-feedback.sql",
      "scripts/audit-demo-vouchers.sql",
      "supabase/readonly/test-data-inventory.sql",
      "supabase/pilot-isolate-test-data.sql",
    ]) {
      assert.equal(profiles.ci.includes(file), true, file);
      assert.equal(profiles.full.includes(file), true, file);
    }
  });

  it("keeps the documented order in docs/security/local-database.md", () => {
    const doc = fs.readFileSync(path.join(root, "docs/security/local-database.md"), "utf8");
    const documented = [
      ...doc.matchAll(/`((?:supabase|scripts)\/[A-Za-z0-9_./-]+\.sql)`/g),
    ].map((match) => match[1]);
    assert.deepEqual(documented, [...profiles.full, ...Object.keys(skippedSql)]);
    assert.match(doc, /do not run/i);
    assert.match(doc, /127\.0\.0\.1/);
  });
});

describe("CI workflow", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");

  it("runs on pull_request without repository secrets or the Production host", () => {
    assert.match(workflow, /^on:\n {2}pull_request:\s*$/m);
    assert.doesNotMatch(workflow, /\n {2}push:/);
    assert.doesNotMatch(workflow, /workflow_dispatch:/);
    assert.doesNotMatch(workflow, /\$\{\{\s*secrets[.\[]/);
    assert.doesNotMatch(workflow, /\bsecrets\.[A-Za-z0-9_]+/);
    assert.equal(workflow.toLowerCase().includes(PRODUCTION_SUPABASE_REF), false);
    assert.doesNotMatch(workflow, /--remote\b/);
    assert.doesNotMatch(workflow, /supabase\.co/i);
    assert.match(workflow, /npm ci/);
    assert.match(workflow, /npm run lint/);
    assert.match(workflow, /next typegen/);
    assert.match(workflow, /tsc --noEmit/);
    assert.match(workflow, /scripts\/run-verify\.mjs/);
    assert.match(workflow, /scripts\/assert-no-production-supabase\.mjs/);
    assert.match(workflow, /supabase start|scripts\/local-db\.mjs start/);
    assert.match(workflow, /profile: ci/);
    assert.match(workflow, /profile: full/);
  });
});

describe("audit SQL file", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/audit-events.sql"), "utf8");

  it("enables RLS, creates no anon policy, and is marked not applied", () => {
    assert.match(sql, /NOT APPLIED to Production/);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /force row level security/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(sql, /from anon, authenticated, public/i);
    assert.match(sql, /grant select, insert on table public\.audit_events to service_role/i);
    assert.doesNotMatch(sql, /grant\s+(all|update|delete)/i);
    assert.match(sql, /audit_events is append-only/);
    assert.match(sql, /set search_path = ''/);
  });
});
