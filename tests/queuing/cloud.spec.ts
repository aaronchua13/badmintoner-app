import { test, expect, type Page } from "@playwright/test";
import { initialSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";
function fixture() {
  let s = initialSession(Date.now());
  for (let i = 0; i < 4; i++) {
    s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i + 1}`, gender: "Male", level: "Intermediate" } }, Date.now());
    s = transition(s, { type: "checkInPlayer", id: `p${i}` }, Date.now());
  }
  return s;
}
async function seed(page: Page) {
  await page.addInitScript((s) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify(s)), fixture());
  await page.route("**/api/queuing/cloud/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path.endsWith("/config") ? { configured: false, signupReady: false } : { user: null } });
  });
  await page.goto("/queuing");
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
}
async function tools(page: Page) {
  await page.getByRole("button", { name: "Session tools", exact: true }).click();
  return page.getByRole("dialog", { name: "Session tools", exact: true });
}
for (const mobile of [false, true]) {
  test(`offline tools support undo, backups, templates and clean restoration (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await seed(page);
    if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Queue/ }).click();
    await page.getByRole("button", { name: "Create Match", exact: true }).click();
    let drawer = await tools(page);
    await drawer.getByRole("button", { name: "Undo recent action", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Undo recent action", exact: true })).toBeDisabled();
    await drawer.getByRole("tab", { name: "Player history", exact: true }).click();
    for (let i = 1; i <= 4; i++) {
      const create = drawer.getByRole("button", { name: "Create player database identity", exact: true }).first();
      await create.click();
      await expect(drawer.getByRole("button", { name: "Create player database identity", exact: true })).toHaveCount(4 - i);
    }
    await drawer.getByRole("tab", { name: "Templates", exact: true }).click();
    await drawer.getByRole("textbox", { name: "Template name", exact: true }).fill("Wednesday evening");
    await drawer.getByRole("button", { name: "Save template", exact: true }).click();
    await expect(drawer.getByText("Wednesday evening", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Use template", exact: true }).click();
    await page.getByRole("dialog", { name: "Start from this template?", exact: true }).getByRole("button", { name: "Continue", exact: true }).click();
    await drawer.getByRole("tab", { name: "Backups", exact: true }).click();
    await expect(drawer.getByText("Before applying template", { exact: false })).toBeVisible();
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    if (mobile) await page.getByRole("navigation", { name: "Session views" }).getByRole("button", { name: /Players/ }).click();
    await expect(page.getByTestId("player-row").filter({ hasText: "Not arrived" })).toHaveCount(4);
    drawer = await tools(page);
    await drawer.getByRole("tab", { name: "Backups", exact: true }).click();
    await drawer.getByRole("button", { name: "Restore copy", exact: true }).first().click();
    await page.getByRole("dialog", { name: "Restore this recovery copy?", exact: true }).getByRole("button", { name: "Continue", exact: true }).click();
    if (mobile) {
      await drawer.getByRole("button", { name: "More session tabs", exact: true }).click();
      await page.getByRole("option", { name: "Sessions", exact: true }).click();
    } else await drawer.getByRole("tab", { name: "Sessions", exact: true }).click();
    await expect(drawer.getByText("Recovery · excluded from statistics", { exact: true })).toBeVisible();
  });
}

test("signup requires saving the generated password and never stores it in queue data", async ({ page }) => {
  let submitted = "";
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "test@example.invalid" };
  await page.route("**/api/queuing/cloud/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/config")) return route.fulfill({ json: { configured: true, signupReady: true } });
    if (path.endsWith("/auth/signup")) { submitted = route.request().postDataJSON().password; return route.fulfill({ json: { user } }); }
    if (path.endsWith("/workspace")) return route.fulfill({ json: { version: 0, payload: { library: [], templates: [], identities: {} } } });
    return route.fulfill({ json: { user: submitted ? user : null } });
  });
  await page.goto("/queuing");
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
  let drawer = await tools(page);
  await drawer.getByRole("tab", { name: "Account", exact: true }).click();
  await drawer.getByRole("button", { name: "Create an account", exact: true }).click();
  await drawer.getByLabel("Email address", { exact: true }).fill("test@example.invalid");
  await drawer.getByRole("button", { name: "Generate initial password", exact: true }).click();
  const password = await drawer.getByLabel("Generated initial password", { exact: true }).inputValue();
  expect(password).toHaveLength(20);
  await expect(drawer.getByRole("button", { name: "Create cloud account", exact: true })).toBeDisabled();
  await drawer.getByRole("checkbox", { name: "I have saved my initial password", exact: true }).check();
  await drawer.getByRole("button", { name: "Create cloud account", exact: true }).click();
  await expect.poll(() => submitted).toHaveLength(20);
  expect(submitted).toBe(password);
  await expect(drawer).not.toBeVisible();
  drawer = await tools(page);
  await drawer.getByRole("tab", { name: "Account", exact: true }).click();
  await expect(drawer.getByText("test@example.invalid", { exact: true })).toBeVisible();
  const persisted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("badminton-queuing", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const value = await new Promise<unknown>((resolve, reject) => { const r = db.transaction("data").objectStore("data").get("current"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close(); return JSON.stringify(value);
  });
  expect(persisted).not.toContain(password);
});

test("local TV mode is read-only and excludes financial and private log data", async ({ page }) => {
  let s = fixture();
  s = transition(s, { type: "saveReceipt", editing: false, values: { id: "r", playerId: "p0", amount: 100, method: "cash", paidAt: Date.now(), note: "PRIVATE_RECEIPT" } }, Date.now());
  await page.addInitScript((s) => localStorage.setItem("badminton_queue_data_v2", JSON.stringify(s)), s);
  await page.goto("/queuing?display=tv");
  await expect(page.getByRole("main", { name: "Read-only queue display", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Payments", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Session tools", exact: true })).toHaveCount(0);
  await expect(page.getByText("PRIVATE_RECEIPT")).toHaveCount(0);
});

test("public QR display works anonymously and hides revoked content", async ({ page }) => {
  const token = "a".repeat(43);
  let revoked = false;
  await page.route(`**/api/queuing/cloud/display/${token}`, (route) => route.fulfill(revoked ? { status: 404, json: { error: "This display link is unavailable" } } : { json: { title: "Court night", status: "active", updatedAt: Date.now(), courts: [], queue: [{ team1: ["Alex", "Sam"], team2: ["Jo", "Pat"] }] } }));
  await page.goto(`/queuing/view/${token}`);
  await expect(page.getByRole("heading", { name: "Court night", exact: true })).toBeVisible();
  await expect(page.getByText("Alex & Sam", { exact: false })).toBeVisible();
  revoked = true;
  await expect(page.getByText("This display link is unavailable", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading", { name: "Court night", exact: true })).toHaveCount(0);
});
