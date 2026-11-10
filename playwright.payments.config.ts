import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import base from "./playwright.config";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir = process.env.PAYMENT_AUDIT_OUTPUT ?? "test-results/payment-audit";
export default defineConfig({
  ...base,
  testMatch: "**/payment-audit/*.spec.ts",
  outputDir,
  reporter: [["list"], ["json", { outputFile: `${outputDir}/results.json` }]],
  retries: 0,
  grep: process.env.PAYMENT_AUDIT_DEFECTS === "1" ? /@regression/ : undefined,
  use: { ...base.use, launchOptions: {}, locale: "en-PH", timezoneId: "Asia/Manila", serviceWorkers: "block" },
  projects: [
    { name: "chrome-desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath: existsSync(chrome) ? chrome : undefined } } },
    ...(["chromium", "webkit"] as const).flatMap((browserName) => [
      { name: `${browserName}-phone`, use: { browserName, launchOptions: browserName === "chromium" && existsSync(chrome) ? { executablePath: chrome } : {}, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
      { name: `${browserName}-ipad-portrait`, use: { browserName, launchOptions: browserName === "chromium" && existsSync(chrome) ? { executablePath: chrome } : {}, viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
      { name: `${browserName}-ipad-landscape`, use: { browserName, launchOptions: browserName === "chromium" && existsSync(chrome) ? { executablePath: chrome } : {}, viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    ]),
  ],
});
