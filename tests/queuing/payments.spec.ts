import { test, expect } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

for (const mobile of [false, true])
  test(`manual bulk billing and mixed payments (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    let data = initialSession(Date.now());
    for (const name of [
      "Aaron",
      "Phinky",
      "Dan",
      "Flor",
      "Cloyd",
      "Anj",
      "Kayth",
      "Jans",
    ])
      data = transition(
        data,
        {
          type: "addPlayer",
          id: name,
          values: { name, gender: "Male", level: "Intermediate" },
        },
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
      panel.getByTestId("payment-player").filter({
        has: page.locator(".ant-card-head").getByText(name, { exact: true }),
      });
    await panel
      .getByRole("spinbutton", { name: "Court fees (PHP)" })
      .fill("1000");
    await panel
      .getByRole("spinbutton", { name: "Price per tube (PHP)" })
      .fill("845");
    await panel
      .getByRole("spinbutton", { name: "Tubes used", exact: true })
      .fill("1");
    await expect(panel.getByTestId("cost-estimate")).toContainText(
      "₱1,845.00 ÷ 8 players = ₱230.63 each",
    );
    await panel
      .getByRole("combobox", { name: "Exclude from cost calculation" })
      .click();
    await page
      .locator(".ant-select-item-option")
      .filter({ hasText: /^Aaron$/ })
      .click();
    await panel
      .getByRole("combobox", { name: "Exclude from cost calculation" })
      .press("Escape");
    const estimate = panel.getByTestId("cost-estimate");
    await expect(estimate).toContainText(
      "₱1,845.00 ÷ 7 players = ₱263.57 each",
    );
    await expect(row("Jans")).toContainText("Unassigned");
    await estimate.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("calculator-guide.png"),
      animations: "disabled",
    });
    await panel
      .getByRole("button", { name: "Continue to set billing", exact: true })
      .click();
    const bulk = page.getByRole("dialog", {
      name: "Set billing for players",
      exact: true,
    });
    await expect(
      bulk.getByRole("spinbutton", { name: "Amount per player (PHP)" }),
    ).toHaveValue("263.57");
    await expect(bulk).toContainText("Calculator guide: ₱263.57 per player");
    await expect(bulk).toContainText("Apply to 7 players");
    await expect(
      bulk.getByTestId("bulk-player-preview").filter({ hasText: "Aaron" }),
    ).toContainText("Excluded");
    // Exclusions carried from the calculator can be changed without changing the guide.
    await bulk
      .getByRole("combobox", { name: "Exclude from bulk billing" })
      .click();
    await page
      .locator(".ant-select-item-option:visible")
      .filter({ hasText: /^Aaron$/ })
      .click();
    await bulk
      .getByRole("combobox", { name: "Exclude from bulk billing" })
      .press("Escape");
    await expect(bulk).toContainText("Apply to 8 players");
    await bulk.getByRole("button", { name: "Close", exact: true }).click();
    await expect(bulk).not.toBeVisible();
    await expect(row("Jans")).toContainText("Unassigned");
    await panel
      .getByRole("button", { name: "Continue to set billing", exact: true })
      .click();
    await bulk
      .getByRole("button", { name: "Use ₱270.00", exact: true })
      .click();
    await expect(
      bulk.getByRole("spinbutton", { name: "Amount per player (PHP)" }),
    ).toHaveValue("270.00");
    await expect(bulk).toContainText("Apply to 7 players");
    await bulk
      .getByRole("button", { name: "Apply billing", exact: true })
      .click();
    await expect(bulk).not.toBeVisible();
    await expect(row("Aaron")).toContainText("No charge");
    await expect(row("Phinky")).toContainText("₱270.00");
    await panel
      .getByRole("button", { name: "Set billing for players", exact: true })
      .click();
    await expect(bulk).toContainText("Apply to 7 players");
    await bulk.getByRole("button", { name: "Close", exact: true }).click();
    await expect(bulk).not.toBeVisible();
    await expect(row("Aaron")).toContainText("No charge");
    await row("Jans")
      .getByRole("button", { name: "Set billing", exact: true })
      .click();
    const billing = page.getByRole("dialog", {
      name: "Billing · Jans",
      exact: true,
    });
    await billing
      .getByRole("spinbutton", { name: "Discount (PHP)" })
      .fill("50");
    await billing.getByLabel("Billing note").fill("Student discount");
    await expect(billing).toContainText("Amount due: ₱220.00");
    await billing
      .getByRole("button", { name: "Save billing", exact: true })
      .click();
    await expect(billing).not.toBeVisible();
    await expect(row("Jans")).toContainText("₱220.00");
    await expect(panel).toContainText("₱1,840.00");
    await row("Jans")
      .getByRole("button", { name: "Record payment", exact: true })
      .click();
    const deposit = page.getByRole("dialog", {
      name: "Record payment · Jans",
      exact: true,
    });
    await deposit
      .getByRole("spinbutton", { name: "Payment amount (PHP)" })
      .fill("100");
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
    await row("Jans")
      .getByRole("button", { name: "Mark fully paid", exact: true })
      .click();
    const full = page.getByRole("dialog", {
      name: "Mark fully paid · Jans",
      exact: true,
    });
    await expect(
      full.getByRole("spinbutton", { name: "Payment amount (PHP)" }),
    ).toHaveValue("120.00");
    await full
      .getByRole("button", { name: "Save payment", exact: true })
      .click();
    await expect(full).not.toBeVisible();
    await expect(row("Jans")).toContainText("Fully paid");
    await panel
      .getByRole("spinbutton", { name: "Court fees (PHP)" })
      .fill("1200");
    await expect(estimate).toContainText(
      "₱2,045.00 ÷ 7 players = ₱292.14 each",
    );
    await expect(row("Jans")).toContainText("Fully paid");
    await panel
      .getByRole("button", { name: "Save estimate", exact: true })
      .click();
    await expect(panel.getByText("₱205.00", { exact: true })).toBeVisible();
    await expect(row("Jans")).toContainText("Fully paid");
    await expect(row("Jans")).toContainText("₱220.00");
    await expect(row("Phinky")).toContainText("₱270.00");
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
    await panel
      .getByRole("button", { name: "Review final settlement", exact: true })
      .click();
    const review = page.getByRole("dialog", {
      name: "Review final settlement",
      exact: true,
    });
    await expect(review).toContainText(
      "Start estimate ₱220.00 → Final ₱220.00",
    );
    await review.getByRole("button", { name: "Finalize charges" }).click();
    await expect(review).not.toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Payments", exact: true }).click();
    await expect(panel).toContainText(
      "Final charges · collections remain open",
    );
    await expect(row("Jans")).toContainText("Fully paid");
    await expect(row("Aaron")).toContainText("No charge");
    await row("Jans").getByText("Payment history (2)").click();
    await expect(row("Jans")).toContainText("Cash");
    await expect(row("Jans")).toContainText("Digital");
    await row("Jans").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("payments.png"),
      animations: "disabled",
    });
    if (mobile)
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
    await expect(panel.getByTestId("payment-player").first()).toContainText(
      "Unassigned",
    );
    const exclusions = panel.getByRole("combobox", {
      name: "Exclude from cost calculation",
    });
    for (const name of ["Player 1", "Player 2", "Player 3"]) {
      await exclusions.fill(name);
      await expect(page.locator(".ant-select-item-option-active")).toHaveAttribute("title", name);
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
