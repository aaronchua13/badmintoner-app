import { test, expect, Page } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";
function fixture(playerCount = 8, courtCount = 2) {
  let state = initialSession(Date.now());
  for (let i = 0; i < playerCount; i++) {
    state = transition(
      state,
      {
        type: "addPlayer",
        id: `p${i}`,
        values: {
          name: i === 0 ? "Alexandria Verylonglastname" : `Player ${i + 1}`,
          gender: i % 2 ? "Male" : "Female",
          level: "Intermediate",
        },
      },
      Date.now(),
    );
    state = transition(
      state,
      { type: "checkInPlayer", id: `p${i}` },
      Date.now(),
    );
  }
  for (let i = 2; i < courtCount; i++)
    state = transition(
      state,
      { type: "addCourt", id: `c${i + 1}`, name: `Court ${i + 1}` },
      Date.now(),
    );
  return state;
}
async function seed(page: Page, players = 8, courts = 2) {
  await page.addInitScript(
    (data) => {
      if (!localStorage.getItem("badminton_queue_data_v2"))
        localStorage.setItem(
          "badminton_queue_data_v2",
          JSON.stringify({ version: 1, data }),
        );
    },
    fixture(players, courts),
  );
}
async function ready(page: Page) {
  await page.goto("/queuing");
  await expect(page.getByText("Saved on this device")).toBeVisible();
}
async function menu(page: Page, name: string) {
  await page.getByRole("button", { name: "Session menu" }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
async function addPlayer(page: Page, name: string) {
  await page.getByRole("button", { name: "Add Player", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Add New Player" });
  await modal.getByLabel("Player Name").fill(name);
  await modal.getByRole("button", { name: "OK", exact: true }).click();
  await expect(modal).not.toBeVisible();
}
test("setup, queue, play, zero score, session summary and reload", async ({
  page,
}) => {
  await seed(page);
  await ready(page);
  await addPlayer(page, "New Player");
  await page.getByRole("button", { name: "Add Court", exact: true }).click();
  const courtDialog = page.getByRole("dialog", {
    name: "Add Court",
    exact: true,
  });
  await courtDialog.getByLabel("Court Name").fill("Practice Court");
  await courtDialog.getByRole("button", { name: "OK" }).click();
  await expect(courtDialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Start Session", exact: true })
    .click();
  await page.getByRole("button", { name: "Create Match", exact: true }).click();
  for (const name of [
    "Alexandria Verylonglastname",
    "Player 2",
    "Player 3",
    "Player 4",
  ]) {
    await page.getByRole("textbox", { name: "Search players" }).fill(name);
    const row = page
      .locator('[data-testid="player-row"]')
      .filter({ hasText: name });
    await row.getByRole("button", { name: "Queue", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Assign to Queue" });
    await dialog.getByRole("button", { name: /Queue 1/ }).click();
    await dialog
      .getByRole("button", { name: "Add to Queue", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Search players" }),
    ).toHaveValue("");
    await expect(
      page.getByRole("textbox", { name: "Search players" }),
    ).toBeFocused();
  }
  await page
    .getByRole("button", { name: "Assign to court", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Court 1", exact: true }).click();
  const court = page.getByRole("article", { name: "Court 1", exact: true });
  await court.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(court.getByText("Playing", { exact: true })).toBeVisible();
  await menu(page, "Stop session");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Stop session", exact: true })
    .click();
  await expect(
    page
      .getByText("Finish or stop matches on Court 1 first", { exact: true })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel" })
    .click();
  await court.getByRole("button", { name: "Finish Match" }).click();
  const finish = page.getByRole("dialog", { name: "Finish Match" });
  await finish.getByRole("spinbutton").nth(0).fill("21");
  await finish.getByRole("spinbutton").nth(1).fill("0");
  await expect(finish.getByRole("radio", { name: "Team 1", exact: true })).toBeChecked();
  await finish.getByRole("button", { name: "OK" }).click();
  await expect(finish).not.toBeVisible();
  await expect(page.locator(".ant-modal-wrap:visible")).toHaveCount(0);
  await menu(page, "Stop session");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Stop session", exact: true })
    .click();
  await expect(page.getByText("Session ended", { exact: true })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Session Summary", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await page.reload();
  await expect(page.getByText("Session ended", { exact: true })).toBeVisible();
  await menu(page, "Match history");
  await expect(
    page.getByRole("dialog").getByText("21 - 0", { exact: true }),
  ).toBeVisible();
});
test("simultaneous tabs retain both edits", async ({ page, context }) => {
  await ready(page);
  const other = await context.newPage();
  await ready(other);
  await Promise.all([addPlayer(page, "Tab One"), addPlayer(other, "Tab Two")]);
  for (const tab of [page, other]) {
    await expect(tab.getByRole("button", { name: /^(?:Male |Female )?Tab One$/ })).toBeVisible();
    await expect(tab.getByRole("button", { name: /^(?:Male |Female )?Tab Two$/ })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole("button", { name: /^(?:Male |Female )?Tab One$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(?:Male |Female )?Tab Two$/ })).toBeVisible();
});
test("invalid import leaves the existing roster intact", async ({ page }) => {
  await seed(page);
  await ready(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...fixture(), courts: [{}] })),
  });
  await expect(page.getByText(/Invalid data:/)).toBeVisible();
  await expect(page.locator('[data-testid="player-row"]')).toHaveCount(8);
});
test("offline reopen retains session and APIs are not cached", async ({
  page,
  context,
}) => {
  await seed(page);
  await ready(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.evaluate(async () => {
    await fetch("/api/ping?t=regression");
  });
  const cacheUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    return (
      await Promise.all(
        names.map(async (n) =>
          (await (await caches.open(n)).keys()).map((r) => r.url),
        ),
      )
    ).flat();
  });
  expect(cacheUrls.some((url) => url.includes("/api/"))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /^Players/ })).toBeVisible();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await expect(page.locator('[data-testid="player-row"]')).toHaveCount(8);
  await context.setOffline(false);
});
test("density persists, preserves search and leaves an open dialog mounted", async ({
  page,
}) => {
  await seed(page);
  await ready(page);
  await page
    .getByRole("textbox", { name: "Search players" })
    .fill("Alexandria");
  await page.getByText("Comfortable", { exact: true }).click();
  await expect(page.locator("[data-density]")).toHaveAttribute(
    "data-density",
    "comfortable",
  );
  await expect(
    page.getByRole("textbox", { name: "Search players" }),
  ).toHaveValue("Alexandria");
  await page.getByRole("button", { name: "Add Player", exact: true }).click();
  await page.getByLabel("Player Name").fill("Draft name");
  await page.evaluate(() => {
    localStorage.setItem("badminton_queue_density", "compact");
    window.dispatchEvent(new Event("queue-density"));
  });
  await expect(page.getByLabel("Player Name")).toHaveValue("Draft name");
  await expect(page.locator("[data-density]")).toHaveAttribute(
    "data-density",
    "compact",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel" })
    .click();
  await page.getByText("Comfortable", { exact: true }).click();
  await page.reload();
  await expect(page.locator("[data-density]")).toHaveAttribute(
    "data-density",
    "comfortable",
  );
});
for (const width of [375, 768, 899, 900, 1024, 1200, 1440])
  for (const density of ["Compact", "Comfortable"])
    test(`${width}px ${density}: large roster, long names and courts`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await seed(page, 30, 6);
      await ready(page);
      await page.getByText(density, { exact: true }).click();
      await expect(page.locator("[data-density]")).toHaveAttribute(
        "data-density",
        density.toLowerCase(),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width >= 1000) {
        const roster = page.locator("section").filter({
          has: page.getByRole("textbox", { name: "Search players" }),
        });
        const sidebar = page.getByRole("complementary", {
          name: "Queue and courts",
        });
        await roster.evaluate((el) => {
          el.scrollTop = 150;
        });
        await expect(
          page.getByRole("textbox", { name: "Search players" }),
        ).toBeInViewport();
        expect(await roster.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        expect(await sidebar.evaluate((el) => el.scrollTop)).toBe(0);
        const courts = sidebar
          .locator("section")
          .filter({ has: page.getByRole("heading", { name: /^Courts/ }) });
        const rosterBox = await roster.boundingBox();
        const sidebarBox = await sidebar.boundingBox();
        expect(sidebarBox!.x).toBeLessThan(rosterBox!.x);
        const courtScroll = await courts.evaluate((el) => {
          el.scrollTop = 100;
          return {
            position: el.scrollTop,
            overflow: el.scrollHeight - el.clientHeight,
          };
        });
        if (courtScroll.overflow > 1)
          expect(courtScroll.position).toBeGreaterThan(0);
        else expect(courtScroll.position).toBeLessThanOrEqual(1);
        await expect(
          sidebar.getByRole("button", { name: "Add Court", exact: true }),
        ).toBeInViewport();
        expect(await roster.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        await roster.evaluate((el) => {
          el.scrollTop = 0;
        });
        await courts.evaluate((el) => {
          el.scrollTop = 0;
        });
      }
      if (width < 768)
        await page
          .getByRole("navigation", { name: "Session views" })
          .getByRole("button", { name: /Courts/ })
          .click();
      else if (width < 1000)
        await page.getByText("Courts (6)", { exact: true }).click();
      const courtCards = page.getByRole("article", { name: /^Court [12]$/ });
      const firstCourt = await courtCards.nth(0).boundingBox();
      const secondCourt = await courtCards.nth(1).boundingBox();
      if (width >= 1200 || (width >= 900 && width < 1000)) {
        expect(Math.abs(firstCourt!.y - secondCourt!.y)).toBeLessThan(2);
        expect(secondCourt!.x).toBeGreaterThan(firstCourt!.x);
      } else {
        expect(Math.abs(firstCourt!.x - secondCourt!.x)).toBeLessThan(2);
        expect(secondCourt!.y).toBeGreaterThan(firstCourt!.y);
      }
      await page.screenshot({
        path: `test-results/layout-${width}-${density.toLowerCase()}-courts.png`,
        fullPage: true,
      });
      if (width < 768)
        await page
          .getByRole("navigation", { name: "Session views" })
          .getByRole("button", { name: /Players/ })
          .click();

      if (width >= 768) {
        const headings = page
          .getByTestId("roster-column-headings")
          .locator(":scope > span");
        for (const heading of await headings.all()) {
          expect(
            await heading.evaluate((el) => {
              const range = document.createRange();
              range.selectNodeContents(el);
              const bounds = range.getBoundingClientRect();
              return (
                bounds.width <= el.clientWidth + 1 &&
                bounds.height <= parseFloat(getComputedStyle(el).lineHeight) + 1
              );
            }),
          ).toBe(true);
        }
      }
      await expect(
        page.getByRole("textbox", { name: "Search players" }),
      ).toBeVisible();
      await expect(page.locator('[data-testid="player-row"]')).toHaveCount(30);
      await page
        .getByRole("textbox", { name: "Search players" })
        .fill("Alexandria");
      await expect(
        page.locator('[data-testid="player-row"]:visible'),
      ).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/layout-${width}-${density.toLowerCase()}-players.png`,
        fullPage: true,
      });
    });
test("mobile views preserve roster filters and compact controls remain touch-sized", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 850 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await seed(page, 30, 6);
  await ready(page);
  const nav = page.getByRole("navigation", { name: "Session views" });
  await expect(nav.getByRole("button").first()).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("button").first()).toContainText("Players");
  await nav.getByRole("button", { name: /Players/ }).click();
  await page
    .getByRole("textbox", { name: "Search players" })
    .fill("Alexandria");
  await nav.getByRole("button", { name: /Queue/ }).click();
  await nav.getByRole("button", { name: /Players/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Search players" }),
  ).toHaveValue("Alexandria");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  for (const button of await page.getByRole("button").all())
    if (await button.isVisible()) {
      await expect
        .poll(async () => (await button.boundingBox())?.height ?? 0, {
          message:
            (await button.getAttribute("aria-label")) ??
            (await button.innerText()),
        })
        .toBeGreaterThanOrEqual(44);
    }
  await context.close();
});
test("route typo redirects and keyboard focus is visible", async ({ page }) => {
  await page.goto("/queing");
  await expect(page).toHaveURL(/\/queuing$/);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Back to home" })).toBeFocused();
});

test("hydration and form connections remain clean on reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      /hydration|server rendered HTML|not connected to any Form|Minified React error #418/i.test(
        message.text(),
      )
    )
      errors.push(message.text());
  });
  await ready(page);
  await page.getByText("Comfortable", { exact: true }).click();
  await page.reload();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await addPlayer(page, "Hydration check");
  expect(errors).toEqual([]);
});

test("empty queue allows direct assignment from the roster", async ({
  page,
}) => {
  await seed(page);
  await ready(page);
  const row = page
    .locator('[data-testid="player-row"]')
    .filter({ hasText: "Alexandria" });
  await row.getByRole("button", { name: "Court", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Assign to Court 1", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Court 1", exact: true }),
  ).toContainText("Alexandria");
  await expect(
    page.getByRole("article", { name: /^Queued match/ }),
  ).toHaveCount(0);
});

test("long queue, courts and roster scroll independently and the first match assigns", async ({
  page,
}) => {
  await seed(page, 30, 6);
  await ready(page);
  await page
    .getByRole("button", { name: "Start Session", exact: true })
    .click();
  for (let i = 0; i < 12; i++) {
    await page
      .getByRole("button", { name: "Create Match", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: /^Queued match/ }),
    ).toHaveCount(i + 1);
  }
  const roster = page
    .locator("section")
    .filter({ has: page.getByRole("textbox", { name: "Search players" }) });
  const sidebar = page.getByRole("complementary", { name: "Queue and courts" });
  const courts = sidebar
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /^Courts/ }) });
  const queue = sidebar
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /^Up next/ }) });
  expect((await courts.boundingBox())!.y).toBeLessThan(
    (await queue.boundingBox())!.y,
  );
  expect((await courts.boundingBox())!.height).toBeLessThan(
    (await sidebar.boundingBox())!.height * 0.36,
  );
  await roster.evaluate((el) => {
    el.scrollTop = 150;
  });
  await courts.evaluate((el) => {
    el.scrollTop = 100;
  });
  await queue.evaluate((el) => {
    el.scrollTop = 400;
  });
  expect(await roster.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await courts.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await queue.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(
    page.getByRole("article", { name: "Queued match 1", exact: true }),
  ).not.toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Create Match", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("textbox", { name: "Search players" }),
  ).toBeInViewport();
  const expandedCourtHeight = (await courts.boundingBox())!.height;
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(page.locator("#up-next-content")).toBeHidden();
  await expect(queue.getByRole("heading", { name: /^Up next/ })).toBeVisible();
  expect((await courts.boundingBox())!.height).toBeGreaterThan(expandedCourtHeight);
  await queue.getByRole("button", { name: "Expand", exact: true }).click();
  await expect(page.locator("#up-next-content")).toBeVisible();
  await expect(page.getByRole("article", { name: /^Queued match/ })).toHaveCount(12);
  const courtHeight = (await courts.boundingBox())!.height;
  await page.getByRole("button", { name: "Minimize", exact: true }).click();
  await expect(page.locator("#up-next-content")).toBeVisible();
  await expect(
    page.getByRole("article", { name: /^Queued match/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("article", { name: "Queued match 1", exact: true }),
  ).toBeInViewport();
  expect((await courts.boundingBox())!.height).toBeGreaterThan(courtHeight);
  await page
    .getByRole("textbox", { name: "Search players" })
    .fill("Alexandria");
  await page.getByRole("button", { name: "Expand", exact: true }).click();
  await expect(
    page.getByRole("article", { name: /^Queued match/ }),
  ).toHaveCount(12);
  await expect(
    page.getByRole("textbox", { name: "Search players" }),
  ).toHaveValue("Alexandria");
  for (const name of ["Alexandria", "Player 2", "Player 3", "Player 4"]) {
    await page.getByRole("textbox", { name: "Search players" }).fill(name);
    const row = page
      .locator('[data-testid="player-row"]')
      .filter({ hasText: name })
      .first();
    await row.getByRole("button", { name: "Queue", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Assign to Queue" });
    await dialog.getByRole("button", { name: /^Queue 1\s/ }).click();
    await dialog
      .getByRole("button", { name: "Add to Queue", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Search players" }),
    ).toHaveValue("");
    await expect(
      page.getByRole("textbox", { name: "Search players" }),
    ).toBeFocused();
  }
  await queue.evaluate((el) => {
    el.scrollTop = 0;
  });
  const next = page.getByRole("article", {
    name: "Queued match 1",
    exact: true,
  });
  await expect(next.getByText("Next", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("article", { name: "Queued match 2", exact: true })
      .getByRole("button", { name: "Assign to court", exact: true }),
  ).toBeDisabled();
  await next
    .getByRole("button", { name: "Assign to court", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Court 1", exact: true }).click();
  await expect(
    page.getByRole("article", { name: /^Queued match/ }),
  ).toHaveCount(11);
  await expect(
    page.getByRole("article", { name: "Queued match 1", exact: true }),
  ).not.toContainText("Alexandria");
  const court = page.getByRole("article", { name: "Court 1", exact: true });
  await court.getByRole("button", { name: "Start Match", exact: true }).click();
  await court
    .getByRole("button", { name: "Finish Match", exact: true })
    .click();
  const finish = page.getByRole("dialog", {
    name: "Finish Match",
    exact: true,
  });
  await finish.getByText("Team 1", { exact: true }).click();
  await finish.getByRole("button", { name: "OK", exact: true }).click();
  await expect(finish).not.toBeVisible();
});

test("filters and sorting open without taking a separate roster row", async ({
  page,
}) => {
  await seed(page);
  await ready(page);
  await page.getByRole("textbox", { name: "Search players" }).fill("Player");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("combobox", { name: "Sort players" }).click();
  await page
    .locator(".ant-select-dropdown:visible")
    .getByText("Games", { exact: true })
    .click();
  await page.getByRole("button", { name: "Reverse sort order" }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Sort players" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search players" }),
  ).toHaveValue("Player");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Sort players" }).locator(".."),
  ).toContainText("Games");
});

test("mixed player states share column alignment and the full roster header floats", async ({
  page,
}) => {
  let data = fixture(30, 2);
  for (let i = 0; i < 4; i++)
    data = transition(
      data,
      {
        type: "togglePlayerSelection",
        courtId: "c1",
        playerId: `p${i}`,
        selected: true,
      },
      Date.now(),
    );
  data = transition(data, { type: "startSession" }, Date.now());
  data = transition(data, { type: "startMatch", courtId: "c1" }, Date.now());
  data = transition(data, { type: "createQueueItem", id: "q1" }, Date.now());
  data = transition(
    data,
    { type: "addPlayerToQueueItem", queueId: "q1", playerId: "p4" },
    Date.now(),
  );
  data = transition(data, { type: "togglePlayerActive", id: "p5" }, Date.now());
  await page.addInitScript(
    (session) =>
      localStorage.setItem(
        "badminton_queue_data_v2",
        JSON.stringify({ version: 1, data: session }),
      ),
    data,
  );
  await ready(page);
  for (const density of ["Compact", "Comfortable"]) {
    await page.getByText(density, { exact: true }).click();
    await expect(page.locator("[data-density]")).toHaveAttribute(
      "data-density",
      density.toLowerCase(),
    );
    const columns = page
      .getByTestId("roster-column-headings")
      .locator(":scope > span");
    for (const status of ["playing", "queued", "away", "waiting"]) {
      const cells = page
        .locator(`[data-testid="player-row"][data-player-status="${status}"]`)
        .first()
        .locator(":scope > *");
      for (let i = 0; i < 7; i++) {
        await expect
          .poll(async () =>
            Math.abs(
              (await columns.nth(i).boundingBox())!.x -
                (await cells.nth(i).boundingBox())!.x,
            ),
          )
          .toBeLessThan(2);
      }
    }
    const roster = page
      .locator("section")
      .filter({ has: page.getByRole("textbox", { name: "Search players" }) });
    await roster.evaluate((el) => {
      el.scrollTop = 500;
    });
    await expect(
      roster.getByRole("heading", { name: /^Players/ }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Add Player", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("textbox", { name: "Search players" }),
    ).toBeInViewport();
    await expect(page.getByTestId("roster-column-headings")).toBeInViewport();
    await roster.evaluate((el) => {
      el.scrollTop = 0;
    });
  }
});

test("removing players requires confirmation and cancellation preserves the session", async ({
  page,
}) => {
  await seed(page);
  await ready(page);
  await page
    .getByRole("button", { name: "Options for Player 2", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Remove player", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Remove Player 2 from this session?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("player-row")).toHaveCount(8);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByTestId("player-row")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Options for Player 2", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Remove player", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove player", exact: true })
    .click();
  await expect(page.getByTestId("player-row")).toHaveCount(7);
  await page.reload();
  await expect(page.getByTestId("player-row")).toHaveCount(7);
});

test("court and queue removal confirm before clearing assignments", async ({
  page,
}) => {
  let data = fixture();
  data = transition(
    data,
    {
      type: "togglePlayerSelection",
      courtId: "c1",
      playerId: "p0",
      selected: true,
    },
    Date.now(),
  );
  data = transition(data, { type: "createQueueItem", id: "q1" }, Date.now());
  data = transition(
    data,
    { type: "addPlayerToQueueItem", queueId: "q1", playerId: "p1" },
    Date.now(),
  );
  await page.addInitScript(
    (session) =>
      localStorage.setItem(
        "badminton_queue_data_v2",
        JSON.stringify({ data: session }),
      ),
    data,
  );
  await ready(page);
  const court = page.getByRole("article", { name: "Court 1", exact: true });
  await court
    .getByRole("button", {
      name: "Remove Alexandria Verylonglastname from Court 1",
    })
    .click();
  await expect(court).toContainText("Alexandria");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await court.getByRole("button", { name: "Options for Court 1" }).click();
  await page
    .getByRole("menuitem", { name: "Clear players", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear court", exact: true }).click();
  await expect(court).not.toContainText("Alexandria");
  const queued = page.getByRole("article", {
    name: "Queued match 1",
    exact: true,
  });
  await queued
    .getByRole("button", { name: "Remove Player 2 from match 1" })
    .click();
  await expect(queued).toContainText("Player 2");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await queued.getByRole("button", { name: "Options for match 1" }).click();
  await page
    .getByRole("menuitem", { name: "Remove match", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove match", exact: true }).click();
  await expect(queued).not.toBeVisible();
  await court.getByRole("button", { name: "Options for Court 1" }).click();
  await page
    .getByRole("menuitem", { name: "Remove court", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove court", exact: true }).click();
  await expect(court).not.toBeVisible();
  await expect(page.getByTestId("player-row")).toHaveCount(8);
});

test("import replacement and player-database deletion require confirmation", async ({
  page,
}) => {
  await seed(page);
  await ready(page);
  const upload = () =>
    page.locator("input[type=file]").setInputFiles({
      name: "session.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture(12))),
    });
  await upload();
  await expect(
    page.getByRole("dialog", {
      name: "Replace the current session?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("player-row")).toHaveCount(8);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Replace the current session?", exact: true })).not.toBeVisible();
  await upload();
  await page
    .getByRole("button", { name: "Replace session", exact: true })
    .click();
  await expect(page.getByTestId("player-row")).toHaveCount(12);
  await addPlayer(page, "Library Player");
  await page
    .getByRole("button", { name: "Player Database", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Delete Library Player from database",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Delete Library Player from database",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Delete Library Player from database",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Delete player", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Delete Library Player from database",
      exact: true,
    }),
  ).not.toBeVisible();
  await expect(page.getByTestId("player-row")).toHaveCount(13);
});

test("a rejected confirmed action keeps the dialog open and preserves the court", async ({
  page,
  context,
}) => {
  let data = fixture();
  for (let i = 0; i < 4; i++)
    data = transition(
      data,
      {
        type: "togglePlayerSelection",
        courtId: "c1",
        playerId: `p${i}`,
        selected: true,
      },
      Date.now(),
    );
  await page.addInitScript(
    (session) =>
      localStorage.setItem(
        "badminton_queue_data_v2",
        JSON.stringify({ data: session }),
      ),
    data,
  );
  await ready(page);
  await page
    .getByRole("button", { name: "Options for Court 1", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Remove court", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Remove Court 1?",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  const other = await context.newPage();
  await ready(other);
  await other
    .getByRole("button", { name: "Start Session", exact: true })
    .click();
  await other
    .getByRole("article", { name: "Court 1", exact: true })
    .getByRole("button", { name: "Start Match", exact: true })
    .click();
  await confirmation
    .getByRole("button", { name: "Remove court", exact: true })
    .click();
  await expect(confirmation.getByRole("alert")).toContainText("Finish or stop");
  await expect(
    page.getByRole("article", { name: "Court 1", exact: true }),
  ).toBeAttached();
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
});

test("long waits are indicated independently of queued status and auto-assign is absent", async ({
  page,
}) => {
  const data = fixture();
  const now = Date.now();
  data.sessionStatus = "active";
  data.sessionStartTime = now - 30 * 60000;
  data.players.forEach((p, i) => {
    p.joinedAt = now - (i === 0 ? 21 : i === 1 ? 16 : 2) * 60000;
    p.lastMatchEndTime = p.joinedAt;
    p.checkedInAt = p.joinedAt;
  });
  data.queue = [{ id: "q", team1: ["p0"], team2: [], createdAt: now }];
  data.autoAssignQueue = true;
  await page.addInitScript(
    (session) =>
      localStorage.setItem(
        "badminton_queue_data_v2",
        JSON.stringify({ data: session }),
      ),
    data,
  );
  await ready(page);
  const urgent = page
    .getByTestId("player-row")
    .filter({ hasText: "Alexandria" });
  const warning = page
    .getByTestId("player-row")
    .filter({ hasText: "Player 2" });
  await expect(urgent.locator('[data-wait-priority="urgent"]')).toContainText(
    "21m",
  );
  await expect(urgent).toHaveAttribute("data-player-status", "queued");
  await expect(warning.locator('[data-wait-priority="warning"]')).toContainText(
    "16m",
  );
  await expect(
    page.getByRole("switch", { name: "Auto-assign queue" }),
  ).toHaveCount(0);
  await page.getByText("Cards", { exact: true }).click();
  await expect(urgent.locator('[data-wait-priority="urgent"]')).toBeVisible();
  await expect(warning.locator('[data-wait-priority="warning"]')).toBeVisible();
});

test("tablet toolbar controls align, queue team labels stack, and stopping needs no reason", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    hasTouch: true,
  });
  const page = await context.newPage();
  let data = fixture();
  for (let i = 0; i < 4; i++)
    data = transition(
      data,
      {
        type: "togglePlayerSelection",
        courtId: "c1",
        playerId: `p${i}`,
        selected: true,
      },
      Date.now(),
    );
  data = transition(data, { type: "startSession" }, Date.now());
  data = transition(data, { type: "startMatch", courtId: "c1" }, Date.now());
  data = transition(data, { type: "createQueueItem", id: "q" }, Date.now());
  data = transition(
    data,
    { type: "addPlayerToQueueItem", queueId: "q", playerId: "p4" },
    Date.now(),
  );
  await page.addInitScript(
    (session) =>
      localStorage.setItem(
        "badminton_queue_data_v2",
        JSON.stringify({ data: session }),
      ),
    data,
  );
  await ready(page);
  for (const density of ["Compact", "Comfortable"]) {
    await page.getByText(density, { exact: true }).click();
    const search = page
      .getByRole("textbox", { name: "Search players" })
      .locator("..");
    const status = page
      .locator(".ant-select")
      .filter({ has: page.getByRole("combobox", { name: "Player status" }) });
    await expect
      .poll(async () => (await search.boundingBox())!.height)
      .toBe(44);
    await expect(
      page.getByRole("button", { name: "Filters", exact: true }),
    ).toHaveCSS("height", "44px");
    expect((await status.boundingBox())!.height).toBe(44);
    const queued = page.getByRole("article", {
      name: "Queued match 1",
      exact: true,
    });
    const team2 = queued.getByText("TEAM 2", { exact: true });
    const add = queued
      .getByRole("button", { name: "+ Add players", exact: true })
      .last();
    expect((await add.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await team2.boundingBox())!.y + (await team2.boundingBox())!.height,
    );
  }
  await page
    .getByRole("button", { name: "Options for Court 1", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Stop match", exact: true }).click();
  const stop = page.getByRole("dialog", {
    name: "Stop Match (No Winner)",
    exact: true,
  });
  await stop.getByRole("button", { name: "OK", exact: true }).click();
  await expect(stop).not.toBeVisible();
  await expect(
    page
      .getByRole("article", { name: "Court 1", exact: true })
      .getByText("Needs players", { exact: true }),
  ).toBeVisible();
  await context.close();
});

test("organizer checks players in before assignment and attendance syncs across tabs", async ({
  page,
  context,
}) => {
  await ready(page);
  await addPlayer(page, "Late arrival");
  const row = page
    .getByTestId("player-row")
    .filter({ hasText: "Late arrival" });
  await expect(row).toHaveAttribute("data-player-status", "not-arrived");
  await expect(
    row.getByRole("button", { name: "Queue", exact: true }),
  ).toHaveCount(0);
  await expect(
    row.getByRole("button", { name: "Court", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/0\/1 present/)).toBeVisible();
  const filterAttendance = async (label: string) => {
    await page.getByRole("combobox", { name: "Player status" }).focus();
    await page.getByRole("combobox", { name: "Player status" }).press("ArrowDown");
    await page
      .locator(".ant-select-dropdown:visible .ant-select-item-option-content")
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
  };
  await filterAttendance("Present");
  await expect(page.getByTestId("player-row")).toHaveCount(0);
  await filterAttendance("Not arrived");
  await expect(page.getByTestId("player-row")).toHaveCount(1);
  await filterAttendance("All");
  const other = await context.newPage();
  await ready(other);
  await page.getByRole("textbox", { name: "Search players" }).fill("Late");
  await row.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search players" }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Search players" }),
  ).toBeFocused();
  await expect(row).toHaveAttribute("data-player-status", "waiting");
  await expect(other.getByText(/1\/1 present/)).toBeVisible();
  await page
    .getByRole("button", { name: "Options for Late arrival", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Mark away", exact: true }).click();
  await expect(page.getByText(/1\/1 present/)).toBeVisible();
  await expect(row).toHaveAttribute("data-player-status", "away");
  await page
    .getByRole("button", { name: "Options for Late arrival", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Mark available", exact: true })
    .click();
  await row.getByRole("button", { name: "Court", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Assign to Court 1", exact: true })
    .click();
  await expect(row).toHaveAttribute("data-player-status", "assigned");
  await page.reload();
  await expect(page.getByText(/1\/1 present/)).toBeVisible();
  await page
    .getByRole("button", { name: "Options for Late arrival", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Undo check-in", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(/1\/1 present/)).toBeVisible();
  await page
    .getByRole("button", { name: "Options for Late arrival", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Undo check-in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Undo check-in", exact: true })
    .click();
  await expect(page.getByText(/0\/1 present/)).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Court 1", exact: true }),
  ).not.toContainText("Late arrival");
  await expect(
    other.getByTestId("player-row").filter({ hasText: "Late arrival" }),
  ).toHaveAttribute("data-player-status", "not-arrived");
});

for (const width of [1024, 1180, 1366]) {
  test(`iPad ${width}px keeps courts visible beside a large roster`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 768 }, hasTouch: true });
    const page = await context.newPage();
    await seed(page, 30);
    await ready(page);
    for (const density of ["Compact", "Comfortable"]) {
      await page.getByText(density, { exact: true }).click();
      const court = page.getByRole("article", { name: "Court 1", exact: true });
      const roster = page.locator("section").filter({ has: page.getByRole("textbox", { name: "Search players" }) });
      await expect(court).toBeInViewport();
      expect((await court.boundingBox())!.x).toBeLessThan((await roster.boundingBox())!.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await roster.evaluate((el) => { el.scrollTop = 300; });
      expect(await roster.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await expect(court).toBeInViewport();
      await roster.evaluate((el) => { el.scrollTop = 0; });
      const first = page.getByTestId("player-row").filter({ hasText: "Alexandria" });
      await expect(first.getByRole("img", { name: "Female", exact: true })).toBeVisible();
      await expect(page.getByTestId("player-row").filter({ has: page.locator('strong[title="Player 2"]') }).getByRole("img", { name: "Male", exact: true })).toBeVisible();
    }
    await page.screenshot({ path: `test-results/ipad-${width}.png` });
    await context.close();
  });
}

for (const width of [390, 1024]) for (const mode of ["light", "dark"]) {
  test(`full level badges ${width}px ${mode}`, async ({ page }) => {
    const levels = ["Beginner -", "Beginner", "Beginner +", "Intermediate -", "Intermediate", "Intermediate +", "Advanced -", "Advanced", "Advanced +"] as const;
    const data = fixture(9);
    data.players.forEach((p, i) => { p.level = levels[i]; });
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(({ data, mode }) => {
      localStorage.setItem("badminton_queue_data_v2", JSON.stringify({ data }));
      localStorage.setItem("badminton_queue_appearance", JSON.stringify({ color: "emerald", mode }));
    }, { data, mode });
    await ready(page);
    for (const level of levels) {
      const badge = page.getByTestId("player-row").locator(`[data-level="${level}"]`);
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(level.replace(" -", " −"));
      expect(await badge.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/level-badges-${width}-${mode}.png` });
  });
}
