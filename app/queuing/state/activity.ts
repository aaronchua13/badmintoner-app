import { z } from "zod";
import { calculateBilling, money, type Receipt } from "./billing";
import type { QueueData } from "./model";
import type { Command } from "./transitions";
import type { Court, Player, QueueItem } from "../types";

export const activityKinds = {
  roster: "Roster",
  attendance: "Check-in",
  availability: "Availability",
  queue: "Queue",
  court: "Court",
  match: "Match",
  payment: "Payment",
  billing: "Billing",
  profile: "Profile",
  session: "Session",
} as const;
export const playerLogSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  playerId: z.string().trim().min(1).max(200),
  playerName: z.string().trim().min(1).max(200),
  at: z.number().finite().nonnegative().max(8_640_000_000_000_000),
  kind: z.enum(["roster", "attendance", "availability", "queue", "court", "match", "payment", "billing", "profile", "session"]),
  message: z.string().trim().min(1).max(2000),
});
export type PlayerLog = z.infer<typeof playerLogSchema>;
type CourtAssignment = { court: Court; slot: number };
type QueueAssignment = { item: QueueItem; position: number; slot: number };
const team = (slot: number) => slot < 2 ? 1 : 2;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const receiptText = (r: Receipt) =>
  `${money(r.amount)} ${r.method === "cash" ? "cash" : "digital"} · paid ${new Date(r.paidAt).toISOString()}${r.note ? ` · Note: ${r.note}` : ""}`;

/** Append only after the command succeeds; these entries commit with the session. */
export function appendPlayerLogs(before: QueueData, after: QueueData, action: Command, now: number) {
  let nextId = (before.playerLogs.at(-1)?.id ?? 0) + 1;
  const add = (p: Player, kind: PlayerLog["kind"], message: string) => {
    after.playerLogs.push({ id: nextId++, playerId: p.id, playerName: p.name, at: now, kind, message: message.slice(0, 2000) });
  };
  const oldPlayers = new Map(before.players.map((p) => [p.id, p]));
  const newPlayers = new Map(after.players.map((p) => [p.id, p]));
  const courtAssignments = (s: QueueData) => {
    const result = new Map<string, CourtAssignment>();
    for (const court of s.courts)
      court.players.forEach((id, slot) => { if (id) result.set(id, { court, slot }); });
    return result;
  };
  const queueAssignments = (s: QueueData) => {
    const result = new Map<string, QueueAssignment>();
    s.queue.forEach((item, position) => {
      const slots = [item.team1[0], item.team1[1], item.team2[0], item.team2[1]];
      slots.forEach((id, slot) => { if (id) result.set(id, { item, position, slot }); });
    });
    return result;
  };
  const oldCourts = courtAssignments(before), newCourts = courtAssignments(after);
  const oldQueue = queueAssignments(before), newQueue = queueAssignments(after);
  for (const p of [...after.players, ...before.players.filter((p) => !newPlayers.has(p.id))]) {
    const old = oldPlayers.get(p.id), current = newPlayers.get(p.id);
    if (!old) add(p, "roster", "Added to the session roster");
    else if (!current) add(p, "roster", "Removed from the session roster");
    if (old && current) {
      if (old.checkedInAt !== current.checkedInAt) {
        add(p, "attendance", current.checkedInAt === null ? "Check-in undone · marked not arrived" : "Checked in");
      }
      if (old.isActive !== current.isActive)
        add(p, "availability", current.isActive ? "Marked available" : "Marked away");
      if (old.name !== current.name) add(p, "profile", `Name changed: ${old.name} → ${current.name}`);
      if (old.level !== current.level) add(p, "profile", `Level changed: ${old.level} → ${current.level}`);
      if (old.gender !== current.gender) add(p, "profile", `Gender changed: ${old.gender} → ${current.gender}`);
    }
    const fromQueue = oldQueue.get(p.id), toQueue = newQueue.get(p.id);
    // Assigning a queued lineup to a court is represented by the court entry below.
    if (action.type !== "assignQueueToCourt") {
      if (fromQueue?.item.id !== toQueue?.item.id) {
        if (fromQueue) add(p, "queue", `Removed from queued match ${fromQueue.position + 1} · Team ${team(fromQueue.slot)}`);
        if (toQueue) add(p, "queue", `Added to queued match ${toQueue.position + 1} · Team ${team(toQueue.slot)}${p.isPlaying ? " · advance booking while playing" : ""}`);
      } else if (fromQueue && toQueue && (fromQueue.slot !== toQueue.slot ||
        (action.type === "changeQueueTeams" && !same([fromQueue.item.team1, fromQueue.item.team2], [toQueue.item.team1, toQueue.item.team2])))) {
        add(p, "queue", `Queued match ${toQueue.position + 1} lineup changed · Team ${team(toQueue.slot)}`);
      } else if (action.type === "moveQueueItem" && fromQueue && toQueue && action.id === toQueue.item.id && fromQueue.position !== toQueue.position) {
        add(p, "queue", `Queued match moved from position ${fromQueue.position + 1} to ${toQueue.position + 1}`);
      }
    }
    const from = oldCourts.get(p.id), to = newCourts.get(p.id);
    const matchEnded = (action.type === "finishMatch" || action.type === "stopMatch") && from?.court.id === action.courtId;
    if (!matchEnded && from?.court.id !== to?.court.id) {
      if (from && to) add(p, "court", `Transferred from ${from.court.name} to ${to.court.name} · Team ${team(to.slot)}`);
      else if (to) add(p, to.court.status === "active" ? "match" : "court", `${to.court.status === "active" ? "Joined running match on" : "Assigned to"} ${to.court.name} · Team ${team(to.slot)}${action.type === "assignQueueToCourt" ? " · from queue" : ""}`);
      else if (from) add(p, from.court.status === "active" ? "match" : "court", `${from.court.status === "active" ? "Left running match on" : "Removed from"} ${from.court.name}`);
    } else if (from && to && (from.slot !== to.slot ||
      (action.type === "changeCourtTeams" && !same(from.court.players, to.court.players)))) {
      add(p, to.court.status === "active" ? "match" : "court", `Lineup changed on ${to.court.name} · Team ${team(to.slot)}`);
    }
    if (from && to && from.court.id === to.court.id && from.court.name !== to.court.name)
      add(p, "court", `Court renamed: ${from.court.name} → ${to.court.name}`);
    if (action.type === "startMatch" && to?.court.id === action.courtId)
      add(p, "match", `Match started on ${to.court.name} · Team ${team(to.slot)}`);
    if (matchEnded && from) {
      const match = after.history.find((m) => m.id === action.id)!;
      const result = match.isStopped ? "Match stopped" : match.winners === team(from.slot) ? "Match won" : "Match lost";
      add(p, "match", `${result} on ${from.court.name} · Team ${team(from.slot)}${match.score ? ` · Score ${match.score}` : ""}${match.reason ? ` · Reason: ${match.reason.slice(0, 500)}` : ""}`);
    }
    if (!same(before.billing.arrangements[p.id], after.billing.arrangements[p.id])) {
      const arrangement = after.billing.arrangements[p.id];
      if (!arrangement) add(p, "billing", "Player billing removed");
      else if (arrangement.kind === "none") add(p, "billing", "Billing set: No charge");
      else add(p, "billing", `Billing set: ${arrangement.kind === "shared" ? "Session payment" : "Separate payment"} · ${money(arrangement.amount)}${arrangement.discount ? ` · Discount ${money(arrangement.discount)}` : ""}${arrangement.note ? ` · Note: ${arrangement.note}` : ""}`);
    }
    if (before.sessionStatus !== after.sessionStatus)
      add(p, "session", after.sessionStatus === "active" ? "Session started" : "Session ended");
  }
  const oldReceipts = new Map(before.billing.receipts.map((r) => [r.id, r]));
  const newReceipts = new Map(after.billing.receipts.map((r) => [r.id, r]));
  for (const r of [...after.billing.receipts, ...before.billing.receipts.filter((r) => !newReceipts.has(r.id))]) {
    const old = oldReceipts.get(r.id), current = newReceipts.get(r.id);
    const p = newPlayers.get(r.playerId) ?? oldPlayers.get(r.playerId);
    if (!p) continue;
    if (!old) add(p, "payment", `Payment recorded: ${receiptText(r)}`);
    else if (!current) add(p, "payment", `Payment deleted: ${receiptText(r)}`);
    else if (!same(old, current)) add(p, "payment", `Payment edited: ${receiptText(old)} → ${receiptText(current)}`);
  }
  if (!!before.billing.finalized !== !!after.billing.finalized) {
    const totals = calculateBilling(after);
    for (const p of after.players) {
      const row = totals.rows.find((r) => r.id === p.id);
      add(p, "billing", after.billing.finalized ? `Charges finalized: ${money(row?.charge ?? 0)}` : "Settlement reopened for billing changes");
    }
  }
}
