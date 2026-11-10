import { test, expect, type Page, type Locator } from "@playwright/test";
import type { QueueData } from "../../../app/queuing/state/model";
import { DATABASE_NAME } from "../../../app/queuing/state/storage";
import { charged, ended, pay, run, NOW } from "./fixtures";
test.use({ serviceWorkers: "allow" });
async function setup(page: Page, mode = "light") {
    await page.clock.setFixedTime(new Date(NOW));
    await page.addInitScript(({ data, mode }) => {
        if (!localStorage.getItem("badminton_queue_data_v2"))
            localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data }));
        localStorage.setItem("badminton_queue_appearance", JSON.stringify({ color: "emerald", mode }));
    }, { data: charged(), mode });
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
}
async function stored(page: Page): Promise<QueueData> {
    return page.evaluate((name) => new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("data", "readonly");
            const read = tx.objectStore("data").get("current");
            read.onsuccess = () => resolve(read.result.session);
            read.onerror = () => reject(read.error);
            tx.oncomplete = () => db.close();
        };
    }), DATABASE_NAME);
}
const panel = (page: Page) => page.getByRole("dialog", { name: "Payments", exact: true });
const player = (page: Page) => panel(page).getByTestId("payment-player").filter({ hasText: "Audit Player 0" });
async function editor(page: Page) {
    await activate(player(page).getByRole("button", { name: "Details for Audit Player 0", exact: true }));
    const detail = page.getByRole("dialog", { name: "Payment details · Audit Player 0", exact: true });
    await activate(detail.getByRole("button", { name: "Record payment", exact: true }));
    return page.getByRole("dialog", { name: "Record payment · Audit Player 0", exact: true });
}
test("invalid draft and cancellation never save a payment; edited cents and overpayment persist", async ({ page }, info) => {
    await setup(page);
    const before = await stored(page);
    let edit = await editor(page);
    await activate(edit.getByRole("button", { name: "Save payment", exact: true }));
    await expect(edit.locator(".ant-form-item-explain-error")).toBeVisible();
    expect((await stored(page)).billing).toEqual(before.billing);
    await edit.getByRole("spinbutton", { name: "Payment amount (PHP)" }).fill("220.01");
    await edit.getByRole("spinbutton", { name: "Payment amount (PHP)" }).press("Tab");
    await activate(edit.getByRole("button", { name: "Close", exact: true }));
    await expect(edit).not.toBeVisible();
    expect((await stored(page)).billing.receipts).toHaveLength(0);
    const detail = page.getByRole("dialog", { name: "Payment details · Audit Player 0", exact: true });
    await activate(detail.getByRole("button", { name: "Record payment", exact: true }));
    edit = page.getByRole("dialog", { name: "Record payment · Audit Player 0", exact: true });
    await edit.getByRole("spinbutton", { name: "Payment amount (PHP)" }).fill("220.01");
    await edit.getByRole("spinbutton", { name: "Payment amount (PHP)" }).press("Tab");
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function () {
            IDBObjectStore.prototype.put = original;
            throw new Error("Audit detailed payment write failed");
        };
    });
    await activate(edit.getByRole("button", { name: "Save payment", exact: true }));
    await expect(edit).toContainText("Audit detailed payment write failed");
    await expect(edit.getByRole("spinbutton", { name: "Payment amount (PHP)" })).toHaveValue("220.01");
    expect((await stored(page)).billing.receipts).toHaveLength(0);
    await activate(edit.getByRole("button", { name: "Save payment", exact: true }));
    await expect(edit).not.toBeVisible();
    expect((await stored(page)).billing.receipts[0]).toMatchObject({ amount: 22001, playerId: "p0", method: "cash", paidAt: NOW });
    await expect(detail).toContainText("₱0.01");
    await activate(detail.getByText("Payment history (1)", { exact: true }));
    await activate(detail.getByRole("button", { name: "Delete", exact: true }));
    await activate(page.getByRole("button", { name: "Cancel", exact: true }).last());
    expect((await stored(page)).billing.receipts).toHaveLength(1);
    await page.screenshot({ path: info.outputPath("overpayment-details.png") });
});
test("payments sync across tabs and paid receipts survive reload", async ({ page, context }) => {
    await setup(page, "dark");
    const other = await context.newPage();
    await other.goto("/queuing");
    await expect(other.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(other.getByRole("button", { name: "Payments", exact: true }));
    await activate(player(page).getByRole("button", { name: "Pay Audit Player 0", exact: true }));
    await activate(page.getByRole("button", { name: "Cash", exact: true }));
    await expect(player(other)).toHaveCount(0);
    await activate(panel(other).getByText("Paid", { exact: true }));
    await expect(player(other)).toContainText("Fully paid");
    await other.reload();
    await expect(other.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(other.getByRole("button", { name: "Payments", exact: true }));
    await activate(panel(other).getByText("Paid", { exact: true }));
    await expect(player(other)).toContainText("Fully paid");
    expect((await stored(other)).billing.receipts).toHaveLength(1);
    await other.close();
});
test("delayed writes block double submission and false success", async ({ page }) => {
    await setup(page);
    // Hold the actual readwrite transaction open with queued reads, not a fake save response.
    await page.evaluate(() => {
        const original = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase["transaction"]>) {
            const tx = original.apply(this, args);
            if (args[1] === "readwrite") {
                IDBDatabase.prototype.transaction = original;
                (window as Window & {
                    auditRelease?: boolean;
                }).auditRelease = false;
                const store = tx.objectStore("data");
                const hold = () => {
                    if (!(window as Window & {
                        auditRelease?: boolean;
                    }).auditRelease)
                        store.get("audit-delay").onsuccess = hold;
                };
                store.get("audit-delay").onsuccess = hold;
            }
            return tx;
        };
    });
    await activate(player(page).getByRole("button", { name: "Pay Audit Player 0", exact: true }));
    const cash = page.getByRole("button", { name: "Cash", exact: true });
    await cash.evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
    });
    await expect(cash).toBeDisabled();
    await expect(panel(page).getByRole("status")).toHaveCount(0);
    await page.evaluate(() => { (window as Window & {
        auditRelease?: boolean;
    }).auditRelease = true; });
    await expect(panel(page).getByRole("status")).toContainText("₱220.00 received");
    expect((await stored(page)).billing.receipts).toHaveLength(1);
});
test("offline collection and offline reload preserve the committed ledger", async ({ page, context }, info) => {
    await setup(page);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await context.setOffline(true);
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
    await activate(player(page).getByRole("button", { name: "Pay Audit Player 0", exact: true }));
    await activate(page.getByRole("button", { name: "Digital", exact: true }));
    await expect(panel(page).getByRole("status")).toContainText("₱220.00 received");
    const saved = (await stored(page)).billing;
    await page.reload();
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    expect((await stored(page)).billing).toEqual(saved);
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
    await activate(panel(page).getByText("Paid", { exact: true }));
    await expect(player(page)).toContainText("Fully paid");
    await page.screenshot({ path: info.outputPath("offline-paid.png") });
    await context.setOffline(false);
});
// PAY-002 regression: never clamp an invalid amount into a valid receipt.
for (const amount of ["0", "-1", "10000000.01"])
    test(`PAY-002 @regression: rejects invalid payment ${amount} without changing the ledger`, async ({ page }) => {
        await setup(page);
        const edit = await editor(page);
        await edit.getByRole("spinbutton", { name: "Payment amount (PHP)" }).fill(amount);
        await activate(edit.getByRole("button", { name: "Save payment", exact: true }));
        await expect(edit.locator(".ant-form-item-explain-error")).toBeVisible();
        expect((await stored(page)).billing.receipts).toHaveLength(0);
        await expect(edit).toBeVisible();
    });
test("reopening settlement preserves receipts and permits a reviewed charge correction", async ({ page }) => {
    const data = run(ended(pay(charged())), { type: "finalizeBilling", revision: 0 });
    await page.clock.setFixedTime(new Date(NOW));
    await page.addInitScript((data) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data })), data);
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
    await activate(panel(page).getByRole("tab", { name: "Billing", exact: true }));
    await activate(panel(page).getByRole("button", { name: "Reopen settlement", exact: true }));
    await activate(page.getByRole("button", { name: "OK", exact: true }));
    await expect(panel(page).getByRole("button", { name: "Review final settlement", exact: true })).toBeEnabled();
    expect((await stored(page)).billing.receipts).toEqual(data.billing.receipts);
    expect((await stored(page)).billing.finalized).toBeNull();
    await activate(panel(page).getByRole("button", { name: "Edit billing for Audit Player 0", exact: true }));
    const bill = page.getByRole("dialog", { name: "Billing · Audit Player 0", exact: true });
    await bill.getByRole("spinbutton", { name: "Charge amount", exact: true }).fill("150");
    await activate(bill.getByRole("button", { name: "Save billing", exact: true }));
    await expect(bill).not.toBeVisible();
    expect((await stored(page)).billing.arrangements.p0).toMatchObject({ amount: 15000 });
    await activate(panel(page).getByRole("button", { name: "Review final settlement", exact: true }));
    await activate(page.getByRole("dialog", { name: "Review final settlement", exact: true }).getByRole("button", { name: "Finalize charges", exact: true }));
    await expect(panel(page).getByRole("button", { name: "Reopen settlement", exact: true })).toBeVisible();
    expect((await stored(page)).billing.receipts).toEqual(data.billing.receipts);
    expect((await stored(page)).billing.finalized!.charges.find((c) => c.playerId === "p0")!.amount).toBe(15000);
});
test("rounded-up billing suggestion applies reviewed integer charges", async ({ page }) => {
    await setup(page);
    await activate(panel(page).getByRole("tab", { name: "Costs", exact: true }));
    await panel(page).getByRole("spinbutton", { name: "Court fees (PHP)" }).fill("100");
    await expect(panel(page).getByTestId("cost-estimate")).toContainText("₱33.33 each");
    await activate(panel(page).getByRole("button", { name: "Continue to set billing", exact: true }));
    const bulk = page.getByRole("dialog", { name: "Set billing for players", exact: true });
    await activate(bulk.getByRole("button", { name: "Use ₱40.00", exact: true }));
    await expect(bulk.getByRole("spinbutton", { name: "Amount per player (PHP)" })).toHaveValue(/^40(?:\.00)?$/);
    await activate(bulk.getByRole("button", { name: "Apply billing", exact: true }));
    await expect(bulk).not.toBeVisible();
    expect(Object.values((await stored(page)).billing.arrangements).every((a) => a.kind === "shared" && a.amount === 4000)).toBe(true);
});
// PAY-003 regression: restore focus after the overlay and its native focus restoration finish.
test("PAY-003 @regression: Escape returns focus to the quick-payment trigger", async ({ page }) => {
    await setup(page);
    const trigger = player(page).getByRole("button", { name: "Pay Audit Player 0", exact: true });
    await activate(trigger);
    const cash = page.getByRole("button", { name: "Cash", exact: true });
    await cash.focus();
    await page.keyboard.press("Escape");
    await expect(cash).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect((await stored(page)).billing.receipts).toHaveLength(0);
});
test("PAY-001 @regression: a stale delete confirmation preserves a cross-tab receipt correction", async ({ page, context }) => {
    const data = pay(charged());
    await page.clock.setFixedTime(new Date(NOW));
    await page.addInitScript((data) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data })), data);
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
    await activate(player(page).getByRole("button", { name: "Details for Audit Player 0", exact: true }));
    const detail = page.getByRole("dialog", { name: "Payment details · Audit Player 0", exact: true });
    await activate(detail.getByText("Payment history (1)", { exact: true }));
    await activate(detail.getByRole("button", { name: "Delete", exact: true }));
    const confirmation = page.getByRole("tooltip").filter({ hasText: "Delete this payment?" });
    await expect(confirmation).toBeVisible();
    const other = await context.newPage();
    await other.goto("/queuing");
    await expect(other.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(other.getByRole("button", { name: "Payments", exact: true }));
    await activate(player(other).getByRole("button", { name: "Details for Audit Player 0", exact: true }));
    const otherDetail = other.getByRole("dialog", { name: "Payment details · Audit Player 0", exact: true });
    await activate(otherDetail.getByText("Payment history (1)", { exact: true }));
    await activate(otherDetail.getByRole("button", { name: "Edit", exact: true }));
    const edit = other.getByRole("dialog", { name: "Edit payment · Audit Player 0", exact: true });
    await edit.getByRole("spinbutton", { name: "Payment amount (PHP)" }).fill("220");
    await edit.getByRole("spinbutton", { name: "Payment amount (PHP)" }).press("Tab");
    await activate(edit.getByRole("button", { name: "Save payment", exact: true }));
    await expect(edit).not.toBeVisible();
    await expect(detail).toContainText("₱220.00");
    await activate(confirmation.getByRole("button", { name: "OK", exact: true }));
    await expect(confirmation).toContainText("Payment changed");
    expect((await stored(page)).billing.receipts).toMatchObject([{ id: "r1", amount: 22000 }]);
    await activate(confirmation.getByRole("button", { name: "Cancel", exact: true }));
    await expect(confirmation).not.toBeVisible();
    await activate(detail.getByRole("button", { name: "Delete", exact: true }));
    await activate(confirmation.getByRole("button", { name: "OK", exact: true }));
    await expect(confirmation).not.toBeVisible();
    expect((await stored(page)).billing.receipts).toHaveLength(0);
    await other.close();
});
test("Payments remains closable if another tab removes the player shown in details", async ({ page, context }) => {
    await setup(page);
    await activate(player(page).getByRole("button", { name: "Details for Audit Player 0", exact: true }));
    const detail = page.getByRole("dialog", { name: "Payment details · Audit Player 0", exact: true });
    await expect(detail).toBeVisible();
    const other = await context.newPage();
    await other.goto("/queuing");
    await expect(other.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(other.getByRole("button", { name: "Options for Audit Player 0", exact: true }));
    await activate(other.getByRole("menuitem", { name: "Remove player", exact: true }));
    await activate(other.getByRole("dialog", { name: "Remove Audit Player 0 from this session?", exact: true }).getByRole("button", { name: "Remove player", exact: true }));
    await expect(detail).not.toBeVisible();
    await activate(panel(page).getByRole("button", { name: "Close", exact: true }));
    await expect(panel(page)).not.toBeVisible();
    await other.close();
});

// Use the actual input modality of each project; keep native double-click guard probes unchanged.
async function activate(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}

test("manual costs and explicit exclusions update existing bills and use the latest entered fee", async ({ page }) => {
  await page.addInitScript((data) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data })), pay(charged()));
  await setup(page);
  await activate(panel(page).getByRole("tab", { name: "Costs", exact: true }));
  await panel(page).getByRole("spinbutton", { name: "Court fees (PHP)" }).fill("100.50");
  const exclusions = panel(page).getByRole("combobox", { name: "Exclude from cost calculation" });
  await exclusions.fill("Audit Player 0");
  await exclusions.press("Enter");
  await exclusions.press("Escape");
  await activate(panel(page).getByRole("button", { name: "Continue to set billing", exact: true }));
  const bulk = page.getByRole("dialog", { name: "Set billing for players", exact: true });
  await expect(bulk).toContainText("Apply to 2 players");
  const excluded = bulk.getByTestId("bulk-player-preview").filter({ hasText: "Audit Player 0" });
  await expect(excluded).toContainText("No charge");
  await bulk.getByRole("spinbutton", { name: "Amount per player (PHP)" }).fill("79.99");
  // Submit immediately: saving must use the form's validated value, not a previous render.
  await activate(bulk.getByRole("button", { name: "Apply billing", exact: true }));
  await expect(bulk).not.toBeVisible();
  await expect(panel(page).getByRole("tab", { name: "Collect", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(panel(page)).toContainText("1 set to No charge");
  const saved = await stored(page);
  expect(saved.billing.expenses.courtFee).toBe(10050);
  expect(saved.billing.arrangements.p0).toEqual({ kind: "none" });
  expect(saved.billing.arrangements.p1).toMatchObject({ amount: 7999 });
  expect(saved.billing.arrangements.p2).toMatchObject({ amount: 7999 });
  expect(saved.billing.receipts).toEqual(pay(charged()).billing.receipts);
  await expect(player(page)).toHaveCount(0);
  await activate(panel(page).getByRole("tab", { name: "Billing", exact: true }));
  await activate(panel(page).getByRole("button", { name: "Set billing for players", exact: true }));
  await expect(bulk).toContainText("Apply to 2 players");
  await expect(bulk.getByTestId("bulk-player-preview").filter({ hasText: "Audit Player 0" })).toContainText("No charge");
  await activate(bulk.getByRole("button", { name: "Cancel", exact: true }));
});

test("can exclude every player from costs and collection without entering a charge", async ({ page }) => {
  await setup(page);
  await activate(panel(page).getByRole("tab", { name: "Costs", exact: true }));
  const exclusions = panel(page).getByRole("combobox", { name: "Exclude from cost calculation" });
  for (const name of ["Audit Player 0", "Audit Player 1", "Audit Player 2"]) {
    await exclusions.fill(name);
    await exclusions.press("Enter");
  }
  await exclusions.press("Escape");
  const next = panel(page).getByRole("button", { name: "Continue to set billing", exact: true });
  await expect(next).toBeEnabled();
  await activate(next);
  const bulk = page.getByRole("dialog", { name: "Set billing for players", exact: true });
  await expect(bulk).toContainText("Apply to 0 players");
  await activate(bulk.getByRole("button", { name: "Apply billing", exact: true }));
  await expect(bulk).not.toBeVisible();
  const saved = await stored(page);
  expect(Object.values(saved.billing.arrangements)).toEqual([{ kind: "none" }, { kind: "none" }, { kind: "none" }]);
  await expect(panel(page).getByTestId("payment-player")).toHaveCount(0);
});

test("estimate save confirms it does not charge players and review applies the newest manual amount", async ({ page }) => {
  await setup(page);
  await activate(panel(page).getByRole("tab", { name: "Costs", exact: true }));
  await panel(page).getByRole("spinbutton", { name: "Court fees (PHP)" }).fill("123.45");
  await activate(panel(page).getByRole("button", { name: "Save estimate", exact: true }));
  await expect(panel(page)).toContainText("Estimate saved. Continue to set billing");
  const estimated = await stored(page);
  expect(estimated.billing.expenses.courtFee).toBe(12345);
  expect(Object.values(estimated.billing.arrangements).every((a) => a.kind === "shared" && a.amount === 22000)).toBe(true);
  await activate(panel(page).getByRole("button", { name: "Continue to set billing", exact: true }));
  const bulk = page.getByRole("dialog", { name: "Set billing for players", exact: true });
  await expect(bulk.getByRole("spinbutton", { name: "Amount per player (PHP)" })).toHaveValue("41.15");
  await bulk.getByRole("spinbutton", { name: "Amount per player (PHP)" }).fill("55.55");
  await activate(bulk.getByRole("button", { name: "Apply billing", exact: true }));
  await expect(bulk).not.toBeVisible();
  expect(Object.values((await stored(page)).billing.arrangements).every((a) => a.kind === "shared" && a.amount === 5555)).toBe(true);
});
