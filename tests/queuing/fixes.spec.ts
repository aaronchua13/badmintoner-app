import { test, expect, Page, BrowserContext } from "@playwright/test";
import { initialSession, QueueData } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

function fixture(running = true) {
  const now = Date.now();
  let s = initialSession(now);
  for (let i = 0; i < 8; i++) {
    s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i + 1}`, gender: "Male", level: "Intermediate" } }, now);
    s = transition(s, { type: "checkInPlayer", id: `p${i}` }, now);
    s = transition(s, { type: "togglePlayerSelection", courtId: i < 4 ? "c1" : "c2", playerId: `p${i}`, selected: true }, now);
  }
  s = transition(s, { type: "startSession" }, now);
  if (running) {
    s = transition(s, { type: "startMatch", courtId: "c1" }, now);
    s = transition(s, { type: "startMatch", courtId: "c2" }, now);
  }
  return s;
}
async function seed(context: BrowserContext, data: QueueData) {
  await context.addInitScript((s) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify(s)), data);
}
async function ready(page: Page) {
  await page.goto("/queuing");
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
}
const court = (page: Page, name = "Court 1") => page.getByRole("article", { name, exact: true });
const finish = (page: Page) => page.getByRole("dialog", { name: "Finish Match", exact: true });

test("finish forms reset on cancellation and reopening; scored winners derive and clearing scores requires manual selection", async ({ page, context }) => {
  await seed(context, fixture());
  await ready(page);
  await court(page).getByRole("button", { name: "Finish Match", exact: true }).click();
  const modal = finish(page), scores = modal.getByRole("spinbutton");
  await scores.nth(0).fill("21");
  await scores.nth(1).fill("0");
  await expect(modal.getByRole("radio", { name: "Team 1", exact: true })).toBeChecked();
  await expect(modal.getByRole("radio", { name: "Team 2", exact: true })).toBeDisabled();
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(modal).not.toBeVisible();
  for (const name of ["Court 1", "Court 2"]) {
    await court(page, name).getByRole("button", { name: "Finish Match", exact: true }).click();
    await expect(scores.nth(0)).toHaveValue("");
    await expect(modal.getByRole("radio", { name: "Team 1", exact: true })).not.toBeChecked();
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(modal).not.toBeVisible();
  }
  await court(page).getByRole("button", { name: "Finish Match", exact: true }).click();
  await scores.nth(0).fill("0");
  await scores.nth(1).fill("21");
  await expect(modal.getByRole("radio", { name: "Team 2", exact: true })).toBeChecked();
  await scores.nth(0).fill("21");
  await modal.getByRole("button", { name: "OK", exact: true }).click();
  await expect(modal.getByText("Scores cannot be tied", { exact: true }).first()).toBeVisible();
  await scores.nth(0).fill("20.5");
  await modal.getByRole("button", { name: "OK", exact: true }).click();
  await expect(modal.getByText("Scores must be non-negative whole numbers", { exact: true })).toBeVisible();
  await scores.nth(0).fill("0");
  await scores.nth(1).fill("");
  await modal.getByRole("button", { name: "OK", exact: true }).click();
  await expect(modal.getByText("Enter both scores, or leave both empty", { exact: true }).first()).toBeVisible();
  await scores.nth(0).fill("");
  await expect(modal.getByRole("radio", { name: "Team 2", exact: true })).not.toBeChecked();
  await expect(modal.getByRole("radio", { name: "Team 1", exact: true })).toBeEnabled();
  await modal.getByRole("button", { name: "OK", exact: true }).click();
  await expect(modal.getByText("Please select a winner", { exact: true })).toBeVisible();
  await modal.getByText("Team 2", { exact: true }).click();
  await modal.getByRole("button", { name: "OK", exact: true }).click();
  await expect(modal).not.toBeVisible();
});

test("a stale finish preserves the entered scores after teams change in another tab", async ({ page, context }) => {
  await seed(context, fixture());
  await ready(page);
  const other = await context.newPage();
  await ready(other);
  await court(page).getByRole("button", { name: "Finish Match", exact: true }).click();
  await finish(page).getByRole("spinbutton").nth(0).fill("21");
  await finish(page).getByRole("spinbutton").nth(1).fill("0");
  await court(other).getByRole("button", { name: "Change teams", exact: true }).click();
  const editor = other.getByRole("dialog", { name: "Change teams — Court 1", exact: true });
  await editor.getByRole("button", { name: "Team 1, slot 1: Player 1", exact: true }).click();
  await editor.getByRole("button", { name: "Team 2, slot 1: Player 3", exact: true }).click();
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await finish(page).getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("Teams changed. Reopen Finish Match and review the teams.", { exact: true }).first()).toBeVisible();
  await expect(finish(page).getByRole("spinbutton").nth(0)).toHaveValue("21");
  await expect(finish(page).getByRole("spinbutton").nth(1)).toHaveValue("0");
  await other.close();
});

test("stale payment edits retain the draft and require reopening to see the corrected receipt", async ({ page, context }) => {
  let s = fixture(false);
  s = transition(s, { type: "saveReceipt", editing: false, values: { id: "r", playerId: "p0", amount: 10000, method: "cash", paidAt: Date.now(), note: "Original" } }, Date.now());
  await seed(context, s);
  await ready(page);
  const other = await context.newPage();
  await ready(other);
  const openEditor = async (p: Page) => {
    await p.getByRole("button", { name: "Payments", exact: true }).click();
    const panel = p.getByRole("dialog", { name: "Payments", exact: true });
    await panel.getByText("All", { exact: true }).click();
    await panel.getByRole("button", { name: "Details for Player 1", exact: true }).click();
    const row = p.getByRole("dialog", { name: "Payment details · Player 1", exact: true });
    await row.getByText("Payment history (1)", { exact: true }).click();
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    return p.getByRole("dialog", { name: "Edit payment · Player 1", exact: true });
  };
  const oldEditor = await openEditor(page), newEditor = await openEditor(other);
  await oldEditor.getByLabel("Note", { exact: true }).fill("My draft");
  await newEditor.getByRole("spinbutton", { name: "Payment amount (PHP)" }).fill("250");
  await newEditor.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(newEditor).not.toBeVisible();
  await oldEditor.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(oldEditor.getByText("Payment changed. Close and reopen the editor to review the latest payment.", { exact: true })).toBeVisible();
  await expect(oldEditor.getByLabel("Note", { exact: true })).toHaveValue("My draft");
  await oldEditor.getByRole("button", { name: "Close", exact: true }).click();
  await expect(oldEditor).not.toBeVisible();
  await page.getByRole("dialog", { name: "Payment details · Player 1", exact: true }).getByRole("button", { name: "Edit", exact: true }).click();
  await expect(oldEditor.getByRole("spinbutton", { name: "Payment amount (PHP)" })).toHaveValue("250.00");
  await other.close();
});

test("waiting filter and count exclude all assignments and unavailable players", async ({ page, context }) => {
  let s = fixture(false);
  const now = Date.now();
  s = transition(s, { type: "clearCourt", id: "c2" }, now);
  s = transition(s, { type: "startMatch", courtId: "c1" }, now);
  s = transition(s, { type: "togglePlayerSelection", courtId: "c2", playerId: "p4", selected: true }, now);
  s = transition(s, { type: "createQueueItem", id: "q" }, now);
  s = transition(s, { type: "addPlayerToQueueItem", queueId: "q", playerId: "p5" }, now);
  s = transition(s, { type: "togglePlayerActive", id: "p6" }, now);
  s = transition(s, { type: "addPlayer", id: "absent", values: { name: "Absent", level: "Beginner", gender: "Male" } }, now);
  await seed(context, s);
  await ready(page);
  await expect(page.getByText(/1 waiting · 1 away/)).toBeVisible();
  await page.getByRole("combobox", { name: "Player status" }).click();
  await page.locator('.ant-select-item-option[title="Waiting"]').click();
  await expect(page.getByTestId("player-row")).toHaveCount(1);
  await expect(page.getByTestId("player-row")).toContainText("Player 8");
});

test("summary labels follow session state and ended idle totals agree across views", async ({ page, context }) => {
  const now = Date.now(), start = now - 1200000;
  let s = fixture(false);
  s.sessionStartTime = start;
  s.players.forEach((p) => { p.checkedInAt = start; p.joinedAt = start; p.lastMatchEndTime = start; });
  s = transition(s, { type: "startMatch", courtId: "c1" }, start + 1000);
  s = transition(s, { type: "finishMatch", courtId: "c1", startTime: start + 1000, players: s.courts[0].players, id: "m", values: { winningTeam: 1 } }, now - 600000);
  await seed(context, s);
  await ready(page);
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  let summary = page.getByRole("dialog", { name: "Session Summary", exact: true });
  await expect(summary.getByText("Live overview", { exact: true })).toBeVisible();
  await summary.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByRole("button", { name: "Session menu" }).click();
  await page.getByRole("menuitem", { name: "Stop session", exact: true }).click();
  await page.getByRole("dialog", { name: "End this session?" }).getByRole("button", { name: "Stop session", exact: true }).click();
  summary = page.getByRole("dialog", { name: "Session Summary", exact: true });
  await expect(summary.getByText("Final results", { exact: true })).toBeVisible();
  const finalIdle = await summary.locator("tbody tr.ant-table-row").filter({ hasText: "Player 1" }).locator("td").last().innerText();
  await expect(finalIdle).toMatch(/^00:10:/);
  await summary.getByRole("button", { name: "Close", exact: true }).last().click();
  const row = page.getByTestId("player-row").filter({ hasText: "Player 1" });
  await expect(row.locator('[data-label="Total idle"] strong')).toHaveText("10m");
  await row.getByRole("button", { name: "Options for Player 1", exact: true }).click();
  await page.getByRole("menuitem", { name: "Player details", exact: true }).click();
  const details = page.getByRole("dialog", { name: /Player 1/ });
  await expect(details.locator("tr").filter({ hasText: "Total Idle Time" })).toContainText("10m");
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await page.clock.install();
  await page.clock.fastForward(60000);
  await expect(row.locator('[data-label="Total idle"] strong')).toHaveText("10m");
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await expect(summary.locator("tbody tr.ant-table-row").filter({ hasText: "Player 1" }).locator("td").last()).toHaveText(finalIdle);
});

test("setup summary stays labeled as session setup", async ({ page, context }) => {
  await seed(context, initialSession(Date.now()));
  await ready(page);
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Session Summary", exact: true }).getByText("Session setup", { exact: true })).toBeVisible();
});

test("stale transfer keeps its dialog open and leaves the changed lineup on its source court", async ({ page, context }) => {
  let s = fixture(false);
  s = transition(s, { type: "clearCourt", id: "c2" }, Date.now());
  await seed(context, s);
  await ready(page);
  const other = await context.newPage();
  await ready(other);
  await court(page).getByRole("button", { name: "Options for Court 1", exact: true }).click();
  await page.getByRole("menuitem", { name: "Transfer players / match", exact: true }).click();
  const transfer = page.getByRole("dialog", { name: "Transfer Match/Players", exact: true });
  await transfer.getByRole("combobox").click();
  await page.locator('.ant-select-item-option[title="Court 2"]').click();
  await court(other).getByRole("button", { name: "Change teams", exact: true }).click();
  const editor = other.getByRole("dialog", { name: "Change teams — Court 1", exact: true });
  await editor.getByRole("button", { name: "Team 1, slot 1: Player 1", exact: true }).click();
  await editor.getByRole("button", { name: "Team 2, slot 1: Player 3", exact: true }).click();
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await transfer.getByRole("button", { name: /Transfer$/ }).click();
  await expect(transfer.getByText("Courts changed. Reopen the transfer dialog and choose an empty court.", { exact: true })).toBeVisible();
  await expect(transfer.getByText("Court 2", { exact: true })).toBeVisible();
  await transfer.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(court(page)).toContainText("Player 3");
  await expect(court(page, "Court 2")).not.toContainText("Player 3");
  await other.close();
});
