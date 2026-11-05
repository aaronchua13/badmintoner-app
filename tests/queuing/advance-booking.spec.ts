import { expect, test } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

function fixture() {
  let s = initialSession(Date.now());
  for (let i = 0; i < 4; i++) {
    s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i + 1}`, gender: "Male", level: "Intermediate" } }, Date.now());
    s = transition(s, { type: "checkInPlayer", id: `p${i}` }, Date.now());
    s = transition(s, { type: "togglePlayerSelection", courtId: "c1", playerId: `p${i}`, selected: true }, Date.now());
  }
  s = transition(s, { type: "startSession" }, Date.now());
  s = transition(s, { type: "startMatch", courtId: "c1" }, Date.now());
  s = transition(s, { type: "createQueueItem", id: "q1" }, Date.now());
  for (let i = 1; i < 4; i++) s = transition(s, { type: "addPlayerToQueueItem", queueId: "q1", playerId: `p${i}` }, Date.now());
  return s;
}
for (const mobile of [false, true]) {
  test(`book while playing, persist, finish and manually assign (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((data) => {
      if (!localStorage.getItem("badminton_queue_data_v2")) localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data }));
    }, fixture());
    const view = async (name: RegExp) => {
      if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name }).click();
    };
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device")).toBeVisible();
    await view(/Players/);
    const row = page.getByTestId("player-row").filter({ has: page.getByRole("button", { name: /Player 1/ }) });
    await expect(row.getByRole("button", { name: "Court", exact: true })).toBeDisabled();
    await row.getByRole("button", { name: "Queue", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Assign to Queue" });
    await expect(dialog.getByText(/Advance booking:/)).toBeVisible();
    await dialog.getByRole("button").filter({ hasText: "Queue 1" }).click();
    await dialog.getByRole("button", { name: "Add to Queue", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row.getByText("Playing · Queued", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Queue", exact: true })).toBeDisabled();
    await page.reload();
    await view(/Queue/);
    const queue = page.getByRole("article", { name: "Queued match 1", exact: true });
    await expect(queue.getByText("Waiting for players", { exact: true })).toBeVisible();
    await expect(queue.getByRole("button", { name: "Assign to court" })).toBeDisabled();
    await view(/Courts/);
    const court = page.getByRole("article", { name: "Court 1", exact: true });
    await court.getByRole("button", { name: "Finish Match" }).click();
    const finish = page.getByRole("dialog", { name: "Finish Match", exact: true });
    await finish.getByText("Team 1", { exact: true }).click();
    await finish.getByRole("button", { name: "OK", exact: true }).click();
    await expect(finish).not.toBeVisible();
    await view(/Queue/);
    await expect(queue.getByText("Ready", { exact: true })).toBeVisible();
    await queue.getByRole("button", { name: "Assign to court" }).click();
    await page.getByRole("menuitem", { name: "Court 1", exact: true }).click();
    await expect(queue).not.toBeVisible();
    await view(/Courts/);
    await expect(court.getByRole("button", { name: "Start Match", exact: true })).toBeEnabled();
  });
}
