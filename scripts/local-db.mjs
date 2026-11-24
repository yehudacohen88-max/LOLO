// Starts and loads the local Supabase Docker stack.
// Never passes --remote. Refuses a database host that is not loopback and
// refuses any environment value that contains the Production project ref.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_SUPABASE_REF, profiles, skippedSql } from "./local-db-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
const REMOTE_ENV = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DIRECT_URL",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assertArgvIsLocal(argv) {
  for (const arg of argv) {
    const lower = arg.toLowerCase();
    if (lower === "--remote" || lower.startsWith("--remote=") || lower.includes(PRODUCTION_SUPABASE_REF)) {
      fail("This script only talks to the local Docker database.");
    }
  }
}

function assertNoProductionEnv(env) {
  const hits = [];
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.toLowerCase().includes(PRODUCTION_SUPABASE_REF)) {
      hits.push(key);
    }
  }
  if (hits.length > 0) {
    fail(
      `Refusing to run. Environment contains the Production Supabase project ref in: ${hits.join(", ")}`,
    );
  }
}

function childEnv(base) {
  const env = { ...base };
  for (const key of REMOTE_ENV) {
    delete env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.toLowerCase().includes(PRODUCTION_SUPABASE_REF)) {
      delete env[key];
    }
  }
  return env;
}

function run(args, { capture = false } = {}) {
  const result = spawnSync("supabase", args, {
    cwd: root,
    env: childEnv(process.env),
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      fail("The Supabase CLI is not on PATH. CI installs version 3.3.0. Local Docker is the only target.");
    }
    fail(result.error.message);
  }
  if (result.status !== 0) {
    if (capture && result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status || 1);
  }
  return result.stdout ?? "";
}

function requireDocker() {
  const result = spawnSync("docker", ["info"], { encoding: "utf8", stdio: "ignore" });
  if (result.error || result.status !== 0) {
    fail("Docker is not available. The local Supabase stack needs Docker. This command does not contact Production.");
  }
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function readStatus() {
  return parseEnv(run(["status", "-o", "env"], { capture: true }));
}

function hostnameOf(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function assertLocalStatus(statusEnv) {
  const apiHost = hostnameOf(statusEnv.API_URL ?? "");
  const dbHost = hostnameOf(statusEnv.DB_URL ?? "");
  const blob = `${statusEnv.API_URL ?? ""}\n${statusEnv.DB_URL ?? ""}`.toLowerCase();
  if (blob.includes(PRODUCTION_SUPABASE_REF) || !LOOPBACK.has(apiHost) || !LOOPBACK.has(dbHost)) {
    fail("Refusing to run SQL. Supabase status is not a loopback database.");
  }
}

function readProfile(argv, fallback) {
  const index = argv.indexOf("--profile");
  const value = index === -1 ? fallback : argv[index + 1];
  if (!value || !Object.hasOwn(profiles, value)) {
    fail("Profile must be ci, full, or seed.");
  }
  return value;
}

function dbContainer() {
  const result = spawnSync("docker", ["ps", "--format", "{{.Names}}\t{{.Image}}"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail("Could not list Docker containers for the local Supabase database.");
  }
  const names = (result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => {
      const [name, image] = line.split("\t");
      return { name: (name ?? "").trim(), image: image ?? "" };
    })
    .filter((row) => row.name.startsWith("supabase_db_") && /supabase\/postgres/.test(row.image))
    .map((row) => row.name);
  const container = names.find((name) => name === "supabase_db_lolo") ?? names[0];
  if (!container || !/^supabase_db_[A-Za-z0-9_.-]+$/.test(container)) {
    fail("Could not find the local Supabase database container.");
  }
  return container;
}

function applyFile(absolute) {
  // `supabase db query` sends the file as one prepared statement and rejects
  // the multi-statement SQL files in this repo. psql inside the local
  // database container runs the whole file. The container is the loopback
  // stack only; this does not take a remote URL.
  const container = dbContainer();
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "-e",
      "PGCLIENTENCODING=UTF8",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: readFileSync(absolute) },
  );
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status || 1);
  }
}

function applyProfile(name) {
  const files = profiles[name];
  assertNoProductionEnv(process.env);
  const status = readStatus();
  assertLocalStatus(status);
  for (const file of files) {
    if (Object.hasOwn(skippedSql, file)) {
      fail(`Refusing to apply skipped file ${file}`);
    }
    const absolute = path.join(root, file);
    if (!absolute.startsWith(`${root}${path.sep}`) || !existsSync(absolute)) {
      fail(`Missing SQL file ${file}`);
    }
    console.error(`Applying ${file}`);
    applyFile(absolute);
  }
  console.error(`Applied local profile ${name} to the loopback database.`);
}

function schemaState() {
  const sql =
    "select case when to_regclass('public.events') is null then 'lolo_schema_missing' else 'lolo_schema_present' end as state;";
  assertNoProductionEnv(process.env);
  assertLocalStatus(readStatus());
  const stdout = run(["db", "query", sql], { capture: true });
  if (stdout.includes("lolo_schema_present")) {
    return "present";
  }
  if (stdout.includes("lolo_schema_missing")) {
    return "missing";
  }
  fail("Could not tell whether the local schema is already applied.");
}

function start(argv) {
  assertNoProductionEnv(process.env);
  requireDocker();
  const profile = readProfile(argv, "ci");
  run(["start"]);
  if (schemaState() === "present") {
    console.error("Local schema is already applied. Use npm run db:reset to rebuild it.");
  } else {
    applyProfile(profile);
  }
  console.error("Loopback API is up. Export local demo keys with: node scripts/local-db.mjs export-env");
}

function reset() {
  assertNoProductionEnv(process.env);
  requireDocker();
  run(["start"]);
  run(["db", "reset", "--no-seed"]);
  applyProfile("full");
}

function seed() {
  assertNoProductionEnv(process.env);
  requireDocker();
  if (schemaState() !== "present") {
    fail("Local schema is missing. Run npm run db:reset before npm run db:seed.");
  }
  applyProfile("seed");
}

function exportEnv() {
  assertNoProductionEnv(process.env);
  const status = readStatus();
  assertLocalStatus(status);
  const api = status.API_URL ?? "";
  const anonName = status.ANON_KEY ? "ANON_KEY" : "PUBLISHABLE_KEY";
  const serviceName = status.SERVICE_ROLE_KEY ? "SERVICE_ROLE_KEY" : "SECRET_KEY";
  const anon = status[anonName] ?? "";
  const service = status[serviceName] ?? "";
  if (!api || !anon || !service) {
    fail("Local status did not include a loopback API URL and local API keys.");
  }
  process.stdout.write(
    `NEXT_PUBLIC_SUPABASE_URL=${api}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service}\n`,
  );
  console.error(`Wrote local loopback Supabase variables to stdout (${anonName}, ${serviceName}).`);
}

const argv = process.argv.slice(2);
assertArgvIsLocal(argv);
const command = argv[0];

if (command === "start") {
  start(argv);
} else if (command === "reset") {
  reset();
} else if (command === "seed") {
  seed();
} else if (command === "apply") {
  assertNoProductionEnv(process.env);
  requireDocker();
  applyProfile(readProfile(argv, ""));
} else if (command === "export-env") {
  exportEnv();
} else {
  fail("Usage: node scripts/local-db.mjs <start|reset|seed|apply|export-env> [--profile ci|full|seed]");
}
