import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isForbiddenAuditKey, redactAuditMetadata, redactAuditString } from "../lib/audit/redact";
import { recordAuditEvent, type AuditWriter } from "../lib/audit/record";

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature";

describe("audit redaction", () => {
  it("drops secret keys and keeps an error code", () => {
    assert.equal(isForbiddenAuditKey("error_code"), false);
    assert.equal(isForbiddenAuditKey("access_code"), true);
    assert.equal(isForbiddenAuditKey("code"), true);

    const metadata = redactAuditMetadata({
      error_code: "voucher_closed",
      password: "do-not-store",
      nested: { access_code: "DEMO-LOLO", store_slug: "demo-ofanaim" },
      note: `hash pbkdf2$sha256$1$aa$bb and ${JWT}`,
    });

    assert.equal(metadata.error_code, "voucher_closed");
    assert.equal("password" in metadata, false);
    assert.deepEqual(metadata.nested, { store_slug: "demo-ofanaim" });
    assert.equal(metadata.note, "[redacted]");
  });

  it("redacts the production project ref, a bearer token, and a matching env secret", () => {
    const previous = process.env.LOLO_ADMIN_PASSWORD;
    process.env.LOLO_ADMIN_PASSWORD = "ci-admin-password";
    try {
      assert.equal(
        redactAuditString("https://fafvveudrlovaozazkny.supabase.co"),
        "[redacted]",
      );
      assert.equal(redactAuditString("Bearer ci-admin-password"), "[redacted]");
      const metadata = redactAuditMetadata({ note: "ci-admin-password" });
      assert.equal(metadata.note, "[redacted]");
    } finally {
      if (previous === undefined) {
        delete process.env.LOLO_ADMIN_PASSWORD;
      } else {
        process.env.LOLO_ADMIN_PASSWORD = previous;
      }
    }
  });
});

describe("audit insert helper", () => {
  it("does not throw or log the payload when the table is missing", async () => {
    const errors: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    const secret = "relation-message-must-not-be-logged";
    let calls = 0;
    const writer: AuditWriter = {
      from(table) {
        assert.equal(table, "audit_events");
        return {
          async insert(row) {
            calls += 1;
            assert.equal(row.actor, "admin");
            assert.equal(row.action, "admin.login.failure");
            assert.equal(row.subject, "");
            const metadata = row.metadata as Record<string, unknown>;
            assert.equal(metadata.error_code, "login_failed");
            assert.equal("password" in metadata, false);
            return { error: { code: "42P01", message: `audit_events missing ${secret}` } };
          },
        };
      },
    };

    try {
      const result = await recordAuditEvent(
        {
          actor: "admin",
          action: "admin.login.failure",
          metadata: { error_code: "login_failed", password: secret },
        },
        { writer },
      );
      assert.deepEqual(result, { recorded: false, reason: "unavailable" });
      assert.equal(calls, 1);
      assert.equal(JSON.stringify(errors).includes(secret), false);
    } finally {
      console.error = original;
    }
  });

  it("records only the scrubbed row", async () => {
    const rows: Record<string, unknown>[] = [];
    const writer: AuditWriter = {
      from() {
        return {
          async insert(row) {
            rows.push(row);
            return { error: null };
          },
        };
      },
    };

    const result = await recordAuditEvent(
      {
        actor: "store:demo-ofanaim",
        action: "store.login.success",
        subject: "demo-ofanaim",
        metadata: { token: JWT, error_code: "ok" },
      },
      { writer },
    );

    const stored = rows[0];
    assert.deepEqual(result, { recorded: true });
    assert.ok(stored);
    assert.equal(stored.subject, "demo-ofanaim");
    assert.deepEqual(stored.metadata, { error_code: "ok" });
  });

  it("rejects an actor that could be a code without calling the writer", async () => {
    let calls = 0;
    const writer: AuditWriter = {
      from() {
        calls += 1;
        return { async insert() { return { error: null }; } };
      },
    };
    const result = await recordAuditEvent(
      { actor: "DEMO-LOLO", action: "host.login.success" },
      { writer },
    );
    assert.deepEqual(result, { recorded: false, reason: "rejected" });
    assert.equal(calls, 0);
  });

  it("fails soft when Supabase is not configured", async () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const result = await recordAuditEvent({
        actor: "admin",
        action: "admin.login.failure",
      });
      assert.deepEqual(result, { recorded: false, reason: "unconfigured" });
    } finally {
      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      }
      if (previousKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      }
    }
  });

  it("fails soft when the writer throws", async () => {
    const writer: AuditWriter = {
      from() {
        return {
          insert() {
            throw new Error("socket hang up with a token eyJshould-not-log");
          },
        };
      },
    };
    const errors: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    try {
      const result = await recordAuditEvent(
        { actor: "admin", action: "admin.login.success" },
        { writer },
      );
      assert.deepEqual(result, { recorded: false, reason: "unavailable" });
      assert.equal(JSON.stringify(errors).includes("eyJshould-not-log"), false);
    } finally {
      console.error = original;
    }
  });
});
