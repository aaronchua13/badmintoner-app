import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: ["**/performance.spec.ts", "**/tablet-performance.spec.ts"],
  use: { ...base.use, launchOptions: {}, browserName: "webkit", hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  projects: [
    { name: "webkit-tablet-portrait", use: { viewport: { width: 1024, height: 1366 } } },
    { name: "webkit-tablet-landscape", use: { viewport: { width: 1366, height: 1024 } } },
  ],
});
