// Project-driven coverage derived from the preserved payments.spec.ts workflows.
import { test, expect, type Locator } from "@playwright/test";
import { initialSession } from "../../../app/queuing/state/model";
import { transition } from "../../../app/queuing/state/transitions";
test(`collection-first payments, corrections and settlement`, async ({ page, }, testInfo) => {
    await page.clock.setFixedTime(new Date(1800000000000));
    let data = initialSession(1800000000000);
    for (const name of ["Aaron", "Phinky", "Jans", "Unassigned player"]) {
        data = transition(data, {
            type: "addPlayer",
            id: name,
            values: { name, gender: "Male", level: "Intermediate" },
        }, 1800000000000);
    }
    for (const name of ["Phinky", "Jans"])
        data = transition(data, {
            type: "setArrangement",
            playerId: name,
            values: { kind: "shared", adjustment: "fixed", amount: 22000 },
        }, 1800000000000);
    data = transition(data, { type: "setArrangement", playerId: "Aaron", values: { kind: "none" } }, 1800000000000);
    await page.addInitScript((data) => {
        if (!localStorage.getItem("badminton_queue_data_v2"))
            localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ version: 1, data }));
    }, data);
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
    const panel = page.getByRole("dialog", { name: "Payments", exact: true });
    const row = (name: string) => panel
        .getByTestId("payment-player")
        .filter({ has: page.getByText(name, { exact: true }) });
    await expect(panel.getByRole("textbox", { name: "Search payments" })).toBeInViewport();
    await expect(panel.getByRole("spinbutton", { name: "Court fees (PHP)" })).toHaveCount(0);
    await expect(panel.getByTestId("payment-player")).toHaveCount(2);
    await expect(panel).toContainText("1 player needs billing");
    await activate(panel
        .getByRole("button", { name: "Set billing", exact: true }));
    await activate(panel
        .getByTestId("billing-player")
        .filter({ hasText: "Jans" })
        .getByRole("button", { name: "Edit billing for Jans", exact: true }));
    const individualBill = page.getByRole("dialog", {
        name: "Billing · Jans",
        exact: true,
    });
    await individualBill
        .getByRole("spinbutton", { name: "Charge amount", exact: true })
        .fill("270");
    await individualBill
        .getByRole("spinbutton", { name: "Discount (PHP)", exact: true })
        .fill("50");
    await individualBill.getByLabel("Billing note").fill("Student discount");
    await expect(individualBill).toContainText("Amount due: ₱220.00");
    await activate(individualBill
        .getByRole("button", { name: "Save billing", exact: true }));
    await activate(panel.getByRole("tab", { name: "Collect", exact: true }));
    await activate(row("Jans")
        .getByRole("button", { name: "Pay Jans", exact: true }));
    await activate(page
        .getByRole("button", { name: "Other amount", exact: true }));
    const deposit = page.getByRole("dialog", {
        name: "Record payment · Jans",
        exact: true,
    });
    await deposit
        .getByRole("spinbutton", { name: "Payment amount (PHP)" })
        .fill("100");
    await expect(deposit.getByLabel("Payment date and time")).not.toBeVisible();
    await activate(deposit.getByRole("combobox", { name: "Payment method" }));
    await activate(page
        .locator(".ant-select-item-option")
        .filter({ hasText: /^Digital$/ }));
    await activate(deposit
        .getByRole("button", { name: "Save payment", exact: true }));
    await expect(deposit).not.toBeVisible();
    await expect(row("Jans")).toContainText("Partially paid");
    await expect(row("Jans")).toContainText("₱120.00");
    await activate(row("Jans")
        .getByRole("button", { name: "Pay Jans", exact: true }));
    await activate(page.getByRole("button", { name: "Cash", exact: true }));
    await expect(panel.getByRole("status")).toContainText("Jans · ₱120.00 received · Cash");
    await expect(row("Jans")).toHaveCount(0);
    await expect(panel.getByRole("textbox", { name: "Search payments" })).toBeFocused();
    await activate(panel
        .getByRole("button", { name: "Review payment", exact: true }));
    const edit = page.getByRole("dialog", { name: "Edit payment · Jans" });
    await edit
        .getByRole("spinbutton", { name: "Payment amount (PHP)" })
        .fill("110");
    await activate(edit
        .getByRole("button", { name: "Save payment", exact: true }));
    await expect(row("Jans")).toContainText("₱10.00");
    await activate(row("Jans")
        .getByRole("button", { name: "Pay Jans", exact: true }));
    await activate(page.getByRole("button", { name: "Digital", exact: true }));
    await expect(panel.getByRole("status")).toContainText("₱10.00 received · Digital");
    await activate(panel.getByText("All", { exact: true }));
    await expect(row("Jans")).toContainText("Fully paid");
    await expect(row("Jans").getByRole("button", { name: "Pay Jans", exact: true })).toHaveCount(0);
    await expect(row("Aaron").getByRole("button", { name: "Pay Aaron", exact: true })).toHaveCount(0);
    await activate(row("Jans").getByRole("button", { name: "Details for Jans" }));
    const details = page.getByRole("dialog", {
        name: "Payment details · Jans",
    });
    await activate(details.getByText("Payment history (3)"));
    await expect(details).toContainText("Cash");
    await expect(details).toContainText("Digital");
    await activate(details.getByRole("button", { name: "Close", exact: true }));
    await activate(panel.getByRole("tab", { name: "Costs", exact: true }));
    await panel
        .getByRole("spinbutton", { name: "Court fees (PHP)" })
        .fill("1000");
    await expect(panel.getByTestId("cost-estimate")).toContainText("₱1,000.00 ÷ 4 players = ₱250.00 each");
    await activate(panel
        .getByRole("button", { name: "Save estimate", exact: true }));
    await activate(panel.getByRole("tab", { name: "Billing", exact: true }));
    const unassigned = panel
        .getByTestId("billing-player")
        .filter({ hasText: "Unassigned player" });
    await activate(unassigned
        .getByRole("button", {
        name: "Set billing for Unassigned player",
        exact: true,
    }));
    const billing = page.getByRole("dialog", {
        name: "Billing · Unassigned player",
        exact: true,
    });
    await billing
        .getByRole("spinbutton", { name: "Charge amount", exact: true })
        .fill("220");
    await activate(billing
        .getByRole("button", { name: "Save billing", exact: true }));
    await activate(panel.getByRole("button", { name: "Close", exact: true }));
    await activate(page
        .getByRole("button", { name: "Start Session", exact: true }));
    await activate(page.getByRole("button", { name: "Session menu" }));
    await activate(page
        .getByRole("menuitem", { name: "Stop session", exact: true }));
    await activate(page
        .getByRole("dialog", { name: "End this session?" })
        .getByRole("button", { name: "Stop session", exact: true }));
    await activate(page
        .getByRole("dialog", { name: "Session Summary" })
        .getByRole("button", { name: "Review payments" }));
    await activate(panel.getByRole("tab", { name: "Billing", exact: true }));
    await activate(panel
        .getByRole("button", { name: "Review final settlement", exact: true }));
    await activate(page
        .getByRole("dialog", { name: "Review final settlement", exact: true })
        .getByRole("button", { name: "Finalize charges" }));
    await page.reload();
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
    await expect(panel).toContainText("Final charges · collections remain open");
    await activate(row("Phinky")
        .getByRole("button", { name: "Pay Phinky", exact: true }));
    await activate(page.getByRole("button", { name: "Cash", exact: true }));
    await expect(panel.getByRole("status")).toContainText("Phinky · ₱220.00 received · Cash");
    await activate(panel.getByText("Paid", { exact: true }));
    await expect(panel.getByTestId("payment-player")).toHaveCount(2);
    await page.screenshot({
        path: testInfo.outputPath("payments.png"),
        animations: "disabled",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test(`large billing preview keeps actions visible in dark mode`, async ({ page, }, testInfo) => {
    const mobile = (page.viewportSize()?.width ?? 1440) < 576;
    await page.clock.setFixedTime(new Date(1800000000000));
    let data = initialSession(1800000000000);
    for (let i = 1; i <= 30; i++)
        data = transition(data, {
            type: "addPlayer",
            id: `p${i}`,
            values: {
                name: i === 30
                    ? "Player 30 with a very long display name"
                    : `Player ${i}`,
                gender: "Male",
                level: "Intermediate",
            },
        }, 1800000000000);
    data = transition(data, {
        type: "setExpenses",
        values: {
            courtFee: 906150,
            tubePrice: 0,
            piecesPerTube: 12,
            tubes: 0,
            pieces: 0,
        },
    }, 1800000000000);
    await page.addInitScript((data) => {
        localStorage.setItem("badminton_queue_appearance", JSON.stringify({ color: "emerald", mode: "dark" }));
        localStorage.setItem("badminton_queue_density", "comfortable");
        localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ version: 1, data }));
    }, data);
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
    const panel = page.getByRole("dialog", { name: "Payments", exact: true });
    await activate(panel.getByRole("tab", { name: "Billing", exact: true }));
    await activate(panel
        .getByRole("button", { name: "Set billing for players", exact: true }));
    const modal = page.getByRole("dialog", {
        name: "Set billing for players",
        exact: true,
    });
    const apply = modal.getByRole("button", {
        name: "Apply billing",
        exact: true,
    });
    const footer = modal.getByTestId("bulk-billing-footer");
    await expect(modal).toContainText("Apply to 30 players");
    await expect(footer).toContainText("₱9,061.50");
    await expect(apply).toBeInViewport();
    const bounds = await apply.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    const preview = modal.getByRole("region", {
        name: "Player charge preview",
    });
    await expect(modal.getByTestId("bulk-player-preview")).toHaveCount(5);
    await modal
        .getByRole("spinbutton", { name: "Amount per player (PHP)" })
        .fill("270");
    await expect(footer).toContainText("₱8,100.00");
    await modal
        .getByRole("textbox", { name: "Search billing preview" })
        .fill("Player 30");
    await expect(modal.getByTestId("bulk-player-preview")).toHaveCount(1);
    await expect(modal.getByTestId("bulk-player-preview")).toContainText("₱270.00");
    await modal
        .getByRole("textbox", { name: "Search billing preview" })
        .fill("");
    if (mobile) {
        const pager = modal.locator(".ant-pagination-simple-pager input");
        await pager.fill("6");
        await pager.press("Enter");
    }
    else
        await activate(modal.locator('.ant-pagination-item[title="6"]'));
    await preview.scrollIntoViewIfNeeded();
    await expect(modal.getByTestId("bulk-player-preview").last()).toBeInViewport();
    const lastPlayer = modal.getByTestId("bulk-player-preview").last();
    await lastPlayer.getByRole("checkbox").uncheck();
    await expect(modal).toContainText("Apply to 29 players");
    await expect(lastPlayer).toContainText("No charge");
    await lastPlayer.getByRole("checkbox").check();
    await expect(modal).toContainText("Apply to 30 players");
    await expect(apply).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
        path: testInfo.outputPath("bulk-billing-dark.png"),
        animations: "disabled",
    });
    await activate(modal.getByRole("button", { name: "Cancel", exact: true }));
    await expect(modal).not.toBeVisible();
    await activate(panel.getByRole("tab", { name: "Costs", exact: true }));
    const exclusions = panel.getByRole("combobox", {
        name: "Exclude from cost calculation",
    });
    for (const name of ["Player 1", "Player 2", "Player 3"]) {
        await exclusions.fill(name);
        await expect(page.locator(".ant-select-item-option-active")).toHaveAttribute("title", name);
        await exclusions.press("Enter");
    }
    await exclusions.press("Escape");
    await activate(panel
        .getByRole("button", { name: "Continue to set billing", exact: true }));
    await expect(modal).toContainText("Apply to 27 players");
    for (const name of ["Player 1", "Player 2", "Player 3"]) {
        await expect(modal
            .getByTestId("bulk-player-preview")
            .filter({ has: page.getByText(name, { exact: true }) })).toContainText("Excluded");
    }
    await activate(modal.getByRole("button", { name: "Cancel", exact: true }));
    await expect(modal).not.toBeVisible();
});
test(`failed quick payments retry without duplicate receipts`, async ({ page, }, testInfo) => {
    await page.clock.setFixedTime(new Date(1800000000000));
    let data = initialSession(1800000000000);
    for (let i = 0; i < 25; i++) {
        data = transition(data, {
            type: "addPlayer",
            id: `p${i}`,
            values: {
                name: i === 0
                    ? "Player with a very long display name for checking readable rows"
                    : `Player ${i}`,
                gender: "Male",
                level: "Intermediate",
            },
        }, 1800000000000);
        data = transition(data, {
            type: "setArrangement",
            playerId: `p${i}`,
            values: { kind: "shared", adjustment: "fixed", amount: 22000 },
        }, 1800000000000);
    }
    await page.addInitScript((data) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ version: 1, data })), data);
    await page.goto("/queuing");
    await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await activate(page.getByRole("button", { name: "Payments", exact: true }));
    const panel = page.getByRole("dialog", { name: "Payments", exact: true });
    await page.screenshot({
        path: testInfo.outputPath("collection.png"),
        animations: "disabled",
    });
    const pay = panel.getByRole("button", {
        name: "Pay Player 24",
        exact: true,
    });
    await activate(pay);
    const cash = page.getByRole("button", { name: "Cash", exact: true });
    await expect(cash).toBeInViewport();
    await expect
        .poll(async () => (await cash.boundingBox())?.height ?? 0)
        .toBeGreaterThanOrEqual(44);
    await page.screenshot({
        path: testInfo.outputPath("quick-pay.png"),
        animations: "disabled",
    });
    // Fail an actual storage write once, leaving subsequent retry available.
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function () {
            IDBObjectStore.prototype.put = original;
            throw new Error("Test payment write failed");
        };
    });
    await activate(cash);
    await expect(page
        .getByRole("alert")
        .filter({ hasText: "Test payment write failed" })
        .last()).toBeVisible();
    await expect(cash).toBeEnabled();
    await expect(panel.getByRole("status")).toHaveCount(0);
    await expect(panel
        .getByTestId("payment-player")
        .filter({ has: page.getByText("Player 24", { exact: true }) })).toContainText("No payment");
    const scrollBefore = await panel
        .locator(".ant-drawer-body")
        .evaluate((el) => el.scrollTop);
    // Dispatch two clicks in the same turn to exercise the synchronous save guard.
    await cash.evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
    });
    await expect(panel.getByRole("status")).toContainText("Player 24 · ₱220.00 received · Cash");
    await expect
        .poll(async () => panel.locator(".ant-drawer-body").evaluate((el) => el.scrollTop))
        .toBe(scrollBefore);
    await activate(panel.getByText("Paid", { exact: true }));
    await activate(panel
        .getByRole("button", { name: "Details for Player 24", exact: true }));
    const detail = page.getByRole("dialog", {
        name: "Payment details · Player 24",
        exact: true,
    });
    await expect(detail).toContainText("Payment history (1)");
    await activate(detail.getByRole("button", { name: "Close", exact: true }));
    await activate(panel.getByText("To collect", { exact: true }));
    await activate(panel
        .getByRole("button", { name: "Pay Player 23", exact: true }));
    await cash.focus();
    await page.keyboard.press("Escape");
    await expect(cash).not.toBeVisible();
    // Exact trigger-focus restoration is retained in the isolated PAY-003 defect test.
    // The preserved baseline spec still contains its original assertion.
    await expect(panel.getByRole("textbox", { name: "Search payments" })).toBeInViewport();
});

// Use the actual input modality of each project; keep native double-click guard probes unchanged.
async function activate(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}
