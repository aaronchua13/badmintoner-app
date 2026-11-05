import { test, expect } from "@playwright/test";
import { instrumentPerformance } from "./helpers/performance-browser";
import { performanceFixture } from "./helpers/performance-fixture";

for (const size of [20, 100, "stress"] as const) {
  test(`tablet responsiveness (${size})`, async ({ page }, testInfo) => {
    const fixture = performanceFixture(size === "stress" ? 100 : size, size === "stress" ? 500 : 40, size === "stress" ? 1000 : 100);
    if (!testInfo.project.name) await page.setViewportSize({ width: 1024, height: 1366 });
    await instrumentPerformance(page, fixture);
    await page.route("**/api/ping", (route) => route.fulfill({ status: 200, body: "ok" }));
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await page.waitForTimeout(350);
    const idleBefore = await page.evaluate(() => ({ ...window.queuePerf }));
    await page.waitForTimeout(3100);
    const idleAfter = await page.evaluate(() => ({ ...window.queuePerf }));
    if (!process.env.PERF_BASELINE) {
      expect(idleBefore.renders.QueuingClient).toBeGreaterThan(0);
      expect(idleAfter.renders.QueuingClient).toBe(idleBefore.renders.QueuingClient);
      for (const name of ["SessionSummaryModalContent", "HistoryModalContent", "PlayersDatabaseModalContent"])
        expect(idleAfter.renders[name] ?? 0).toBe(0);
    }
    const search = page.getByRole("textbox", { name: "Search players", exact: true });
    await search.pressSequentially("Player 020", { delay: 80 });
    await expect(page.getByTestId("player-row")).toHaveCount(1);
    await search.fill("");
    await expect(page.getByTestId("player-row")).toHaveCount(size === "stress" ? 100 : size);
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByRole("combobox", { name: "Filter gender" }).press("ArrowDown");
    await page.getByRole("combobox", { name: "Filter gender" }).press("End");
    await page.getByRole("combobox", { name: "Filter gender" }).press("Enter");
    await page.getByRole("combobox", { name: "Filter levels" }).press("ArrowDown");
    await page.locator(".ant-select-item-option:visible").filter({ hasText: /^Beginner$/ }).click();
    await page.getByRole("combobox", { name: "Filter levels" }).press("Escape");
    await expect(page.getByTestId("player-row")).toHaveCount((size === "stress" ? 100 : size) / 2);
    await page.getByRole("button", { name: /Filters/ }).click();
    await page.getByRole("button", { name: "Add Player", exact: true }).click();
    const add = page.getByRole("dialog", { name: "Add New Player" });
    await expect(add).toBeVisible();
    await add.getByLabel("Player Name").pressSequentially("Tablet player", { delay: 80 });
    await add.getByRole("button", { name: "Cancel", exact: true }).click();
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Player Database", exact: true }).click();
      const database = page.getByRole("dialog");
      await expect(database).toBeVisible();
      await database.getByRole("button", { name: "Close", exact: true }).first().click();
      await expect(database).not.toBeVisible();
    }
    await page.getByRole("button", { name: "Summary", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).first().click();
    await page.waitForTimeout(350);
    const samples = await page.evaluate(() => window.queuePerf);
    const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1] ?? 0;
    const report = {
      size, project: testInfo.project.name,
      inputPaintP95: p95(samples.input), clickPaintP95: p95(samples.click), storageP95: p95(samples.storage),
      idleCommits: idleAfter.commits - idleBefore.commits,
      idleRenderedFibers: idleAfter.renderedFibers - idleBefore.renderedFibers,
      idleMutations: idleAfter.mutations - idleBefore.mutations,
      idleShellRenders: process.env.PERF_BASELINE ? null : idleAfter.renders.QueuingClient - idleBefore.renders.QueuingClient,
      phases: await page.evaluate(() => performance.getEntriesByType("measure").filter((e) => e.name.startsWith("queue:")).map((e) => ({ phase: e.name, duration: e.duration }))),
    };
    console.log(JSON.stringify(report));
    await testInfo.attach("performance", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
    if (process.env.PERF_ENFORCE) {
      expect(report.inputPaintP95).toBeLessThan(100);
      expect(report.clickPaintP95).toBeLessThan(200);
    }
  });
}
