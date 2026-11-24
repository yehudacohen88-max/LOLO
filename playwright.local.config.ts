import { defineConfig } from "@playwright/test";

const port = process.env.LOLO_LOCAL_PORT || "3100";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e/local",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/dev-local.mjs dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      LOLO_LOCAL_PORT: port,
      BETA_ACCESS_ENABLED: "false",
      PAYMENT_PROVIDER: "demo",
    },
  },
});
