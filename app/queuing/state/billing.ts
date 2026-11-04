import { z } from "zod";
import type { QueueData } from "./model";

const integer = z.number().int().nonnegative().max(1_000_000_000);
const id = z.string().trim().min(1).max(200);
export const expensesSchema = z.object({
  courtFee: integer,
  tubePrice: integer,
  piecesPerTube: integer.refine((v) => v > 0, "Enter pieces per tube"),
  tubes: integer,
  pieces: integer,
});
export const arrangementSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("shared"),
    adjustment: z.enum(["standard", "discount", "fixed"]),
    amount: integer,
    discount: integer.optional(),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    kind: z.literal("separate"),
    amount: integer,
    discount: integer.optional(),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({ kind: z.literal("none") }),
]);
export const receiptSchema = z.object({
  id,
  playerId: id,
  amount: integer.refine((v) => v > 0, "Enter a positive payment"),
  method: z.enum(["cash", "digital"]),
  paidAt: z.number().finite().nonnegative().max(8_000_000_000_000),
  note: z.string().trim().max(500),
});
const chargeSchema = z.object({
  playerId: id,
  arrangement: arrangementSchema,
  amount: integer,
});
export const billingSchema = z.object({
  expenses: expensesSchema,
  calculatorExcluded: z.array(id).default([]),
  arrangements: z.record(arrangementSchema),
  receipts: z.array(receiptSchema),
  estimate: z.record(integer).nullable(),
  finalized: z
    .object({
      at: z.number().finite().nonnegative(),
      charges: z.array(chargeSchema),
    })
    .nullable(),
});
export type Expenses = z.infer<typeof expensesSchema>;
export type Arrangement = z.infer<typeof arrangementSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Billing = z.infer<typeof billingSchema>;
export const emptyBilling = (): Billing => ({
  expenses: {
    courtFee: 0,
    tubePrice: 0,
    piecesPerTube: 12,
    tubes: 0,
    pieces: 0,
  },
  calculatorExcluded: [],
  arrangements: {},
  receipts: [],
  estimate: null,
  finalized: null,
});
export const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    value / 100,
  );
export function calculateBilling(s: Pick<QueueData, "players" | "billing">) {
  const b = s.billing;
  const e = b.expenses;
  const shuttleCost = Math.round(
    e.tubePrice * (e.tubes + e.pieces / e.piecesPerTube),
  );
  const totalExpenses = e.courtFee + shuttleCost;
  const count = s.players.filter(
    (p) => !b.calculatorExcluded.includes(p.id),
  ).length;
  const baseShare = count ? Math.round(totalExpenses / count) : null;
  const rows = s.players.map((p) => {
    const frozen = b.finalized?.charges.find((c) => c.playerId === p.id);
    const arrangement = frozen?.arrangement ?? b.arrangements[p.id];
    let charge: number | null = null;
    if (arrangement?.kind === "none") charge = 0;
    if (arrangement?.kind === "separate")
      charge = Math.max(0, arrangement.amount - (arrangement.discount ?? 0));
    if (arrangement?.kind === "shared")
      charge =
        arrangement.adjustment === "fixed"
          ? Math.max(0, arrangement.amount - (arrangement.discount ?? 0))
          : Math.max(
              0,
              (baseShare ?? 0) -
                (arrangement.adjustment === "discount"
                  ? Math.max(
                      0,
                      arrangement.amount - (arrangement.discount ?? 0),
                    )
                  : 0),
            );
    if (frozen) charge = frozen.amount;
    const receipts = b.receipts.filter((r) => r.playerId === p.id);
    const cash = receipts
      .filter((r) => r.method === "cash")
      .reduce((a, r) => a + r.amount, 0);
    const digital = receipts
      .filter((r) => r.method === "digital")
      .reduce((a, r) => a + r.amount, 0);
    const received = cash + digital;
    const balance = charge === null ? 0 : Math.max(0, charge - received);
    const credit = Math.max(0, received - (charge ?? 0));
    const status = !arrangement
      ? "Unassigned"
      : arrangement.kind === "none"
        ? "No charge"
        : received >= (charge ?? 0)
          ? "Fully paid"
          : received > 0
            ? "Partially paid"
            : "No payment";
    return {
      ...p,
      arrangement,
      charge,
      receipts,
      cash,
      digital,
      received,
      balance,
      credit,
      status,
    };
  });
  const sum = (key: "cash" | "digital" | "received" | "balance" | "credit") =>
    rows.reduce((a, r) => a + r[key], 0);
  const sharedCharges = rows
    .filter((r) => r.arrangement?.kind === "shared")
    .reduce((a, r) => a + (r.charge ?? 0), 0);
  const separateCharges = rows
    .filter((r) => r.arrangement?.kind === "separate")
    .reduce((a, r) => a + (r.charge ?? 0), 0);
  return {
    rows,
    shuttleCost,
    totalExpenses,
    baseShare,
    calculatorCount: count,
    sharedCharges,
    separateCharges,
    difference: sharedCharges - totalExpenses,
    cash: sum("cash"),
    digital: sum("digital"),
    received: sum("received"),
    outstanding: sum("balance"),
    credits: sum("credit"),
  };
}
export function validateBilling(s: QueueData) {
  const b = s.billing;
  const ids = new Set(s.players.map((p) => p.id));
  if (
    new Set(b.calculatorExcluded).size !== b.calculatorExcluded.length ||
    b.calculatorExcluded.some((id) => !ids.has(id))
  )
    throw new Error("Invalid calculator player selection");
  if (
    Object.keys(b.arrangements).some((id) => !ids.has(id)) ||
    b.receipts.some((r) => !ids.has(r.playerId)) ||
    Object.keys(b.estimate ?? {}).some((id) => !ids.has(id))
  )
    throw new Error("Billing references an unknown player");
  if (new Set(b.receipts.map((r) => r.id)).size !== b.receipts.length)
    throw new Error("Duplicate payment IDs");
  const totals = calculateBilling(s);
  if (
    [
      totals.totalExpenses,
      totals.sharedCharges,
      totals.separateCharges,
      totals.received,
      ...totals.rows.map((r) => r.charge ?? 0),
    ].some((v) => !Number.isSafeInteger(v) || v > 1_000_000_000)
  )
    throw new Error("Billing totals are too large");
  if (b.finalized) {
    if (s.sessionStatus !== "ended")
      throw new Error("Final charges require an ended session");
    const charges = b.finalized.charges;
    if (
      new Set(charges.map((c) => c.playerId)).size !== charges.length ||
      charges.length !== ids.size ||
      charges.some(
        (c) =>
          !ids.has(c.playerId) ||
          JSON.stringify(c.arrangement) !==
            JSON.stringify(b.arrangements[c.playerId]),
      )
    )
      throw new Error("Invalid final billing snapshot");
    const live = calculateBilling({ ...s, billing: { ...b, finalized: null } });
    if (
      charges.some(
        (c) => live.rows.find((r) => r.id === c.playerId)?.charge !== c.amount,
      )
    )
      throw new Error("Final charges disagree with billing");
  }
}

// Freeze the amounts already shown by older automatic billing; keep all receipts.
export function migrateManualBilling(s: QueueData) {
  const b = s.billing;
  const shared = s.players.filter(
    (p) => b.arrangements[p.id]?.kind === "shared",
  );
  b.calculatorExcluded = shared.length
    ? s.players
        .filter((p) => b.arrangements[p.id]?.kind !== "shared")
        .map((p) => p.id)
    : s.players.map((p) => p.id);
  validateBilling(s);
  const rows = calculateBilling(s).rows;
  for (const row of rows) {
    if (row.arrangement?.kind === "shared") {
      const arrangement: Arrangement = {
        kind: "shared",
        adjustment: "fixed",
        amount: row.charge!,
      };
      b.arrangements[row.id] = arrangement;
      const frozen = b.finalized?.charges.find((c) => c.playerId === row.id);
      if (frozen) frozen.arrangement = arrangement;
    }
  }
  b.calculatorExcluded = [];
}
