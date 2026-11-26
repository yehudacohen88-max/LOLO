import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { isUngatedPath } from "../lib/beta/gate";
import {
  databaseAccess,
  healthHttpStatus,
  HEALTH_TIMEOUT_MS,
  runHealthCheck,
} from "../lib/health/check";
import { databaseProbeUrl, probeSupabaseRest } from "../lib/health/database-probe";
import { PRODUCTION_PROJECT_REF } from "../lib/supabase/preview-guard";

const PRODUCTION_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const STAGING_URL = "https://lolo-preview-example.supabase.co";
const SERVICE_KEY = "test-service-role-key";

describe("health route gate", () => {
  it("lets only the exact health path through and keeps every other route gated", () => {
    assert.equal(isUngatedPath("/api/health"), true);
    assert.equal(isUngatedPath("/beta"), true);
    assert.equal(isUngatedPath("/api/beta/login"), true);

    const stillGated = [
      "/api/health/",
      "/api/health-anything",
      "/api/health/extra",
      "/api/healthcare",
      "/api/healthz",
      "/api/health?db=1",
      "/API/health",
      "/api/events/missing",
      "/api/admin/login",
      "/api/admin/settings",
      "/api/host/login",
      "/api/stores",
      "/api/orders",
      "/admin",
      "/host",
      "/store",
      "/",
    ];
    for (const path of stillGated) {
      assert.equal(isUngatedPath(path), false, path);
    }
  });
});

describe("database access", () => {
  it("reports missing credentials without treating Production as disconnected", () => {
    assert.equal(
      databaseAccess({ vercelEnv: "production", supabaseUrl: "", serviceRoleKey: "" }),
      "not_configured",
    );
    assert.equal(
      databaseAccess({
        vercelEnv: "production",
        supabaseUrl: "   ",
        serviceRoleKey: SERVICE_KEY,
      }),
      "not_configured",
    );
    assert.equal(
      databaseAccess({
        vercelEnv: undefined,
        supabaseUrl: PRODUCTION_URL,
        serviceRoleKey: SERVICE_KEY,
      }),
      "ready",
    );
  });

  it("reports Preview as not configured or disconnected and does not allow Production", () => {
    assert.equal(
      databaseAccess({ vercelEnv: "preview", supabaseUrl: "", serviceRoleKey: "" }),
      "not_configured",
    );
    assert.equal(
      databaseAccess({
        vercelEnv: "preview",
        supabaseUrl: STAGING_URL,
        serviceRoleKey: SERVICE_KEY,
      }),
      "disconnected",
    );
    assert.equal(
      databaseAccess({
        vercelEnv: "preview",
        supabaseUrl: PRODUCTION_URL,
        serviceRoleKey: SERVICE_KEY,
        allowPreviewDbUrl: PRODUCTION_URL,
      }),
      "disconnected",
    );
    assert.equal(
      databaseAccess({
        vercelEnv: "preview",
        supabaseUrl: STAGING_URL,
        serviceRoleKey: SERVICE_KEY,
        allowPreviewDbUrl: STAGING_URL,
      }),
      "ready",
    );
  });

  it("uses the arguments it is given when the process environment disagrees", () => {
    const previousEnv = process.env.VERCEL_ENV;
    const previousAllow = process.env.LOLO_ALLOW_PREVIEW_DB_URL;
    process.env.VERCEL_ENV = "production";
    process.env.LOLO_ALLOW_PREVIEW_DB_URL = STAGING_URL;
    try {
      assert.equal(
        databaseAccess({
          vercelEnv: "preview",
          supabaseUrl: PRODUCTION_URL,
          serviceRoleKey: SERVICE_KEY,
          allowPreviewDbUrl: PRODUCTION_URL,
        }),
        "disconnected",
      );
    } finally {
      if (previousEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousEnv;
      if (previousAllow === undefined) delete process.env.LOLO_ALLOW_PREVIEW_DB_URL;
      else process.env.LOLO_ALLOW_PREVIEW_DB_URL = previousAllow;
    }
  });
});

describe("health check", () => {
  it("does not call the probe when the database is not available", async () => {
    let calls = 0;
    const started = Date.now();
    const disconnected = await runHealthCheck({
      access: "disconnected",
      probe: async () => {
        calls += 1;
      },
    });
    const missing = await runHealthCheck({
      access: "not_configured",
      probe: async () => {
        calls += 1;
      },
    });
    assert.equal(calls, 0);
    assert.ok(Date.now() - started < 200);
    assert.equal(disconnected.components.database.status, "disconnected");
    assert.equal(disconnected.components.database.latencyMs, undefined);
    assert.equal(missing.components.database.status, "not_configured");
    assert.equal(healthHttpStatus(disconnected), 503);
    assert.equal(healthHttpStatus(missing), 503);
    assert.equal(disconnected.components.app.status, "ok");
  });

  it("returns 200 when the probe succeeds", async () => {
    const report = await runHealthCheck({
      access: "ready",
      probe: async () => undefined,
    });
    assert.equal(report.status, "ok");
    assert.equal(report.components.database.status, "ok");
    assert.equal(typeof report.components.database.latencyMs, "number");
    assert.equal(healthHttpStatus(report), 200);
  });

  it("fails closed when a ready check has no probe", async () => {
    const report = await runHealthCheck({ access: "ready" });
    assert.equal(report.components.database.status, "error");
    assert.equal(healthHttpStatus(report), 503);
  });

  it("times out a probe that never settles and aborts it", async () => {
    let aborted = false;
    const started = Date.now();
    const report = await runHealthCheck({
      access: "ready",
      timeoutMs: 40,
      probe: (signal) =>
        new Promise(() => {
          signal.addEventListener("abort", () => {
            aborted = true;
          });
        }),
    });
    assert.equal(report.components.database.status, "timeout");
    assert.equal(report.status, "unavailable");
    assert.equal(healthHttpStatus(report), 503);
    assert.equal(aborted, true);
    assert.ok(Date.now() - started < 1000);
    assert.equal(HEALTH_TIMEOUT_MS, 3000);
  });

  it("omits dependency errors and secrets from the report", async () => {
    const hostname = "db.internal.example";
    const databaseUrl = `https://${hostname}/rest/v1/events`;
    const serviceKey = "super-secret-service-role";
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.health-token";
    const envValue = "SUPABASE_SERVICE_ROLE_KEY=service-role-env-value";
    const stack = `Error: connect ECONNREFUSED ${databaseUrl}\n    at probeSupabaseRest (lib/health/database-probe.ts:29:11)`;
    const report = await runHealthCheck({
      access: "ready",
      probe: async () => {
        const error = new Error(
          `connect failed ${databaseUrl} ${serviceKey} ${token} ${envValue}`,
        );
        error.stack = stack;
        throw error;
      },
    });
    const body = JSON.stringify(report);
    for (const secret of [
      hostname,
      databaseUrl,
      serviceKey,
      token,
      envValue,
      "SUPABASE_SERVICE_ROLE_KEY",
      "ECONNREFUSED",
      "probeSupabaseRest",
      "database-probe.ts",
      "connect failed",
      PRODUCTION_PROJECT_REF,
    ]) {
      assert.equal(body.includes(secret), false, secret);
    }
    assert.equal(report.components.database.status, "error");
    assert.deepEqual(Object.keys(report).sort(), ["components", "status"]);
    assert.deepEqual(Object.keys(report.components).sort(), ["app", "database"]);
    assert.deepEqual(Object.keys(report.components.app), ["status"]);
    assert.deepEqual(Object.keys(report.components.database).sort(), [
      "latencyMs",
      "status",
    ]);
    assert.equal(
      ["ok", "not_configured", "disconnected", "timeout", "error"].includes(
        report.components.database.status,
      ),
      true,
    );
  });

  it("does not connect when credentials are missing", async () => {
    const access = databaseAccess({
      vercelEnv: "production",
      supabaseUrl: undefined,
      serviceRoleKey: undefined,
    });
    assert.equal(access, "not_configured");
    let calls = 0;
    const report = await runHealthCheck({
      access,
      timeoutMs: HEALTH_TIMEOUT_MS,
      probe: async () => {
        calls += 1;
        throw new Error("probe must not run");
      },
    });
    assert.equal(calls, 0);
    assert.equal(report.components.database.status, "not_configured");
    assert.equal(report.components.database.latencyMs, undefined);
    assert.equal(healthHttpStatus(report), 503);
    assert.equal(JSON.stringify(report).includes("probe must not run"), false);
  });
});

describe("database probe", () => {
  it("builds a REST read that does not carry the key in the URL", () => {
    const url = databaseProbeUrl(`${PRODUCTION_URL}/rest/v1/`);
    assert.equal(url.origin, PRODUCTION_URL);
    assert.equal(url.pathname, "/rest/v1/events");
    assert.equal(url.searchParams.get("select"), "id");
    assert.equal(url.searchParams.get("limit"), "1");
    assert.equal(url.href.includes("auth/v1"), false);
    assert.equal(url.href.includes(SERVICE_KEY), false);
  });

  it("accepts a small JSON read and drops the row payload", async () => {
    const seen: string[] = [];
    const server = http.createServer((request, response) => {
      seen.push(`${request.method} ${request.url}`);
      assert.equal(request.headers.authorization, `Bearer ${SERVICE_KEY}`);
      assert.equal(request.headers.apikey, SERVICE_KEY);
      assert.equal(request.url?.includes(SERVICE_KEY), false);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify([{ id: "row-must-not-leak" }]));
    });
    await listen(server);
    try {
      const port = (server.address() as AddressInfo).port;
      await probeSupabaseRest({
        supabaseUrl: `http://127.0.0.1:${port}`,
        serviceRoleKey: SERVICE_KEY,
        signal: AbortSignal.timeout(1000),
      });
      const report = await runHealthCheck({
        access: "ready",
        probe: (signal) =>
          probeSupabaseRest({
            supabaseUrl: `http://127.0.0.1:${port}`,
            serviceRoleKey: SERVICE_KEY,
            signal,
          }),
      });
      const body = JSON.stringify(report);
      assert.equal(report.status, "ok");
      assert.equal(body.includes("row-must-not-leak"), false);
      assert.equal(body.includes(SERVICE_KEY), false);
      assert.equal(seen.length, 2);
      assert.equal(seen[0]?.startsWith("GET /rest/v1/events?"), true);
    } finally {
      await closeServer(server);
    }
  });

  it("does not follow a redirect with the service-role key", async () => {
    let hits = 0;
    const server = http.createServer((request, response) => {
      hits += 1;
      const port = (server.address() as AddressInfo).port;
      assert.equal(request.url?.includes(SERVICE_KEY), false);
      response.writeHead(302, {
        location: `http://127.0.0.1:${port}/stolen`,
      });
      response.end("redirect-body-must-not-leak");
    });
    await listen(server);
    try {
      const port = (server.address() as AddressInfo).port;
      const report = await runHealthCheck({
        access: "ready",
        probe: (signal) =>
          probeSupabaseRest({
            supabaseUrl: `http://127.0.0.1:${port}`,
            serviceRoleKey: SERVICE_KEY,
            signal,
          }),
      });
      const body = JSON.stringify(report);
      assert.equal(report.components.database.status, "error");
      assert.equal(hits, 1);
      assert.equal(body.includes("stolen"), false);
      assert.equal(body.includes("redirect-body"), false);
      assert.equal(body.includes(SERVICE_KEY), false);
    } finally {
      await closeServer(server);
    }
  });

  it("aborts a socket that never answers", async () => {
    const server = http.createServer(() => {
      // Leave the socket open so the probe has to abort.
    });
    await listen(server);
    const started = Date.now();
    try {
      const port = (server.address() as AddressInfo).port;
      const report = await runHealthCheck({
        access: "ready",
        timeoutMs: 80,
        probe: (signal) =>
          probeSupabaseRest({
            supabaseUrl: `http://127.0.0.1:${port}`,
            serviceRoleKey: SERVICE_KEY,
            signal,
          }),
      });
      assert.equal(report.components.database.status, "timeout");
      assert.equal(healthHttpStatus(report), 503);
      assert.ok(Date.now() - started < 1000);
      assert.equal(JSON.stringify(report).includes(SERVICE_KEY), false);
    } finally {
      await closeServer(server);
    }
  });
});

function listen(server: http.Server) {
  return new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function closeServer(server: http.Server) {
  server.closeAllConnections();
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
