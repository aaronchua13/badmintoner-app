import { test, expect } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

for (const mobile of [false, true])
  test(`collection-first payments, corrections and settlement (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    let data = initialSession(Date.now());
    for (const name of ["Aaron", "Phinky", "Jans", "Unassigned player"]) {
      data = transition(
        data,
        {
          type: "addPlayer",
          id: name,
          values: { name, gender: "Male", level: "Intermediate" },
        },
        Date.now(),
      );
    }
    for (const name of ["Phinky", "Jans"])
      data = transition(
        data,
        {
          type: "setArrangement",
          playerId: name,
          values: { kind: "shared", adjustment: "fixed", amount: 22000 },
        },
        Date.now(),
      );
    data = transition(
      data,
      { type: "setArrangement", playerId: "Aaron", values: { kind: "none" } },
      Date.now(),
    );
    await page.addInitScript((data) => {
      if (!localStorage.getItem("badminton_queue_data_v2"))
        localStorage.setItem(
          "badminton_queue_data_v2",
          JSON.stringify({ version: 1, data }),
        );
    }, data);
    await page.goto("/queuing");
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Payments", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Payments", exact: true });
    const row = (name: string) =>
      panel
        .getByTestId("payment-player")
        .filter({ has: page.getByText(name, { exact: true }) });
    await expect(
      panel.getByRole("textbox", { name: "Search payments" }),
    ).toBeInViewport();
    await expect(
      panel.getByRole("spinbutton", { name: "Court fees (PHP)" }),
    ).toHaveCount(0);
    await expect(panel.getByTestId("payment-player")).toHaveCount(2);
    await expect(panel).toContainText("1 player needs billing");
    await panel
      .getByRole("button", { name: "Set billing", exact: true })
      .click();
    await panel
      .getByTestId("billing-player")
      .filter({ hasText: "Jans" })
      .getByRole("button", { name: "Edit billing for Jans", exact: true })
      .click();
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
    await individualBill
      .getByRole("button", { name: "Save billing", exact: true })
      .click();
    await panel.getByRole("tab", { name: "Collect", exact: true }).click();

    await row("Jans")
      .getByRole("button", { name: "Pay Jans", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Other amount", exact: true })
      .click();
    const deposit = page.getByRole("dialog", {
      name: "Record payment · Jans",
      exact: true,
    });
    await deposit
      .getByRole("spinbutton", { name: "Payment amount (PHP)" })
      .fill("100");
    await expect(deposit.getByLabel("Payment date and time")).not.toBeVisible();
    await deposit.getByRole("combobox", { name: "Payment method" }).click();
    await page
      .locator(".ant-select-item-option")
      .filter({ hasText: /^Digital$/ })
      .click();
    await deposit
      .getByRole("button", { name: "Save payment", exact: true })
      .click();
    await expect(deposit).not.toBeVisible();
    await expect(row("Jans")).toContainText("Partially paid");
    await expect(row("Jans")).toContainText("₱120.00");
    await row("Jans")
      .getByRole("button", { name: "Pay Jans", exact: true })
      .click();
    await page.getByRole("button", { name: "Cash", exact: true }).click();
    await expect(panel.getByRole("status")).toContainText(
      "Jans · ₱120.00 received · Cash",
    );
    await expect(row("Jans")).toHaveCount(0);
    await expect(
      panel.getByRole("textbox", { name: "Search payments" }),
    ).toBeFocused();
    await panel
      .getByRole("button", { name: "Review payment", exact: true })
      .click();
    const edit = page.getByRole("dialog", { name: "Edit payment · Jans" });
    await edit
      .getByRole("spinbutton", { name: "Payment amount (PHP)" })
      .fill("110");
    await edit
      .getByRole("button", { name: "Save payment", exact: true })
      .click();
    await expect(row("Jans")).toContainText("₱10.00");
    await row("Jans")
      .getByRole("button", { name: "Pay Jans", exact: true })
      .click();
    await page.getByRole("button", { name: "Digital", exact: true }).click();
    await expect(panel.getByRole("status")).toContainText(
      "₱10.00 received · Digital",
    );
    await panel.getByText("All", { exact: true }).click();
    await expect(row("Jans")).toContainText("Fully paid");
    await expect(
      row("Jans").getByRole("button", { name: "Pay Jans", exact: true }),
    ).toHaveCount(0);
    await expect(
      row("Aaron").getByRole("button", { name: "Pay Aaron", exact: true }),
    ).toHaveCount(0);
    await row("Jans").getByRole("button", { name: "Details for Jans" }).click();
    const details = page.getByRole("dialog", {
      name: "Payment details · Jans",
    });
    await details.getByText("Payment history (3)").click();
    await expect(details).toContainText("Cash");
    await expect(details).toContainText("Digital");
    await details.getByRole("button", { name: "Close", exact: true }).click();
    await panel.getByRole("tab", { name: "Costs", exact: true }).click();
    await panel
      .getByRole("spinbutton", { name: "Court fees (PHP)" })
      .fill("1000");
    await expect(panel.getByTestId("cost-estimate")).toContainText(
      "₱1,000.00 ÷ 4 players = ₱250.00 each",
    );
    await panel
      .getByRole("button", { name: "Save estimate", exact: true })
      .click();
    await panel.getByRole("tab", { name: "Billing", exact: true }).click();
    const unassigned = panel
      .getByTestId("billing-player")
      .filter({ hasText: "Unassigned player" });
    await unassigned
      .getByRole("button", {
        name: "Set billing for Unassigned player",
        exact: true,
      })
      .click();
    const billing = page.getByRole("dialog", {
      name: "Billing · Unassigned player",
      exact: true,
    });
    await billing
      .getByRole("spinbutton", { name: "Charge amount", exact: true })
      .fill("220");
    await billing
      .getByRole("button", { name: "Save billing", exact: true })
      .click();
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("button", { name: "Start Session", exact: true })
      .click();
    await page.getByRole("button", { name: "Session menu" }).click();
    await page
      .getByRole("menuitem", { name: "Stop session", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "End this session?" })
      .getByRole("button", { name: "Stop session", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Session Summary" })
      .getByRole("button", { name: "Review payments" })
      .click();
    await panel.getByRole("tab", { name: "Billing", exact: true }).click();
    await panel
      .getByRole("button", { name: "Review final settlement", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Review final settlement", exact: true })
      .getByRole("button", { name: "Finalize charges" })
      .click();
    await page.reload();
    await page.getByRole("button", { name: "Payments", exact: true }).click();
    await expect(panel).toContainText(
      "Final charges · collections remain open",
    );
    await row("Phinky")
      .getByRole("button", { name: "Pay Phinky", exact: true })
      .click();
    await page.getByRole("button", { name: "Cash", exact: true }).click();
    await expect(panel.getByRole("status")).toContainText(
      "Phinky · ₱220.00 received · Cash",
    );
    await panel.getByText("Paid", { exact: true }).click();
    await expect(panel.getByTestId("payment-player")).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath("payments.png"),
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

for (const mobile of [false, true])
  test(`large billing preview keeps actions visible in dark mode (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1366, height: 700 },
    );
    let data = initialSession(Date.now());
    for (let i = 1; i <= 30; i++)
      data = transition(
        data,
        {
          type: "addPlayer",
          id: `p${i}`,
          values: {
            name:
              i === 30
                ? "Player 30 with a very long display name"
                : `Player ${i}`,
            gender: "Male",
            level: "Intermediate",
          },
        },
        Date.now(),
      );
    data = transition(
      data,
      {
        type: "setExpenses",
        values: {
          courtFee: 906150,
          tubePrice: 0,
          piecesPerTube: 12,
          tubes: 0,
          pieces: 0,
        },
      },
      Date.now(),
    );
    await page.addInitScript((data) => {
      localStorage.setItem(
        "badminton_queue_appearance",
        JSON.stringify({ color: "emerald", mode: "dark" }),
      );
      localStorage.setItem("badminton_queue_density", "comfortable");
      localStorage.setItem(
        "badminton_queue_data_v2",
        JSON.stringify({ version: 1, data }),
      );
    }, data);
    await page.goto("/queuing");
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Payments", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Payments", exact: true });
    await panel.getByRole("tab", { name: "Billing", exact: true }).click();
    await panel
      .getByRole("button", { name: "Set billing for players", exact: true })
      .click();
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
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
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
    await expect(modal.getByTestId("bulk-player-preview")).toContainText(
      "₱270.00",
    );
    await modal
      .getByRole("textbox", { name: "Search billing preview" })
      .fill("");
    if (mobile) {
      const pager = modal.locator(".ant-pagination-simple-pager input");
      await pager.fill("6");
      await pager.press("Enter");
    } else await modal.locator('.ant-pagination-item[title="6"]').click();
    await preview.scrollIntoViewIfNeeded();
    await expect(
      modal.getByTestId("bulk-player-preview").last(),
    ).toBeInViewport();
    const lastPlayer = modal.getByTestId("bulk-player-preview").last();
    await lastPlayer.getByRole("checkbox").uncheck();
    await expect(modal).toContainText("Apply to 29 players");
    await expect(lastPlayer).toContainText("No charge");
    await lastPlayer.getByRole("checkbox").check();
    await expect(modal).toContainText("Apply to 30 players");
    await expect(apply).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("bulk-billing-dark.png"),
      animations: "disabled",
    });
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(modal).not.toBeVisible();
    await panel.getByRole("tab", { name: "Costs", exact: true }).click();
    const exclusions = panel.getByRole("combobox", {
      name: "Exclude from cost calculation",
    });
    for (const name of ["Player 1", "Player 2", "Player 3"]) {
      await exclusions.fill(name);
      await expect(
        page.locator(".ant-select-item-option-active"),
      ).toHaveAttribute("title", name);
      await exclusions.press("Enter");
    }
    await exclusions.press("Escape");
    await panel
      .getByRole("button", { name: "Continue to set billing", exact: true })
      .click();
    await expect(modal).toContainText("Apply to 27 players");
    for (const name of ["Player 1", "Player 2", "Player 3"]) {
      await expect(
        modal
          .getByTestId("bulk-player-preview")
          .filter({ has: page.getByText(name, { exact: true }) }),
      ).toContainText("Excluded");
    }
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(modal).not.toBeVisible();
  });

for (const mobile of [false, true])
  test(`failed quick payments retry without duplicate receipts (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    let data = initialSession(Date.now());
    for (let i = 0; i < 25; i++) {
      data = transition(
        data,
        {
          type: "addPlayer",
          id: `p${i}`,
          values: {
            name:
              i === 0
                ? "Player with a very long display name for checking readable rows"
                : `Player ${i}`,
            gender: "Male",
            level: "Intermediate",
          },
        },
        Date.now(),
      );
      data = transition(
        data,
        {
          type: "setArrangement",
          playerId: `p${i}`,
          values: { kind: "shared", adjustment: "fixed", amount: 22000 },
        },
        Date.now(),
      );
    }
    await page.addInitScript(
      (data) =>
        localStorage.setItem(
          "badminton_queue_data_v2",
          JSON.stringify({ version: 1, data }),
        ),
      data,
    );
    await page.goto("/queuing");
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Payments", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Payments", exact: true });
    await page.screenshot({
      path: testInfo.outputPath("collection.png"),
      animations: "disabled",
    });
    const pay = panel.getByRole("button", {
      name: "Pay Player 24",
      exact: true,
    });
    await pay.click();
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
    await cash.click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Test payment write failed" })
        .last(),
    ).toBeVisible();
    await expect(cash).toBeEnabled();
    await expect(panel.getByRole("status")).toHaveCount(0);
    await expect(
      panel
        .getByTestId("payment-player")
        .filter({ has: page.getByText("Player 24", { exact: true }) }),
    ).toContainText("No payment");
    const scrollBefore = await panel
      .locator(".ant-drawer-body")
      .evaluate((el) => el.scrollTop);
    // Dispatch two clicks in the same turn to exercise the synchronous save guard.
    await cash.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect(panel.getByRole("status")).toContainText(
      "Player 24 · ₱220.00 received · Cash",
    );
    await expect
      .poll(async () =>
        panel.locator(".ant-drawer-body").evaluate((el) => el.scrollTop),
      )
      .toBe(scrollBefore);
    await panel.getByText("Paid", { exact: true }).click();
    await panel
      .getByRole("button", { name: "Details for Player 24", exact: true })
      .click();
    const detail = page.getByRole("dialog", {
      name: "Payment details · Player 24",
      exact: true,
    });
    await expect(detail).toContainText("Payment history (1)");
    await detail.getByRole("button", { name: "Close", exact: true }).click();
    await panel.getByText("To collect", { exact: true }).click();
    await panel
      .getByRole("button", { name: "Pay Player 23", exact: true })
      .click();
    await cash.focus();
    await page.keyboard.press("Escape");
    await expect(cash).not.toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Pay Player 23", exact: true }),
    ).toBeFocused();
    await expect(
      panel.getByRole("textbox", { name: "Search payments" }),
    ).toBeInViewport();
  });
