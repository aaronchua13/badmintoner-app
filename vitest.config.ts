import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/queuing/**/*.test.ts"], environment: "node" },
});
