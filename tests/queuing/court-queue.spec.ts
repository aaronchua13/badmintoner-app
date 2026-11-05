import { expect, test } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

function fixture() {
  let s = initialSession(Date.now());
  for (let i = 0; i < 8; i++) {
    s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i + 1}`, gender: "Male", level: "Intermediate" } }, Date.now());
    s = transition(s, { type: "checkInPlayer", id: `p${i}` }, Date.now());
  }
  s = transition(s, { type: "startSession" }, Date.now());
  s = transition(s, { type: "createQueueItem", id: "q1" }, Date.now());
  for (let i = 0; i < 8; i++) {
    s = transition(s, i < 4
      ? { type: "togglePlayerSelection", courtId: "c1", playerId: `p${i}`, selected: true }
      : { type: "addPlayerToQueueItem", queueId: "q1", playerId: `p${i}` }, Date.now());
  }
  return s;
}
for (const mobile of [false, true]) {
  test(`return staged lineup and assign replacement (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((data) => {
      if (!localStorage.getItem("badminton_queue_data_v2")) localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data }));
    }, fixture());
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device")).toBeVisible();
    const showCourts = async () => {
      if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Courts/ }).click();
    };
    await showCourts();
    const court = page.getByRole("article", { name: "Court 1", exact: true });
    await court.getByRole("button", { name: "Options for Court 1" }).click();
    await page.getByRole("menuitem", { name: "Move all to queue" }).click();
    let confirm = page.getByRole("dialog", { name: /Move all players/ });
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(court.getByText("Player 1", { exact: true })).toBeVisible();
    await court.getByRole("button", { name: "Options for Court 1" }).click();
    await page.getByRole("menuitem", { name: "Move all to queue" }).click();
    confirm = page.getByRole("dialog", { name: /Move all players/ });
    await confirm.getByRole("button", { name: "Move all to queue", exact: true }).click();
    await court.getByRole("button", { name: "Assign from queue", exact: true }).click();
    const picker = page.getByRole("dialog", { name: /Assign from queue/ });
    await expect(picker.getByText("Team 1: Player 1, Player 2", { exact: true })).toBeVisible();
    await picker.getByRole("button", { name: "Assign match 1", exact: true }).click();
    await expect(court.getByText("Player 5", { exact: true })).toBeVisible();
    await expect(court.getByText("Ready", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Saved on this device")).toBeVisible();
    await showCourts();
    await expect(court.getByText("Player 5", { exact: true })).toBeVisible();
    await court.getByRole("button", { name: "Start Match", exact: true }).click();
    await expect(court.getByText("Playing", { exact: true })).toBeVisible();
    await court.getByRole("button", { name: "Options for Court 1" }).click();
    await expect(page.getByRole("menuitem", { name: "Move all to queue" })).toHaveAttribute("aria-disabled", "true");
  });
}

test("queue picker explains unavailable players", async ({ page }) => {
  let data = fixture();
  data = transition(data, { type: "clearCourt", id: "c1" }, Date.now());
  data = transition(data, { type: "assignQueueToCourt", queueId: "q1", courtId: "c2" }, Date.now());
  data = transition(data, { type: "startMatch", courtId: "c2" }, Date.now());
  data = transition(data, { type: "createQueueItem", id: "booked" }, Date.now());
  data = transition(data, { type: "addPlayerToQueueItem", queueId: "booked", playerId: "p4" }, Date.now());
  await page.addInitScript((data) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data })), data);
  await page.goto("/queuing");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.getByRole("article", { name: "Court 1", exact: true }).getByRole("button", { name: "Assign from queue" }).click();
  const picker = page.getByRole("dialog", { name: /Assign from queue/ });
  await expect(picker.getByText(/Unavailable: Player 5/)).toBeVisible();
  await expect(picker.getByRole("button", { name: "Assign match 1" })).toBeDisabled();
});
