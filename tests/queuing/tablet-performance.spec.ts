import { test, expect, type Page } from "@playwright/test";
import { performanceFixture } from "./helpers/performance-fixture";
import { instrumentPerformance } from "./helpers/performance-browser";

async function ready(page: Page) {
  await page.goto("/queuing");
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
}

test("tablet saves, restores search focus, navigates, finishes matches, and keeps dialog drafts", async ({ page }, testInfo) => {
  await instrumentPerformance(page, performanceFixture(100, 500, 1000));
  await page.route("**/api/ping", (route) => route.fulfill({ status: 200, body: "ok" }));
  await ready(page);
  const search = page.getByRole("textbox", { name: "Search players", exact: true });
  await search.fill("Player 100");
  await page.getByTestId("player-row").getByRole("button", { name: "Check in", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await search.fill("Player 009");
  await page.getByTestId("player-row").getByRole("button", { name: "Queue", exact: true }).click();
  const queue = page.getByRole("dialog", { name: "Assign to Queue" });
  const createQueue = queue.getByRole("button", { name: "Create Queue", exact: true });
  // WebKit may report a button stable at the first scaled frame of the modal animation.
  await expect.poll(async () => (await createQueue.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(32);
  await createQueue.click();
  await queue.getByRole("button", { name: "Add to Queue", exact: true }).click();
  await expect(queue).not.toBeVisible();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  const court = page.getByRole("article", { name: "Court 1", exact: true });
  await court.getByRole("button", { name: "Finish Match", exact: true }).click();
  const finish = page.getByRole("dialog", { name: "Finish Match", exact: true });
  await finish.getByRole("spinbutton").nth(0).fill("21");
  await finish.getByRole("spinbutton").nth(1).fill("0");
  await finish.getByRole("button", { name: "OK", exact: true }).click();
  await expect(finish).not.toBeVisible();
  await expect(court.getByRole("button", { name: "Finish Match", exact: true })).toHaveCount(0);
  // Exercise the tablet-only panel navigation breakpoint in both orientations.
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.getByText("Courts (2)", { exact: true }).click();
  await expect(court).toBeVisible();
  await page.getByText("Queue (2)", { exact: true }).click();
  await page.setViewportSize(originalViewport);
  await page.getByRole("button", { name: "Player Database", exact: true }).click();
  const database = page.getByRole("dialog", { name: "Players Database", exact: true });
  await expect(database).toBeVisible();
  const databaseSearch = database.getByRole("textbox", { name: "Search saved players" });
  await databaseSearch.fill("Saved Player 1000");
  await expect(database.getByRole("checkbox")).toHaveCount(1);
  await database.getByRole("checkbox").check();
  await database.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(database).not.toBeVisible();
  await expect(page.locator('[aria-label="Search saved players"]')).toHaveCount(0);
  const closedRenders = await page.evaluate(() => ({ ...window.queuePerf.renders }));
  await page.waitForTimeout(2100);
  expect(await page.evaluate(() => window.queuePerf.renders.PlayersDatabaseModalContent))
    .toBe(closedRenders.PlayersDatabaseModalContent);
  await page.getByRole("button", { name: "Player Database", exact: true }).click();
  await expect(databaseSearch).toHaveValue("Saved Player 1000");
  await expect(database.getByRole("checkbox")).toBeChecked();
  await databaseSearch.fill("");
  await expect(database.getByRole("checkbox")).toHaveCount(1000, { timeout: 15000 });
  await database.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(database).not.toBeVisible();
  const phases = await page.evaluate(() => performance.getEntriesByType("measure").filter((e) => e.name.startsWith("queue:")).map((e) => ({ phase: e.name, duration: e.duration })));
  await testInfo.attach("storage-phases", { body: JSON.stringify(phases, null, 2), contentType: "application/json" });
  expect(phases.filter((e) => e.phase === "queue:validate-input")).toHaveLength(phases.filter((e) => e.phase === "queue:read").length);
  expect(phases.filter((e) => e.phase === "queue:validate-output")).toHaveLength(4);
  await page.reload();
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
  await search.fill("Player 100");
  await expect(page.getByTestId("player-row")).toHaveAttribute("data-player-status", "waiting");
  await search.fill("Player 009");
  await expect(page.getByTestId("player-row")).toHaveAttribute("data-player-status", "queued");
});
