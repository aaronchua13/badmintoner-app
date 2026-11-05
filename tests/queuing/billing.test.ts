import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  initialSession,
  parseSession,
  QueueData,
} from "../../app/queuing/state/model";
import {
  Arrangement,
  calculateBilling,
  emptyBilling,
} from "../../app/queuing/state/billing";
import { Command, transition } from "../../app/queuing/state/transitions";
import { commitCommand, transact } from "../../app/queuing/state/storage";
const run = (s: QueueData, a: Command) => transition(s, a, 10000);
function roster(names = ["a", "b", "c"]) {
  let s = initialSession(0);
  for (const id of names)
    s = run(s, {
      type: "addPlayer",
      id,
      values: { name: id, gender: "Male", level: "Intermediate" },
    });
  return s;
}
const arrange = (s: QueueData, playerId: string, values: Arrangement) =>
  run(s, { type: "setArrangement", playerId, values });
function shared() {
  let s = roster();
  s = run(s, {
    type: "setExpenses",
    values: {
      courtFee: 100000,
      tubePrice: 60000,
      piecesPerTube: 12,
      tubes: 3,
      pieces: 4,
    },
    calculatorExcluded: ["c"],
  });
  s = run(s, {
    type: "setPlayerCharges",
    playerIds: ["a", "b"],
    exemptPlayerIds: [],
    amount: 150000,
    revision: 0,
  });
  return arrange(s, "c", { kind: "separate", amount: 5000 });
}
const pay = (
  s: QueueData,
  id: string,
  amount: number,
  method: "cash" | "digital" = "digital",
) =>
  run(s, {
    type: "saveReceipt",
    editing: false,
    values: { id, playerId: "a", amount, method, paidAt: 1000, note: "" },
  });
function end(s: QueueData) {
  return run(run(s, { type: "startSession" }), { type: "stopSession" });
}

describe("manual billing and independent calculator", () => {
  it("handles Aaron excluded, seven at 270, and Jans with a 50 student discount", () => {
    let s = roster([
      "aaron",
      "phinky",
      "dan",
      "flor",
      "cloyd",
      "anj",
      "kayth",
      "jans",
    ]);
    s = run(s, {
      type: "setExpenses",
      values: {
        courtFee: 100000,
        tubePrice: 84500,
        piecesPerTube: 12,
        tubes: 1,
        pieces: 0,
      },
      calculatorExcluded: ["aaron"],
    });
    expect(calculateBilling(s)).toMatchObject({
      totalExpenses: 184500,
      calculatorCount: 7,
      baseShare: 26357,
    });
    s = run(s, {
      type: "setPlayerCharges",
      playerIds: s.players.filter((p) => p.id !== "aaron").map((p) => p.id),
      exemptPlayerIds: ["aaron"],
      amount: 27000,
      revision: 0,
    });
    s = arrange(s, "jans", {
      kind: "shared",
      adjustment: "fixed",
      amount: 27000,
      discount: 5000,
      note: "Student discount",
    });
    const totals = calculateBilling(s);
    expect(totals.sharedCharges).toBe(184000);
    expect(totals.difference).toBe(-500);
    expect(totals.rows.find((r) => r.id === "aaron")).toMatchObject({
      charge: 0,
      status: "No charge",
    });
    expect(totals.rows.find((r) => r.id === "jans")).toMatchObject({
      charge: 22000,
      status: "No payment",
    });
    expect(
      totals.rows
        .filter((r) => !["aaron", "jans"].includes(r.id))
        .every((r) => r.charge === 27000),
    ).toBe(true);
    s = run(s, {
      type: "setExpenses",
      values: { ...s.billing.expenses, courtFee: 200000, pieces: 4 },
      calculatorExcluded: [],
    });
    expect(calculateBilling(s).sharedCharges).toBe(184000);
    expect(calculateBilling(s).calculatorCount).toBe(8);
  });
  it("starts unassigned and attendance never affects calculator choices or charges", () => {
    expect(
      calculateBilling(roster()).rows.every((r) => r.status === "Unassigned"),
    ).toBe(true);
    const s = shared();
    expect(calculateBilling(s)).toMatchObject({
      shuttleCost: 200000,
      totalExpenses: 300000,
      baseShare: 150000,
      separateCharges: 5000,
    });
    const present = run(s, { type: "checkInPlayer", id: "a" });
    expect(calculateBilling(present)).toMatchObject({
      baseShare: 150000,
      sharedCharges: 300000,
    });
    expect(
      calculateBilling(run(present, { type: "undoCheckIn", id: "a" }))
        .baseShare,
    ).toBe(150000);
  });
  it("supports higher/lower individual overrides and does not touch excluded custom bills", () => {
    let s = arrange(shared(), "a", {
      kind: "shared",
      adjustment: "fixed",
      amount: 100000,
    });
    s = arrange(s, "b", {
      kind: "shared",
      adjustment: "fixed",
      amount: 180000,
    });
    s = run(s, {
      type: "setPlayerCharges",
      playerIds: ["a"],
      exemptPlayerIds: [],
      amount: 160000,
      revision: 0,
    });
    expect(calculateBilling(s).rows.map((r) => r.charge)).toEqual([
      160000, 180000, 5000,
    ]);
  });
  it("does not change fully-paid assigned charges when costs or calculation players change", () => {
    let s = pay(shared(), "advance", 150000);
    s = run(s, {
      type: "setExpenses",
      values: { ...s.billing.expenses, courtFee: 200000 },
      calculatorExcluded: ["a", "b", "c"],
    });
    expect(calculateBilling(s).baseShare).toBeNull();
    expect(calculateBilling(s).rows[0]).toMatchObject({
      charge: 150000,
      status: "Fully paid",
    });
    s = run(end(s), { type: "finalizeBilling", revision: 0 });
    s = run(s, {
      type: "setExpenses",
      values: { ...s.billing.expenses, courtFee: 100 },
    });
    expect(calculateBilling(s).rows[0]).toMatchObject({
      charge: 150000,
      status: "Fully paid",
    });
  });
  it.each([
    [160000, "Partially paid", 10000, 0],
    [140000, "Fully paid", 0, 10000],
    [150000, "Fully paid", 0, 0],
  ] as const)(
    "updates statuses only when assigned charge changes to %s",
    (amount, status, balance, credit) => {
      let s = end(pay(shared(), "advance", 150000));
      s = arrange(s, "a", { kind: "shared", adjustment: "fixed", amount });
      s = run(s, { type: "finalizeBilling", revision: 0 });
      expect(calculateBilling(s).rows[0]).toMatchObject({
        status,
        balance,
        credit,
        received: 150000,
      });
      expect(s.billing.estimate?.a).toBe(150000);
    },
  );
  it("records mixed installments, corrections, and collections after finalization", () => {
    let s = pay(shared(), "deposit", 75000);
    expect(calculateBilling(s).rows[0].status).toBe("Partially paid");
    s = run(end(s), { type: "finalizeBilling", revision: 0 });
    s = pay(s, "balance", 75000, "cash");
    expect(calculateBilling(s).rows[0]).toMatchObject({
      status: "Fully paid",
      cash: 75000,
      digital: 75000,
    });
    s = run(s, {
      type: "saveReceipt",
      editing: true,
      original: structuredClone(s.billing.receipts[1]),
      values: { ...s.billing.receipts[1], amount: 80000, note: "Correction" },
    });
    expect(calculateBilling(s).rows[0].credit).toBe(5000);
    s = run(s, { type: "deleteReceipt", id: "balance" });
    expect(calculateBilling(s).rows[0].balance).toBe(75000);
  });
  it("locks final assigned amounts and preserves payments through reopening", () => {
    expect(() =>
      run(shared(), { type: "finalizeBilling", revision: 0 }),
    ).toThrow("End the session");
    expect(() =>
      run(end(roster()), { type: "finalizeBilling", revision: 0 }),
    ).toThrow("every player");
    let s = run(end(pay(shared(), "deposit", 100)), {
      type: "finalizeBilling",
      revision: 0,
    });
    expect(() => arrange(s, "a", { kind: "none" })).toThrow("Reopen");
    expect(() =>
      run(s, {
        type: "setPlayerCharges",
        playerIds: ["a"],
        exemptPlayerIds: [],
        amount: 100,
        revision: 0,
      }),
    ).toThrow("Reopen");
    s = run(s, { type: "reopenBilling", revision: 0 });
    expect(s.billing.receipts).toHaveLength(1);
    expect(arrange(s, "a", { kind: "none" }).billing.finalized).toBeNull();
  });
  it("protects receipts during removal and clears billing for a new/reset session", () => {
    const s = pay(shared(), "deposit", 100);
    expect(() => run(s, { type: "removePlayer", id: "a" })).toThrow(
      "Resolve payments",
    );
    const removed = run(s, { type: "removePlayer", id: "c" });
    expect(removed.billing.arrangements.c).toBeUndefined();
    expect(removed.billing.calculatorExcluded).toEqual([]);
    expect(run(s, { type: "restartSession" }).billing).toEqual(emptyBilling());
    expect(run(s, { type: "resetState" }).billing).toEqual(emptyBilling());
  });
  it("freezes legacy automatic standard/discount amounts while preserving receipts and final snapshots", () => {
    for (const finalized of [false, true]) {
      const old = shared();
      old.schemaVersion = 2;
      old.billing.arrangements.a = {
        kind: "shared",
        adjustment: "standard",
        amount: 0,
      };
      old.billing.arrangements.b = {
        kind: "shared",
        adjustment: "discount",
        amount: 5000,
      };
      old.billing.receipts.push({
        id: "r",
        playerId: "a",
        amount: 10000,
        method: "digital",
        paidAt: 0,
        note: "",
      });
      if (finalized) {
        old.sessionStatus = "ended";
        old.sessionStartTime = 1;
        old.sessionEndTime = 2;
        old.billing.finalized = {
          at: 3,
          charges: ["a", "b", "c"].map((playerId, i) => ({
            playerId,
            arrangement: old.billing.arrangements[playerId],
            amount: [150000, 145000, 5000][i],
          })),
        };
      }
      let migrated = parseSession(old);
      expect(migrated.schemaVersion).toBe(4);
      expect(migrated.billing.calculatorExcluded).toEqual([]);
      expect(calculateBilling(migrated).rows.map((r) => r.charge)).toEqual([
        150000, 145000, 5000,
      ]);
      expect(migrated.billing.receipts).toEqual(old.billing.receipts);
      migrated = run(migrated, {
        type: "setExpenses",
        values: { ...migrated.billing.expenses, courtFee: 100 },
      });
      expect(calculateBilling(migrated).rows.map((r) => r.charge)).toEqual([
        150000, 145000, 5000,
      ]);
    }
  });
  it("round trips billing and rejects malformed imports and bulk selections", () => {
    const old = JSON.parse(JSON.stringify(roster()));
    delete old.billing;
    old.schemaVersion = 1;
    expect(parseSession(old).billing).toEqual(emptyBilling());
    const final = run(end(pay(shared(), "deposit", 100)), {
      type: "finalizeBilling",
      revision: 0,
    });
    expect(parseSession(JSON.parse(JSON.stringify(final)))).toEqual(final);
    const invalid = structuredClone(final);
    invalid.billing.receipts.push(invalid.billing.receipts[0]);
    expect(() => parseSession(invalid)).toThrow("Duplicate payment");
    invalid.billing.receipts = [
      { ...invalid.billing.receipts[0], playerId: "missing" },
    ];
    expect(() => parseSession(invalid)).toThrow("unknown player");
    const corrupt = structuredClone(final);
    corrupt.billing.finalized!.charges[0].amount++;
    expect(() => parseSession(corrupt)).toThrow("disagree");
    expect(() => parseSession({ ...old, schemaVersion: 3 })).toThrow(
      "payment data",
    );
    expect(() =>
      run(shared(), {
        type: "setExpenses",
        values: { ...shared().billing.expenses, piecesPerTube: 0 },
      }),
    ).toThrow();
    expect(() => pay(shared(), "negative", -1)).toThrow();
    for (const playerIds of [[], ["a", "a"], ["missing"]])
      expect(() =>
        run(roster(), {
          type: "setPlayerCharges",
          playerIds,
          exemptPlayerIds: [],
          amount: 100,
          revision: 0,
        }),
      ).toThrow();
  });
});

describe("payment persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("localStorage", { getItem: () => null });
  });
  async function seed() {
    await transact((data) => ({ ...data, session: end(shared()) }));
  }
  it("merges concurrent receipts and rejects stale settlement and bulk billing reviews", async () => {
    await seed();
    const revision = (await transact()).revision;
    await Promise.all(
      ["cash", "digital"].map((method, i) =>
        commitCommand(
          {
            type: "saveReceipt",
            editing: false,
            values: {
              id: `r${i}`,
              playerId: "a",
              amount: 75000,
              method: method as "cash" | "digital",
              paidAt: 1000,
              note: "",
            },
          },
          1000,
        ),
      ),
    );
    const saved = await transact();
    expect(calculateBilling(saved.session).rows[0]).toMatchObject({
      cash: 75000,
      digital: 75000,
      status: "Fully paid",
    });
    await expect(
      commitCommand({ type: "finalizeBilling", revision }, 1000),
    ).rejects.toThrow("another tab");
    await expect(
      commitCommand(
        {
          type: "setPlayerCharges",
          revision,
          playerIds: ["a"],
          exemptPlayerIds: [],
          amount: 100,
        },
        1000,
      ),
    ).rejects.toThrow("another tab");
    expect(await transact()).toEqual(saved);
    await commitCommand(
      { type: "finalizeBilling", revision: saved.revision },
      1000,
    );
    expect((await transact()).session.billing.finalized).not.toBeNull();
  });
  it("leaves saved data intact after invalid import or failed payment", async () => {
    await seed();
    const saved = await transact();
    const bad = structuredClone(saved.session);
    bad.billing.arrangements.missing = { kind: "none" };
    await expect(
      commitCommand(
        { type: "importSession", data: bad, revision: saved.revision },
        1000,
      ),
    ).rejects.toThrow();
    await expect(
      commitCommand(
        {
          type: "saveReceipt",
          editing: false,
          values: {
            id: "bad",
            playerId: "a",
            amount: 0,
            method: "cash",
            paidAt: 0,
            note: "",
          },
        },
        1000,
      ),
    ).rejects.toThrow();
    expect(await transact()).toEqual(saved);
  });
});
