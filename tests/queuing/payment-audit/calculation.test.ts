import { describe, expect, it } from "vitest";
import { calculateBilling, expensesSchema, receiptSchema, arrangementSchema } from "../../../app/queuing/state/billing";
import { parseSession } from "../../../app/queuing/state/model";
import { roster, charged, receipt, pay, run, ended } from "./fixtures";

describe("payment audit: independent calculation expectations", () => {
  it.each([0, 1, 3])("zero costs with %i players", (count) => {
    const t = calculateBilling(roster(count));
    expect(t).toMatchObject({ totalExpenses: 0, received: 0, outstanding: 0, credits: 0, baseShare: count ? 0 : null });
    expect(t.rows.every((r) => r.charge === null && r.status === "Unassigned")).toBe(true);
  });
  it.each([
    [100, 0, 0, 12, 0, 100, 33],
    [0, 100, 0, 12, 1, 8, 3],
    [0, 101, 0, 2, 1, 51, 17],
    [10000, 84500, 1, 12, 4, 122667, 40889],
    [0, 1200, 2, 12, 12, 3600, 1200],
  ])("court %i, tube %i, tubes %i, piecesPerTube %i, pieces %i", (courtFee, tubePrice, tubes, piecesPerTube, pieces, expenses, share) => {
    const s = run(roster(), { type: "setExpenses", values: { courtFee, tubePrice, tubes, piecesPerTube, pieces } });
    expect(calculateBilling(s)).toMatchObject({ totalExpenses: expenses, baseShare: share });
  });
  it("no calculator participants produces no share without erasing assigned charges", () => {
    const s = run(charged(), { type: "setCalculatorExclusions", playerIds: ["p0", "p1", "p2"] });
    expect(calculateBilling(s)).toMatchObject({ calculatorCount: 0, baseShare: null, sharedCharges: 66000 });
  });
  it.each([
    [{ kind: "none" }, 0, "No charge"],
    [{ kind: "shared", adjustment: "standard", amount: 0 }, 100, "No payment"],
    [{ kind: "shared", adjustment: "discount", amount: 40 }, 60, "No payment"],
    [{ kind: "shared", adjustment: "discount", amount: 200 }, 0, "Fully paid"],
    [{ kind: "shared", adjustment: "fixed", amount: 70, discount: 20 }, 50, "No payment"],
    [{ kind: "separate", amount: 70, discount: 200 }, 0, "Fully paid"],
  ] as const)("arrangement %j", (values, charge, status) => {
    let s = run(roster(1), { type: "setExpenses", values: { courtFee: 100, tubePrice: 0, tubes: 0, pieces: 0, piecesPerTube: 12 } });
    if (values.kind === "shared" && values.adjustment !== "fixed") {
      s.schemaVersion = 2;
      s.billing.arrangements.p0 = values;
      s = parseSession(s);
    } else s = run(s, { type: "setArrangement", playerId: "p0", values });
    expect(calculateBilling(s).rows[0]).toMatchObject({ charge, status });
  });
  it.each([1, 21999, 22000, 22001, 100000])("receipt amount %i balances independently", (amount) => {
    const t = calculateBilling(pay(charged(1), receipt("r", amount)));
    expect(t.rows[0]).toMatchObject({ received: amount, balance: Math.max(0, 22000 - amount), credit: Math.max(0, amount - 22000), status: amount < 22000 ? "Partially paid" : "Fully paid" });
  });
  it("collects before billing and preserves credit for an exempt player", () => {
    let s = pay(roster(1));
    expect(calculateBilling(s).rows[0]).toMatchObject({ status: "Unassigned", charge: null, received: 10000, credit: 10000 });
    s = run(s, { type: "setArrangement", playerId: "p0", values: { kind: "none" } });
    expect(calculateBilling(s).rows[0]).toMatchObject({ status: "No charge", charge: 0, received: 10000, credit: 10000 });
  });
  it("100 seeded ledgers match an independent integer accounting oracle", () => {
    let seed = 97421;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    for (let trial = 0; trial < 100; trial++) {
      let s = roster(1 + next() % 7);
      const expected: { amount: number; cash: number; digital: number }[] = [];
      for (const p of s.players) {
        const amount = next() % 100001;
        s = run(s, { type: "setArrangement", playerId: p.id, values: { kind: "separate", amount } });
        const row = { amount, cash: 0, digital: 0 };
        for (let i = 0; i < next() % 5; i++) {
          const method = next() % 2 ? "cash" : "digital";
          const value = 1 + next() % 50001;
          row[method] += value;
          s = pay(s, receipt(`${p.id}-${i}`, value, p.id, method));
        }
        expected.push(row);
      }
      const totals = calculateBilling(s);
      totals.rows.forEach((r, i) => {
        const e = expected[i];
        expect(r).toMatchObject({ charge: e.amount, cash: e.cash, digital: e.digital, received: e.cash + e.digital, balance: Math.max(0, e.amount - e.cash - e.digital), credit: Math.max(0, e.cash + e.digital - e.amount) });
      });
      expect(totals.received).toBe(expected.reduce((sum, r) => sum + r.cash + r.digital, 0));
      expect(totals.cash + totals.digital).toBe(totals.received);
      expect(totals.outstanding).toBe(totals.rows.reduce((sum, r) => sum + r.balance, 0));
      expect(totals.credits).toBe(totals.rows.reduce((sum, r) => sum + r.credit, 0));
    }
  });
});

describe("payment audit: boundaries and malformed data", () => {
  it.each([-1, 0, 0.5, NaN, Infinity, -Infinity, 1_000_000_001])("rejects invalid receipt amount %s", (amount) => {
    const s = charged(); const snapshot = structuredClone(s);
    expect(() => pay(s, receipt("invalid", amount))).toThrow();
    expect(s).toEqual(snapshot);
  });
  it.each([-1, 0.5, NaN, Infinity, 1_000_000_001])("rejects expense and charge amount %s", (value) => {
    expect(expensesSchema.safeParse({ ...roster().billing.expenses, courtFee: value }).success).toBe(false);
    expect(arrangementSchema.safeParse({ kind: "separate", amount: value }).success).toBe(false);
  });
  it.each([0, -1, 0.5, Infinity])("rejects pieces per tube %s", (piecesPerTube) => {
    expect(expensesSchema.safeParse({ ...roster().billing.expenses, piecesPerTube }).success).toBe(false);
  });
  it("accepts exact monetary limits but rejects aggregate overflow", () => {
    const s = pay(charged(1, 1_000_000_000), receipt("limit", 1_000_000_000));
    expect(calculateBilling(s).received).toBe(1_000_000_000);
    expect(() => pay(s, receipt("overflow", 1))).toThrow(/large/);
    expect(() => run(roster(), { type: "setExpenses", values: { courtFee: 1_000_000_000, tubePrice: 1, tubes: 1, pieces: 0, piecesPerTube: 12 } })).toThrow(/large/);
    expect(() => run(roster(), { type: "setExpenses", values: { courtFee: 0, tubePrice: 1_000_000_000, tubes: 1_000_000_000, pieces: 0, piecesPerTube: 1 } })).toThrow(/large/);
  });
  it.each([
    { method: "card" }, { playerId: "missing" }, { id: "" }, { paidAt: -1 }, { paidAt: NaN }, { paidAt: 8_000_000_000_001 }, { note: "x".repeat(501) },
  ])("rejects malformed receipt %j", (patch) => {
    expect(() => pay(charged(), { ...receipt(), ...patch } as ReturnType<typeof receipt>)).toThrow();
  });
  it("honors timestamp and note boundaries", () => {
    expect(receiptSchema.safeParse({ ...receipt(), paidAt: 0, note: "x".repeat(500) }).success).toBe(true);
    expect(receiptSchema.safeParse({ ...receipt(), paidAt: 8_000_000_000_000 }).success).toBe(true);
  });
  it.each(["duplicate-receipt", "unknown-arrangement", "unknown-estimate", "duplicate-exclusion", "unknown-exclusion", "tampered-final", "missing-final", "duplicate-final"]) ("rejects %s import without mutating its input", (kind) => {
    const s = run(ended(pay(charged())), { type: "finalizeBilling", revision: 0 });
    if (kind === "duplicate-receipt") s.billing.receipts.push(s.billing.receipts[0]);
    if (kind === "unknown-arrangement") s.billing.arrangements.missing = { kind: "none" };
    if (kind === "unknown-estimate") s.billing.estimate = { missing: 1 };
    if (kind === "duplicate-exclusion") s.billing.calculatorExcluded = ["p0", "p0"];
    if (kind === "unknown-exclusion") s.billing.calculatorExcluded = ["missing"];
    if (kind === "tampered-final") s.billing.finalized!.charges[0].amount++;
    if (kind === "missing-final") s.billing.finalized!.charges.pop();
    if (kind === "duplicate-final") s.billing.finalized!.charges[1] = s.billing.finalized!.charges[0];
    const snapshot = structuredClone(s);
    expect(() => parseSession(s)).toThrow();
    expect(s).toEqual(snapshot);
  });
});
