// Starts Next.js against the local Docker Supabase only.
// Refuses a Supabase URL that is not loopback and refuses the Production
// project ref anywhere in the environment. Does not read or write .env files.
// Does not contact a hosted project.

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_SUPABASE_REF } from "./local-db-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function hostnameOf(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function assertNoProductionRef(env) {
  const hits = [];
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.toLowerCase().includes(PRODUCTION_SUPABASE_REF)) {
      hits.push(key);
    }
  }
  if (hits.length > 0) {
    fail(
      `Refusing to start. Environment contains the Production Supabase project ref in: ${hits.join(", ")}`,
    );
  }
}

function assertLoopbackUrl(value, label) {
  const host = hostnameOf(value);
  if (
    !value ||
    value.toLowerCase().includes(PRODUCTION_SUPABASE_REF) ||
    !LOOPBACK.has(host)
  ) {
    fail(`Refusing to start. ${label} is not a loopback Supabase URL.`);
  }
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function exportLocalEnv() {
  const result = spawnSync(process.execPath, ["scripts/local-db.mjs", "export-env"], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
  });
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status || 1);
  }
  const out = {};
  for (const line of (result.stdout ?? "").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

function prepareDatabase() {
  assertNoProductionRef(process.env);
  const current = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (current) {
    assertLoopbackUrl(current, "NEXT_PUBLIC_SUPABASE_URL");
  }
  runNode(["scripts/local-db.mjs", "start", "--profile", "full"]);
  runNode(["scripts/local-db.mjs", "seed"]);
  runNode(["scripts/local-db.mjs", "apply-files", "scripts/local-demo-label.sql"]);
}

function appEnv(local) {
  assertLoopbackUrl(local.NEXT_PUBLIC_SUPABASE_URL, "The local Supabase API URL");
  const env = { ...process.env };
  for (const key of [
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "DIRECT_URL",
  ]) {
    delete env[key];
  }
  env.NEXT_PUBLIC_SUPABASE_URL = local.NEXT_PUBLIC_SUPABASE_URL;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  env.SUPABASE_SERVICE_ROLE_KEY = local.SUPABASE_SERVICE_ROLE_KEY;
  env.LOLO_LOCAL_DB = "1";
  env.PAYMENT_PROVIDER = "demo";
  env.BETA_ACCESS_ENABLED = "false";
  env.LEGAL_DRAFTS_ENABLED = "false";
  env.SETTLEMENTS_ENABLED = "1";
  env.PAYMENT_WEBHOOK_SECRET ||= "local-webhook-secret";
  env.HOST_SESSION_SECRET ||= "local-host-session-secret";
  env.INVITE_TOKEN_SECRET ||= "local-invite-token-secret";
  env.ADMIN_SESSION_SECRET ||= "local-admin-session-secret";
  env.STORE_SESSION_SECRET ||= "local-store-session-secret";
  env.IMAGE_UPLOAD_SECRET ||= "local-image-upload-secret";
  env.BETA_ACCESS_SECRET ||= "local-beta-secret";
  env.LOLO_ADMIN_PASSWORD ||= "local-demo-admin";
  assertNoProductionRef(env);
  return env;
}

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start" && mode !== "prepare") {
  fail("Usage: node scripts/dev-local.mjs <dev|start|prepare>");
}

prepareDatabase();
const local = exportLocalEnv();
const env = appEnv(local);

if (mode === "prepare") {
  console.error("Local database is ready. Next.js was not started.");
  process.exit(0);
}

const port = process.env.LOLO_LOCAL_PORT || "3000";
if (!/^\d+$/.test(port)) {
  fail("LOLO_LOCAL_PORT must be a port number.");
}

console.error(
  `Starting next ${mode} on 127.0.0.1:${port} with the loopback Supabase API. Beta gate is closed. Payments stay on the demo provider.`,
);

const child = spawn(
  "npm",
  ["run", mode === "start" ? "start" : "dev", "--", "--hostname", "127.0.0.1", "--port", port],
  { cwd: root, env, stdio: "inherit" },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
