import { test, expect } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";

test("summary table numbering continues across pages, including after sorting", async ({ page }) => {
  let data = initialSession(Date.now());
  for (let i = 0; i < 25; i++) {
    data = transition(data, {
      type: "addPlayer", id: `p${i}`,
      values: { name: `Player ${i + 1}`, gender: "Male", level: "Intermediate" },
    }, Date.now());
  }
  await page.addInitScript((data) => {
    localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ version: 1, data }));
  }, data);
  await page.goto("/queuing");
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  const summary = page.getByRole("dialog", { name: "Session Summary" });
  const ranks = summary.locator("tbody tr.ant-table-row td:first-child");
  await expect(ranks.first()).toHaveText("1");
  await expect(ranks.last()).toHaveText("10");
  await summary.locator('.ant-pagination-item[title="2"]').click();
  await expect(ranks.first()).toHaveText("11");
  await expect(ranks.last()).toHaveText("20");
  await summary.locator('.ant-pagination-item[title="3"]').click();
  await expect(ranks.first()).toHaveText("21");
  await expect(ranks.last()).toHaveText("25");
  await summary.getByRole("columnheader", { name: "Games" }).click();
  await expect(ranks.first()).toHaveText("21");
  await expect(ranks.last()).toHaveText("25");
  await summary.locator('.ant-pagination-item[title="2"]').click();
  await expect(ranks.first()).toHaveText("11");
  await summary.locator('.ant-pagination-item[title="1"]').click();
  await expect(ranks.first()).toHaveText("1");
});
