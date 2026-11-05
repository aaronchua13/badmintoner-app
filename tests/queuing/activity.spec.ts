import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

async function ready(page: Page) {
  await page.goto("/queuing");
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
}
async function openLogs(page: Page, name = "Player 1") {
  const row = page.getByTestId("player-row").filter({ has: page.getByText(name, { exact: true }) });
  await row.getByRole("button", { name: `Options for ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Player details", exact: true }).click();
  const modal = page.getByRole("dialog", { name: new RegExp(name) });
  await modal.getByRole("tab", { name: /Player Logs/ }).click();
  return modal;
}
for (const mobile of [false, true]) {
  test(`player logs persist, paginate, isolate players and update across tabs (${mobile ? "mobile" : "desktop"})`, async ({ page, context }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    let s = initialSession(Date.now());
    for (let i = 0; i < 2; i++) {
      s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i + 1}`, level: "Intermediate", gender: "Male" } }, Date.now());
      s = transition(s, { type: "checkInPlayer", id: `p${i}` }, Date.now());
    }
    for (let i = 0; i < 12; i++) s = transition(s, { type: "togglePlayerActive", id: "p0" }, Date.now());
    await context.addInitScript((s) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify(s)), s);
    await ready(page);
    let modal = await openLogs(page);
    await expect(modal.getByTestId("player-log-entry")).toHaveCount(10);
    await expect(modal.getByTestId("player-log-entry").first()).toContainText("Marked available");
    await expect(modal.getByTestId("player-log-entry").first().locator("time")).toHaveAttribute("datetime", /T.*Z$/);
    await expect(modal.getByRole("tab", { name: "Player Logs (14)", exact: true })).toBeVisible();
    await modal.locator(".ant-pagination-next button").click();
    await expect(modal.getByTestId("player-log-entry")).toHaveCount(4);
    await expect(modal.getByTestId("player-log-entry").last()).toContainText("Added to the session roster");
    await modal.getByRole("button", { name: "Close", exact: true }).click();
    modal = await openLogs(page, "Player 2");
    await expect(modal.getByTestId("player-log-entry")).toHaveCount(2);
    await expect(modal.getByRole("tab", { name: "Player Logs (2)", exact: true })).toBeVisible();
    await modal.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    modal = await openLogs(page);
    await expect(modal.getByRole("tab", { name: "Player Logs (14)", exact: true })).toBeVisible();
    const other = await context.newPage();
    await ready(other);
    const otherRow = other.getByTestId("player-row").filter({ has: other.getByText("Player 1", { exact: true }) });
    await otherRow.getByRole("button", { name: "Options for Player 1", exact: true }).click();
    await other.getByRole("menuitem", { name: "Mark away", exact: true }).click();
    await expect(modal.getByRole("tab", { name: "Player Logs (15)", exact: true })).toBeVisible();
    await expect(modal.getByTestId("player-log-entry").first()).toContainText("Marked away");
    await expect(modal.getByTestId("player-log-entry").first()).toBeInViewport();
    await other.close();
  });
}

test("legacy sessions start with empty logs; exports and replacement imports retain recorded activity", async ({ page }) => {
  let s = initialSession(Date.now());
  s = transition(s, { type: "addPlayer", id: "p0", values: { name: "Player 1", level: "Beginner", gender: "Male" } }, Date.now());
  const legacy = { ...s, schemaVersion: 3, playerLogs: undefined };
  await page.addInitScript((data) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify(data)), legacy);
  await ready(page);
  let modal = await openLogs(page);
  await expect(modal.getByText("No activity recorded for this player yet", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("player-row").getByRole("button", { name: "Check in", exact: true }).click();
  modal = await openLogs(page);
  await expect(modal.getByTestId("player-log-entry")).toHaveCount(1);
  await expect(modal.getByTestId("player-log-entry")).toContainText("Checked in");
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Session menu" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export session", exact: true }).click();
  const path = await (await downloaded).path();
  const exported = JSON.parse(await readFile(path!, "utf8"));
  expect(exported.schemaVersion).toBe(4);
  expect(exported.playerLogs).toHaveLength(1);
  expect(exported.playerLogs[0].message).toBe("Checked in");
  await page.getByRole("button", { name: "Session menu" }).click();
  await page.getByRole("menuitem", { name: "Reset session", exact: true }).click();
  await page.getByRole("dialog", { name: "Reset this session?", exact: true }).getByRole("button", { name: "Reset session", exact: true }).click();
  await expect(page.getByTestId("player-row")).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles({ name: "session.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
  await page.getByRole("dialog", { name: "Replace the current session?", exact: true }).getByRole("button", { name: "Replace session", exact: true }).click();
  await expect(page.getByTestId("player-row")).toHaveCount(1);
  modal = await openLogs(page);
  await expect(modal.getByTestId("player-log-entry")).toHaveCount(1);
  await expect(modal.getByTestId("player-log-entry")).toContainText("Checked in");
});
