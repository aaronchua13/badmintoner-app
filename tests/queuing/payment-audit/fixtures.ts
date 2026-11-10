import { initialSession, type QueueData } from "../../../app/queuing/state/model";
import { transition, type Command } from "../../../app/queuing/state/transitions";
import type { Receipt } from "../../../app/queuing/state/billing";
export const NOW = 1_800_000_000_000;
export const run = (s: QueueData, command: Command) => transition(s, command, NOW);
export function roster(count = 3) {
  let s = initialSession(NOW - 60_000);
  for (let i = 0; i < count; i++) s = run(s, { type: "addPlayer", id: `p${i}`, values: { name: `Audit Player ${i}`, gender: "Male", level: "Intermediate" } });
  return s;
}
export function charged(count = 3, amount = 22000) {
  let s = roster(count);
  for (const p of s.players) s = run(s, { type: "setArrangement", playerId: p.id, values: { kind: "shared", adjustment: "fixed", amount } });
  return s;
}
export function receipt(id = "r1", amount = 10000, playerId = "p0", method: Receipt["method"] = "cash"): Receipt {
  return { id, amount, playerId, method, paidAt: NOW, note: "Synthetic audit payment" };
}
export const pay = (s: QueueData, r = receipt()) => run(s, { type: "saveReceipt", editing: false, values: r });
export const ended = (s: QueueData) => run(run(s, { type: "startSession" }), { type: "stopSession" });
