import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { calculateBilling } from "../../../app/queuing/state/billing";
import { parseSession } from "../../../app/queuing/state/model";
import { commitCommand, transact } from "../../../app/queuing/state/storage";
import { charged, roster, ended, pay, receipt, run, NOW } from "./fixtures";

describe("payment audit: command lifecycle", () => {
  it("edits method, amount, timestamp and note then deletes without residue", () => {
    let s = pay(charged());
    const original = structuredClone(s.billing.receipts[0]);
    const corrected = { ...original, method: "digital" as const, amount: 22001, paidAt: NOW - 60000, note: "Correction" };
    s = run(s, { type: "saveReceipt", editing: true, original, values: corrected });
    expect(calculateBilling(s).rows[0]).toMatchObject({ cash: 0, digital: 22001, balance: 0, credit: 1 });
    expect(s.billing.receipts).toEqual([corrected]);
    s = run(s, { type: "deleteReceipt", id: original.id, original: corrected });
    expect(calculateBilling(s).rows[0]).toMatchObject({ received: 0, balance: 22000, credit: 0 });
  });
  it("prevents duplicate receipt IDs and moving a receipt to another player", () => {
    const s = pay(charged());
    const snapshot = structuredClone(s);
    expect(() => pay(s)).toThrow(/changed/);
    expect(() => run(s, { type: "saveReceipt", editing: true, original: s.billing.receipts[0], values: { ...s.billing.receipts[0], playerId: "p1" } })).toThrow(/another player/);
    expect(s).toEqual(snapshot);
  });
  it("allows receipt corrections after finalization but not charge changes", () => {
    let s = run(ended(charged()), { type: "finalizeBilling", revision: 0 });
    const frozen = structuredClone(s.billing.finalized);
    s = pay(s);
    s = run(s, { type: "saveReceipt", editing: true, original: s.billing.receipts[0], values: { ...s.billing.receipts[0], amount: 5000 } });
    expect(s.billing.finalized).toEqual(frozen);
    expect(() => run(s, { type: "setArrangement", playerId: "p0", values: { kind: "none" } })).toThrow(/Reopen/);
    expect(() => run(s, { type: "finalizeBilling", revision: 0 })).toThrow(/already/);
    const reopened = run(s, { type: "reopenBilling", revision: 0 });
    expect(reopened.billing.receipts).toEqual(s.billing.receipts);
    expect(run(reopened, { type: "finalizeBilling", revision: 0 }).billing.finalized).toEqual(frozen);
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("blocks premature or incomplete settlement and invalid reopen", () => {
    expect(() => run(charged(), { type: "finalizeBilling", revision: 0 })).toThrow(/End/);
    expect(() => run(ended(roster()), { type: "finalizeBilling", revision: 0 })).toThrow(/every player/);
    expect(() => run(charged(), { type: "reopenBilling", revision: 0 })).toThrow(/not finalized/);
  });
  it("paid charges survive cost and attendance changes; zero charge remains explicit", () => {
    let s = pay(charged(), receipt("paid", 22000));
    s = run(s, { type: "checkInPlayer", id: "p0" });
    s = run(s, { type: "setExpenses", values: { courtFee: 123456, tubePrice: 789, tubes: 1, pieces: 1, piecesPerTube: 12 }, calculatorExcluded: ["p0", "p1", "p2"] });
    s = run(s, { type: "undoCheckIn", id: "p0" });
    expect(calculateBilling(s).rows[0]).toMatchObject({ charge: 22000, received: 22000, status: "Fully paid" });
    s = run(s, { type: "setArrangement", playerId: "p1", values: { kind: "none" } });
    expect(calculateBilling(s).rows[1]).toMatchObject({ charge: 0, status: "No charge" });
  });
});

describe("payment audit: transactions and conflicts", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("localStorage", { getItem: () => null });
    await transact((d) => ({ ...d, session: ended(charged()) }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("serializes twenty concurrent distinct receipts without lost updates", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => commitCommand({ type: "saveReceipt", editing: false, values: receipt(`r${i}`, 100 + i, `p${i % 3}`, i % 2 ? "digital" : "cash") }, NOW)));
    const saved = await transact();
    expect(saved.session.billing.receipts).toHaveLength(20);
    expect(calculateBilling(saved.session).received).toBe(2190);
    expect(saved.revision).toBe(21);
  });
  it("accepts exactly one of concurrent identical receipt IDs", async () => {
    const result = await Promise.allSettled([0, 1].map(() => commitCommand({ type: "saveReceipt", editing: false, values: receipt() }, NOW)));
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await transact()).session.billing.receipts).toHaveLength(1);
  });
  it.each([{ amount: 20000 }, { method: "digital" as const }, { note: "New note" }, { paidAt: NOW + 1000 }])("rejects a stale edit when only %j changed", async (patch) => {
    const original = receipt();
    await commitCommand({ type: "saveReceipt", editing: false, values: original }, NOW);
    await commitCommand({ type: "saveReceipt", editing: true, original, values: { ...original, ...patch } }, NOW);
    const snapshot = await transact();
    await expect(commitCommand({ type: "saveReceipt", editing: true, original, values: { ...original, note: "Stale save" } }, NOW)).rejects.toThrow(/changed/);
    expect(await transact()).toEqual(snapshot);
  });
  it("allows unrelated payments while editing and rejects an edit after deletion", async () => {
    await commitCommand({ type: "saveReceipt", editing: false, values: receipt() }, NOW);
    await commitCommand({ type: "saveReceipt", editing: false, values: receipt("other", 100, "p1") }, NOW);
    await commitCommand({ type: "saveReceipt", editing: true, original: receipt(), values: { ...receipt(), note: "Allowed" } }, NOW);
    await commitCommand({ type: "deleteReceipt", id: "r1", original: { ...receipt(), note: "Allowed" } }, NOW);
    const saved = await transact();
    await expect(commitCommand({ type: "saveReceipt", editing: true, original: receipt(), values: receipt() }, NOW)).rejects.toThrow(/changed/);
    await expect(commitCommand({ type: "deleteReceipt", id: "r1", original: { ...receipt(), note: "Allowed" } }, NOW)).rejects.toThrow(/no longer/);
    expect(await transact()).toEqual(saved);
  });
  it("rejects stale bulk assignment, finalization and reopening", async () => {
    const stale = (await transact()).revision;
    await commitCommand({ type: "saveReceipt", editing: false, values: receipt() }, NOW);
    for (const command of [
      { type: "setPlayerCharges" as const, playerIds: ["p0"], exemptPlayerIds: [], amount: 100, revision: stale },
      { type: "finalizeBilling" as const, revision: stale },
    ]) await expect(commitCommand(command, NOW)).rejects.toThrow(/another tab/);
    await commitCommand({ type: "finalizeBilling", revision: (await transact()).revision }, NOW);
    const review = (await transact()).revision;
    await commitCommand({ type: "saveReceipt", editing: false, values: receipt("new", 100) }, NOW);
    await expect(commitCommand({ type: "reopenBilling", revision: review }, NOW)).rejects.toThrow(/another tab/);
  });
  it("aborts a real failed IndexedDB write and safely retries", async () => {
    const saved = await transact();
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => { throw new Error("Injected quota failure"); });
    await expect(commitCommand({ type: "saveReceipt", editing: false, values: receipt() }, NOW)).rejects.toThrow(/quota/);
    expect(await transact()).toEqual(saved);
    await commitCommand({ type: "saveReceipt", editing: false, values: receipt() }, NOW);
    expect((await transact()).session.billing.receipts).toEqual([receipt()]);
  });
  it("rolls back a write when its IndexedDB transaction aborts after put", async () => {
    const saved = await transact();
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      const request = originalPut.apply(this, args);
      this.transaction.abort();
      return request;
    });
    await expect(commitCommand({ type: "saveReceipt", editing: false, values: receipt() }, NOW)).rejects.toThrow();
    expect(await transact()).toEqual(saved);
  });
  it("rejects invalid imports and aggregate overflow without altering saved records", async () => {
    await commitCommand({ type: "saveReceipt", editing: false, values: receipt("max", 1_000_000_000) }, NOW);
    const saved = await transact();
    await expect(commitCommand({ type: "saveReceipt", editing: false, values: receipt("overflow", 1) }, NOW)).rejects.toThrow(/large/);
    const bad = structuredClone(saved.session);
    bad.billing.receipts[0].playerId = "unknown";
    await expect(commitCommand({ type: "importSession", data: bad, revision: saved.revision }, NOW)).rejects.toThrow(/unknown/);
    expect(await transact()).toEqual(saved);
  });
});

describe("explicit collection exclusions", () => {
  it("makes an already billed excluded player No charge and preserves their receipts", () => {
    const before = pay(charged());
    const after = run(before, { type: "setPlayerCharges", playerIds: ["p1"], exemptPlayerIds: ["p0"], amount: 27000, revision: 0 });
    expect(calculateBilling(after).rows[0]).toMatchObject({ charge: 0, status: "No charge", received: 10000, balance: 0, credit: 10000 });
    expect(after.billing.receipts).toEqual(before.billing.receipts);
    expect(calculateBilling(after).rows[1].charge).toBe(27000);
    expect(calculateBilling(after).rows[2].charge).toBe(22000);
  });
  it("can exclude everyone without requiring a charge for a selected player", () => {
    const before = pay(charged());
    const after = run(before, { type: "setPlayerCharges", playerIds: [], exemptPlayerIds: ["p0", "p1", "p2"], amount: 0, revision: 0 });
    expect(calculateBilling(after).outstanding).toBe(0);
    expect(calculateBilling(after).rows.every((r) => r.status === "No charge")).toBe(true);
    expect(after.billing.receipts).toEqual(before.billing.receipts);
  });
});
