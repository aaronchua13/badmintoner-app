import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { initialSession, parseSession, type QueueData } from "../../app/queuing/state/model";
import { transition, type Command } from "../../app/queuing/state/transitions";
import { commitCommand, transact } from "../../app/queuing/state/storage";

let time = 1000;
const run = (s: QueueData, action: Command) => transition(s, action, ++time);
function fixture() {
  let s = initialSession(time);
  for (let i = 0; i < 5; i++) {
    s = run(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i}`, level: "Intermediate", gender: "Male" } });
    s = run(s, { type: "checkInPlayer", id: `p${i}` });
  }
  return s;
}
function queued() {
  let s = run(fixture(), { type: "createQueueItem", id: "q" });
  for (let i = 0; i < 4; i++) s = run(s, { type: "addPlayerToQueueItem", queueId: "q", playerId: `p${i}` });
  return s;
}
function running() {
  let s = run(queued(), { type: "assignQueueToCourt", queueId: "q", courtId: "c1" });
  s = run(s, { type: "startSession" });
  return run(s, { type: "startMatch", courtId: "c1" });
}
const logs = (s: QueueData, id = "p0") => s.playerLogs.filter((entry) => entry.playerId === id);
const messages = (s: QueueData, id = "p0") => logs(s, id).map((entry) => entry.message);
const receipt = { id: "receipt", playerId: "p0", amount: 10000, method: "cash" as const, paidAt: 1000, note: "Deposit" };

describe("automatic player activity", () => {
  it("records arrival and availability with timestamps; no-op actions add nothing", () => {
    let s = fixture();
    const count = s.playerLogs.length;
    s = run(s, { type: "checkInPlayer", id: "p0" });
    expect(s.playerLogs).toHaveLength(count);
    s = run(s, { type: "togglePlayerActive", id: "p0" });
    s = run(s, { type: "togglePlayerActive", id: "p0" });
    s = run(s, { type: "undoCheckIn", id: "p0" });
    expect(messages(s)).toEqual(["Added to the session roster", "Checked in", "Marked away", "Marked available", "Check-in undone · marked not arrived"]);
    expect(logs(s).every((entry) => entry.playerName === "Player 0" && entry.at > 1000)).toBe(true);
    expect(s.playerLogs.every((entry, i, all) => i === 0 || entry.id > all[i - 1].id)).toBe(true);
  });
  it("records queue changes, court assignment, transfers, and clearing with historical names", () => {
    let s = queued();
    s = run(s, { type: "createQueueItem", id: "q2" });
    s = run(s, { type: "moveQueueItem", id: "q", beforeId: null });
    expect(messages(s)).toContain("Queued match moved from position 1 to 2");
    s = run(s, { type: "assignQueueToCourt", queueId: "q", courtId: "c1" });
    expect(messages(s).at(-1)).toBe("Assigned to Court 1 · Team 1 · from queue");
    s = run(s, { type: "transferMatch", from: "c1", to: "c2", original: structuredClone(s.courts[0]) });
    s = run(s, { type: "updateCourtName", id: "c2", name: "Final Court" });
    s = run(s, { type: "clearCourt", id: "c2" });
    expect(messages(s).slice(-3)).toEqual(["Transferred from Court 1 to Court 2 · Team 1", "Court renamed: Court 2 → Final Court", "Removed from Final Court"]);
    expect(messages(s)).toContain("Added to queued match 1 · Team 1");
  });
  it("records assignment removals caused by away and undo check-in", () => {
    let s = queued();
    s = run(s, { type: "togglePlayerActive", id: "p0" });
    expect(messages(s).slice(-2)).toEqual(["Marked away", "Removed from queued match 1 · Team 1"]);
    s = run(s, { type: "assignQueueToCourt", queueId: "q", courtId: "c1" });
    s = run(s, { type: "undoCheckIn", id: "p1" });
    expect(messages(s, "p1").slice(-2)).toEqual(["Check-in undone · marked not arrived", "Removed from Court 1"]);
  });
  it("records corrected lineups for unchanged participants, replacements, starts and results", () => {
    let s = running();
    const c = structuredClone(s.courts[0]);
    s = run(s, { type: "changeCourtTeams", courtId: "c1", status: "active", startTime: c.startTime, original: c.players, players: ["p4", "p1", "p2", "p3"] });
    expect(messages(s).at(-1)).toBe("Left running match on Court 1");
    expect(messages(s, "p4").at(-1)).toBe("Joined running match on Court 1 · Team 1");
    expect(messages(s, "p1").at(-1)).toBe("Lineup changed on Court 1 · Team 1");
    s = run(s, { type: "finishMatch", id: "match", courtId: "c1", startTime: c.startTime, players: s.courts[0].players, values: { team1Score: 21, team2Score: 0, winningTeam: 1 } });
    expect(messages(s, "p4").at(-1)).toBe("Match won on Court 1 · Team 1 · Score 21 - 0");
    expect(messages(s, "p2").at(-1)).toBe("Match lost on Court 1 · Team 2 · Score 21 - 0");
    expect(messages(s)).toContain("Match started on Court 1 · Team 1");
    expect(messages(s).at(-1)).toBe("Left running match on Court 1");
  });
  it("records queue lineup corrections for every participant and removal when a match is cleared", () => {
    let s = queued();
    const counts = s.players.map((p) => logs(s, p.id).length);
    s = run(s, { type: "changeQueueTeams", queueId: "q", original: ["p0", "p1", "p2", "p3"], players: ["p0", "p2", "p1", "p3"] });
    for (let i = 0; i < 4; i++) {
      expect(logs(s, `p${i}`)).toHaveLength(counts[i] + 1);
      expect(messages(s, `p${i}`).at(-1)).toContain("lineup changed");
    }
    s = run(s, { type: "removePlayersFromQueue", id: "q" });
    expect(messages(s).at(-1)).toBe("Removed from queued match 1 · Team 1");
    expect(messages(s, "p1").at(-1)).toBe("Removed from queued match 1 · Team 2");
  });
  it("records stopped matches and future queue bookings while playing", () => {
    let s = run(running(), { type: "createQueueItem", id: "future" });
    s = run(s, { type: "addPlayerToQueueItem", queueId: "future", playerId: "p0" });
    expect(messages(s).at(-1)).toBe("Added to queued match 1 · Team 1 · advance booking while playing");
    s = run(s, { type: "stopMatch", id: "stop", courtId: "c1", startTime: s.courts[0].startTime, reason: "Injury" });
    expect(messages(s).at(-1)).toBe("Match stopped on Court 1 · Team 1 · Reason: Injury");
  });
  it("retains additions, edits and deletion of payments without rewriting earlier entries", () => {
    let s = run(fixture(), { type: "saveReceipt", values: receipt, editing: false });
    const recorded = structuredClone(s.playerLogs.at(-1));
    s = run(s, { type: "saveReceipt", values: { ...receipt, amount: 25000, method: "digital", note: "Corrected" }, original: receipt, editing: true });
    s = run(s, { type: "deleteReceipt", id: receipt.id });
    expect(s.playerLogs.find((entry) => entry.id === recorded?.id)).toEqual(recorded);
    expect(logs(s).slice(-3).map((entry) => entry.kind)).toEqual(["payment", "payment", "payment"]);
    expect(messages(s).at(-2)).toContain("₱100.00 cash");
    expect(messages(s).at(-2)).toContain("₱250.00 digital");
    expect(messages(s).at(-1)).toContain("Payment deleted: ₱250.00 digital");
  });
  it("records charges, profile changes, session boundaries and settlement", () => {
    let s = run(fixture(), { type: "setArrangement", playerId: "p0", values: { kind: "shared", adjustment: "fixed", amount: 27000, discount: 5000 } });
    s = run(s, { type: "updatePlayerLevel", id: "p0", level: "Advanced" });
    s = run(s, { type: "startSession" });
    s = run(s, { type: "stopSession" });
    for (let i = 1; i < 5; i++) s = run(s, { type: "setArrangement", playerId: `p${i}`, values: { kind: "none" } });
    s = run(s, { type: "finalizeBilling", revision: 0 });
    s = run(s, { type: "reopenBilling", revision: 0 });
    expect(messages(s)).toEqual(expect.arrayContaining(["Billing set: Session payment · ₱270.00 · Discount ₱50.00", "Level changed: Intermediate → Advanced", "Session started", "Session ended", "Charges finalized: ₱220.00", "Settlement reopened for billing changes"]));
  });
  it("preserves historical player references after removal and clears logs for new sessions", () => {
    let s = run(fixture(), { type: "removePlayer", id: "p0" });
    expect(messages(s).at(-1)).toBe("Removed from the session roster");
    expect(parseSession(JSON.parse(JSON.stringify(s))).playerLogs).toEqual(s.playerLogs);
    s = run(s, { type: "restartSession" });
    expect(s.playerLogs).toEqual([]);
    expect(s.players).toHaveLength(4);
    expect(run(fixture(), { type: "resetState" }).playerLogs).toEqual([]);
  });
});

describe("log compatibility and storage", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("localStorage", { getItem: () => null });
  });
  it("upgrades older sessions without fabricating logs and preserves exports/imports", async () => {
    const old = { ...fixture(), schemaVersion: 3, playerLogs: undefined };
    expect(parseSession(old).playerLogs).toEqual([]);
    await transact((data) => ({ ...data, session: old as unknown as QueueData }));
    expect((await transact()).session).toMatchObject({ schemaVersion: 4, playerLogs: [] });
    const exported = JSON.parse(JSON.stringify(fixture()));
    const imported = run(initialSession(time), { type: "importSession", data: exported, revision: 0 });
    expect(imported.playerLogs).toEqual(exported.playerLogs);
  });
  it("does not invent check-ins when normalizing legacy attendance or repeat unchanged billing", () => {
    const base = fixture();
    const old = { ...base, schemaVersion: 3, playerLogs: undefined, players: base.players.map((p) => ({ ...p, checkedInAt: undefined })) };
    let s = run(old as unknown as QueueData, { type: "createQueueItem", id: "q" });
    expect(s.playerLogs).toEqual([]);
    s = run(s, { type: "setArrangement", playerId: "p0", values: { kind: "none" } });
    const before = structuredClone(s.playerLogs);
    s = run(s, { type: "setArrangement", playerId: "p0", values: { kind: "none" } });
    s = run(s, { type: "checkInPlayer", id: "p0" });
    expect(s.playerLogs).toEqual(before);
  });
  it("rejects malformed logs, missing version 4 logs, duplicates and out-of-order entries", () => {
    const s = fixture();
    expect(() => parseSession({ ...s, playerLogs: undefined })).toThrow("require player logs");
    for (const patch of [{ at: -1 }, { at: 1e30 }, { kind: "invalid" }, { message: "" }, { id: 0 }])
      expect(() => parseSession({ ...s, playerLogs: [{ ...s.playerLogs[0], ...patch }] })).toThrow();
    expect(() => parseSession({ ...s, playerLogs: [s.playerLogs[0], s.playerLogs[0]] })).toThrow("recording order");
    expect(() => parseSession({ ...s, playerLogs: [...s.playerLogs].reverse() })).toThrow("recording order");
  });
  it("commits concurrent actions with unique log IDs and rejects stale edits without phantom logs", async () => {
    await transact((data) => ({ ...data, session: fixture() }));
    await Promise.all([
      commitCommand({ type: "togglePlayerActive", id: "p0" }, 10000),
      commitCommand({ type: "togglePlayerActive", id: "p1" }, 10000),
    ]);
    let s = (await transact()).session;
    expect(messages(s).at(-1)).toBe("Marked away");
    expect(messages(s, "p1").at(-1)).toBe("Marked away");
    expect(new Set(s.playerLogs.map((entry) => entry.id)).size).toBe(s.playerLogs.length);
    await commitCommand({ type: "saveReceipt", values: receipt, editing: false }, 11000);
    await commitCommand({ type: "saveReceipt", values: { ...receipt, amount: 20000 }, original: receipt, editing: true }, 12000);
    const saved = await transact();
    await expect(commitCommand({ type: "saveReceipt", values: { ...receipt, note: "Stale" }, original: receipt, editing: true }, 13000)).rejects.toThrow("reopen");
    expect(await transact()).toEqual(saved);
    s = saved.session;
    expect(logs(s).filter((entry) => entry.kind === "payment")).toHaveLength(2);
  });
});
