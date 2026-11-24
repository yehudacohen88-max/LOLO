import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recordAuditEvent } from "../lib/audit/record";
import { anonCatalogIsClosed } from "../lib/events/guest-shape";
import { PRODUCTION_SUPABASE_REF } from "./local-db-order.mjs";

const enabled = process.env.LOLO_LOCAL_DB === "1";

function required(name: string) {
  const value = process.env[name]?.trim() ?? "";
  assert.ok(value, `${name} is required when LOLO_LOCAL_DB=1`);
  assert.equal(value.toLowerCase().includes(PRODUCTION_SUPABASE_REF), false, name);
  return value;
}

function loopback(url: string) {
  const host = new URL(url).hostname;
  assert.ok(host === "127.0.0.1" || host === "localhost" || host === "::1", host);
}

async function rest(url: string, key: string, path: string, init?: RequestInit) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

describe(
  "local throwaway database",
  {
    skip: enabled ? false : "set LOLO_LOCAL_DB=1 to use the Docker database",
  },
  () => {
    it("closes anonymous event reads and keeps audit rows free of secrets", async () => {
      const url = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
      const anon = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      const service = required("SUPABASE_SERVICE_ROLE_KEY");
      loopback(url);

      for (const table of ["events", "event_gifts", "audit_events"]) {
        const { response, body } = await rest(url, anon, `/rest/v1/${table}?select=id&limit=1`);
        const rowCount = Array.isArray(body) ? body.length : 0;
        assert.equal(
          anonCatalogIsClosed(response.status, rowCount),
          true,
          `${table} status ${response.status}`,
        );
      }

      const recorded = await recordAuditEvent({
        actor: "ci",
        action: "ci.audit.probe",
        subject: "local-db",
        metadata: {
          error_code: "probe",
          password: "do-not-store",
          note: "pbkdf2$sha256$1$aa$bb",
        },
      });
      assert.deepEqual(recorded, { recorded: true });

      const probe = await rest(
        url,
        service,
        "/rest/v1/audit_events?action=eq.ci.audit.probe&select=actor,action,subject,metadata&order=at.desc&limit=1",
      );
      assert.equal(probe.response.status, 200);
      assert.ok(Array.isArray(probe.body) && probe.body.length === 1);
      const row = (probe.body as Array<{ metadata: Record<string, unknown> }>)[0];
      assert.equal(row?.metadata.error_code, "probe");
      assert.equal("password" in (row?.metadata ?? {}), false);
      assert.equal(JSON.stringify(row).includes("pbkdf2$"), false);
      assert.equal(JSON.stringify(row).includes("do-not-store"), false);

      const raw = await rest(url, service, "/rest/v1/audit_events", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          actor: "ci",
          action: "ci.audit.raw",
          subject: "local-db",
          metadata: { password: "direct-insert", error_code: "should-not-remain" },
        }),
      });
      assert.equal(raw.response.ok, true);
      const rawBody = Array.isArray(raw.body) ? raw.body[0] : raw.body;
      const rawMetadata =
        rawBody && typeof rawBody === "object" && "metadata" in rawBody
          ? (rawBody.metadata as Record<string, unknown>)
          : {};
      assert.equal("password" in rawMetadata, false);
      assert.equal(JSON.stringify(rawMetadata).includes("direct-insert"), false);

      const patched = await rest(
        url,
        service,
        "/rest/v1/audit_events?action=eq.ci.audit.probe",
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ action: "ci.audit.rewritten" }),
        },
      );
      assert.equal(patched.response.ok, false);

      const deleted = await rest(
        url,
        service,
        "/rest/v1/audit_events?action=eq.ci.audit.probe",
        { method: "DELETE" },
      );
      assert.equal(deleted.response.ok, false);

      const still = await rest(
        url,
        service,
        "/rest/v1/audit_events?action=eq.ci.audit.probe&select=action&limit=1",
      );
      assert.equal(still.response.status, 200);
      assert.equal(Array.isArray(still.body) && still.body.length === 1, true);
    });

    it("matches the selected local profile for settlements and demo seed", async () => {
      const url = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
      const service = required("SUPABASE_SERVICE_ROLE_KEY");
      loopback(url);
      const profile = process.env.LOLO_LOCAL_PROFILE ?? "ci";
      assert.ok(profile === "ci" || profile === "full");

      const settlements = await rest(url, service, "/rest/v1/settlements?select=id&limit=1");
      const demo = await rest(
        url,
        service,
        "/rest/v1/events?slug=eq.demo-bat-mitzvah-noa&select=slug",
      );
      const demoRows = Array.isArray(demo.body) ? demo.body.length : -1;

      if (profile === "ci") {
        assert.notEqual(settlements.response.status, 200);
        assert.equal(demo.response.status, 200);
        assert.equal(demoRows, 0);
        return;
      }

      assert.equal(settlements.response.status, 200);
      assert.equal(demo.response.status, 200);
      assert.equal(demoRows, 1);
    });
  },
);
