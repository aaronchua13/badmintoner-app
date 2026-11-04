import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export default defineConfig({
  testDir: "./tests/queuing",
  testMatch: "**/*.spec.ts",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:2100",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: existsSync(chrome) ? chrome : undefined },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next start -p 2100",
    url: "http://127.0.0.1:2100/queuing",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
