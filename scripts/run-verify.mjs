import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const names = Object.keys(pkg.scripts)
  .filter((name) => name.startsWith("verify:"))
  .sort();

if (names.length === 0) {
  console.error("No verify:* scripts in package.json");
  process.exit(1);
}

for (const name of names) {
  console.error(`\n# npm run ${name}`);
  const result = spawnSync("npm", ["run", name], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
