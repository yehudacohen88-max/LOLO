import fs from "node:fs";
import { PRODUCTION_SUPABASE_REF } from "./local-db-order.mjs";

const workflowPath = new URL("../.github/workflows/ci.yml", import.meta.url);
const workflow = fs.readFileSync(workflowPath, "utf8");

const failures = [];

if (/\$\{\{\s*secrets[.\[]/.test(workflow) || /\bsecrets\.[A-Za-z0-9_]+/.test(workflow)) {
  failures.push("CI workflow references GitHub Actions secrets");
}

if (workflow.toLowerCase().includes(PRODUCTION_SUPABASE_REF)) {
  failures.push("CI workflow file contains the Production Supabase project ref");
}

if (/--remote\b/.test(workflow) || /supabase\.co/i.test(workflow)) {
  failures.push("CI workflow points at a hosted Supabase database");
}

const hits = [];
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === "string" && value.toLowerCase().includes(PRODUCTION_SUPABASE_REF)) {
    hits.push(key);
  }
}

if (hits.length > 0) {
  failures.push(
    `environment contains the Production Supabase project ref in: ${hits.join(", ")}`,
  );
}

if (failures.length > 0) {
  console.error("Refusing to run.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.error("Production Supabase project ref is absent from the environment and the CI workflow.");
