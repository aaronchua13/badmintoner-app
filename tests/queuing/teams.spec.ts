import { expect, test } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

function fixture() {
  let s = initialSession(Date.now());
  for (let i = 0; i < 4; i++) {
    s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i + 1}`, gender: "Male", level: "Intermediate" } }, Date.now());
    s = transition(s, { type: "checkInPlayer", id: `p${i}` }, Date.now());
  }
  s = transition(s, { type: "startSession" }, Date.now());
  s = transition(s, { type: "createQueueItem", id: "q1" }, Date.now());
  for (let i = 0; i < 4; i++) s = transition(s, { type: "addPlayerToQueueItem", queueId: "q1", playerId: `p${i}` }, Date.now());
  return s;
}
for (const mobile of [false, true]) {
  test(`correct queue and running teams, cancel, persist and finish (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((data) => {
      if (!localStorage.getItem("badminton_queue_data_v2")) localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data }));
    }, fixture());
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device")).toBeVisible();
    if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Queue/ }).click();
    const queue = page.getByRole("article", { name: "Queued match 1", exact: true });
    await queue.getByRole("button", { name: "Change teams" }).click();
    let editor = page.getByRole("dialog", { name: /Change teams/ });
    await expect(editor.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await editor.getByRole("button", { name: "Team 1, slot 2: Player 2", exact: true }).click();
    await editor.getByRole("button", { name: "Team 2, slot 1: Player 3", exact: true }).click();
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    await queue.getByRole("button", { name: "Change teams" }).click();
    editor = page.getByRole("dialog", { name: /Change teams/ });
    const first = editor.getByRole("button", { name: "Team 1, slot 2: Player 2", exact: true });
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await editor.getByRole("button", { name: "Team 2, slot 1: Player 3", exact: true }).focus();
    await page.keyboard.press("Space");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(editor).not.toBeVisible();
    await page.reload();
    if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Queue/ }).click();
    await queue.getByRole("button", { name: "Change teams" }).click();
    editor = page.getByRole("dialog", { name: /Change teams/ });
    await expect(editor.getByRole("button", { name: "Team 1, slot 2: Player 3", exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    await queue.getByRole("button", { name: "Assign to court" }).click();
    await page.getByRole("menuitem", { name: "Court 1", exact: true }).click();
    if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Courts/ }).click();
    const court = page.getByRole("article", { name: "Court 1", exact: true });
    await court.getByRole("button", { name: "Start Match", exact: true }).click();
    await court.getByRole("button", { name: "Change teams" }).click();
    editor = page.getByRole("dialog", { name: /Change teams/ });
    await expect(editor.getByText("This corrects the teams for this game. The timer will keep running.")).toBeVisible();
    await editor.getByRole("button", { name: "Team 1, slot 1: Player 1", exact: true }).click();
    await editor.getByRole("button", { name: "Team 2, slot 2: Player 4", exact: true }).click();
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(editor).not.toBeVisible();
    await expect(court.getByText("Playing", { exact: true })).toBeVisible();
    await court.getByRole("button", { name: "Finish Match" }).click();
    const finish = page.getByRole("dialog", { name: "Finish Match", exact: true });
    await expect(finish.getByText("Team 1 (Player 4 & Player 3)", { exact: true })).toBeVisible();
    await finish.getByText("Team 1", { exact: true }).click();
    await finish.getByRole("button", { name: "OK", exact: true }).click();
    await expect(finish).not.toBeVisible();
    await expect(court.getByText("Playing", { exact: true })).not.toBeVisible();
  });
}

for (const mobile of [false, true]) {
  test(`replace from eligible waiting roster (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    let data = fixture();
    for (const id of ["Waiting", "Absent", "Away", "Assigned", "Queued"]) {
      data = transition(data, { type: "addPlayer", id, values: { name: id, gender: "Female", level: "Beginner" } }, Date.now());
      if (id !== "Absent") data = transition(data, { type: "checkInPlayer", id }, Date.now());
    }
    data = transition(data, { type: "togglePlayerActive", id: "Away" }, Date.now());
    data = transition(data, { type: "togglePlayerSelection", courtId: "c2", playerId: "Assigned", selected: true }, Date.now());
    data = transition(data, { type: "createQueueItem", id: "q2" }, Date.now());
    data = transition(data, { type: "addPlayerToQueueItem", queueId: "q2", playerId: "Queued" }, Date.now());
    await page.addInitScript((data) => {
      if (!localStorage.getItem("badminton_queue_data_v2")) localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data }));
    }, data);
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device")).toBeVisible();
    if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Queue/ }).click();
    const queue = page.getByRole("article", { name: "Queued match 1", exact: true });
    await queue.getByRole("button", { name: "Change teams" }).click();
    let editor = page.getByRole("dialog", { name: /Change teams/ });
    await expect(editor.getByRole("combobox", { name: "Replace selected player" })).toBeDisabled();
    await editor.getByRole("button", { name: "Team 1, slot 1: Player 1", exact: true }).click();
    await editor.getByRole("combobox", { name: "Replace selected player" }).click();
    const options = page.locator(".ant-select-item-option");
    await expect(options).toHaveCount(1);
    await expect(options).toHaveText(["Waiting · Beginner"]);
    await options.first().click();
    await expect(editor.getByRole("button", { name: "Team 1, slot 1: Waiting", exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(editor).not.toBeVisible();
    await expect(queue.getByText("Waiting", { exact: true })).toBeVisible();
    await expect(queue.getByText("Player 1", { exact: true })).not.toBeVisible();
    await queue.getByRole("button", { name: "Assign to court" }).click();
    await page.getByRole("menuitem", { name: "Court 1", exact: true }).click();
    if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Courts/ }).click();
    const court = page.getByRole("article", { name: "Court 1", exact: true });
    await court.getByRole("button", { name: "Start Match", exact: true }).click();
    await court.getByRole("button", { name: "Change teams" }).click();
    editor = page.getByRole("dialog", { name: /Change teams/ });
    await editor.getByRole("button", { name: "Team 1, slot 1: Waiting", exact: true }).click();
    await editor.getByRole("combobox", { name: "Replace selected player" }).click();
    await expect(options).toHaveCount(1);
    await expect(options).toHaveText(["Player 1 · Intermediate"]);
    await options.first().click();
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(editor).not.toBeVisible();
    await page.reload();
    if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Courts/ }).click();
    await expect(court.getByText("Playing", { exact: true })).toBeVisible();
    await expect(court.getByText("Player 1", { exact: true })).toBeVisible();
    await expect(court.getByText("Waiting", { exact: true })).not.toBeVisible();
    await court.getByRole("button", { name: "Finish Match" }).click();
    const finish = page.getByRole("dialog", { name: "Finish Match", exact: true });
    await expect(finish.getByText("Team 1 (Player 1 & Player 2)", { exact: true })).toBeVisible();
    await finish.getByText("Team 1", { exact: true }).click();
    await finish.getByRole("button", { name: "OK", exact: true }).click();
    await expect(finish).not.toBeVisible();
  });
}
