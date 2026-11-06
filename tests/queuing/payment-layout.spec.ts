import { test, expect } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

for (const mode of ["light", "dark"])
  for (const width of [320, 390, 576, 768, 1440])
    test(`payment tables contain actions and align charges (${mode}, ${width}px)`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      let data = initialSession(Date.now());
      for (const [id, name] of [
        ["allan", "Allan"],
        ["sam", "Sam with a long display name that needs to wrap"],
        ["bing", "Bing"],
      ]) {
        data = transition(
          data,
          {
            type: "addPlayer",
            id,
            values: { name, gender: "Male", level: "Intermediate" },
          },
          Date.now(),
        );
        if (id !== "bing")
          data = transition(
            data,
            {
              type: "setArrangement",
              playerId: id,
              values: {
                kind: "shared",
                adjustment: "fixed",
                amount: id === "allan" ? 29000 : 500000000,
              },
            },
            Date.now(),
          );
      }
      await page.addInitScript(
        ({ data, mode }) => {
          localStorage.setItem(
            "badminton_queue_data_v2",
            JSON.stringify({ version: 1, data }),
          );
          localStorage.setItem(
            "badminton_queue_appearance",
            JSON.stringify({ color: "emerald", mode }),
          );
          localStorage.setItem("badminton_queue_density", "comfortable");
        },
        { data, mode },
      );
      await page.goto("/queuing");
      await expect(
        page.getByText("Saved on this device", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Payments", exact: true }).click();
      const panel = page.getByRole("dialog", { name: "Payments", exact: true });
      await panel.getByRole("tab", { name: "Billing", exact: true }).click();
      if (width >= 576)
        await expect(
          panel.getByRole("columnheader", { name: "Actions", exact: true }),
        ).toBeVisible();
      await expect(
        panel.getByRole("button", {
          name: "Edit billing for Allan",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", {
          name: "Set billing for Bing",
          exact: true,
        }),
      ).toBeVisible();
      const geometry = await panel
        .getByTestId("billing-player")
        .evaluateAll((rows) =>
          rows.map((row) => {
            const cells = row.querySelectorAll("td");
            const cell = cells[cells.length - 1] ?? row;
            const button = cell.querySelector("button")!;
            const bounds = button.getBoundingClientRect();
            const parent = cell.getBoundingClientRect();
            return {
              left: bounds.left - parent.left,
              right: parent.right - bounds.right,
              height: bounds.height,
              chargeAlign: getComputedStyle(
                cells[1] ?? row.querySelector("strong")!.parentElement!,
              ).textAlign,
              overflow: row.scrollWidth - row.clientWidth,
            };
          }),
        );
      expect(geometry).toHaveLength(3);
      for (const row of geometry) {
        expect(row.left).toBeGreaterThanOrEqual(0);
        expect(row.right).toBeGreaterThanOrEqual(0);
        expect(row.height).toBeGreaterThanOrEqual(44);
        expect(row.chargeAlign).toBe("right");
        expect(row.overflow).toBeLessThanOrEqual(1);
      }
      await expect(panel.locator(".ant-drawer-body")).toHaveJSProperty(
        "scrollWidth",
        await panel
          .locator(".ant-drawer-body")
          .evaluate((el) => el.clientWidth),
      );
      await page.screenshot({
        path: testInfo.outputPath("billing.png"),
        animations: "disabled",
      });
      if (width >= 768) {
        await panel.getByRole("tab", { name: "Collect", exact: true }).click();
        await expect(
          panel.getByRole("columnheader", { name: "Actions", exact: true }),
        ).toBeVisible();
        const overflow = await panel.locator("tbody > tr").evaluateAll((rows) =>
          rows.some((row) => {
            const cell = row.querySelector("td:last-child")!;
            const bounds = cell.getBoundingClientRect();
            return [...cell.querySelectorAll("button")].some((button) => {
              const rect = button.getBoundingClientRect();
              return rect.left < bounds.left || rect.right > bounds.right;
            });
          }),
        );
        expect(overflow).toBe(false);
      }
    });
