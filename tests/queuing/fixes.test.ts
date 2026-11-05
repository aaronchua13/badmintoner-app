import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { initialSession, parseSession } from "../../app/queuing/state/model";
import { Command, Scores, transition } from "../../app/queuing/state/transitions";
import { commitCommand, transact } from "../../app/queuing/state/storage";
import { getTotalIdleTime, isWaitingPlayer } from "../../app/queuing/utils";

function fixture(active = false) {
  let s = initialSession(1000);
  for (let i = 0; i < 5; i++) {
    s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i}`, gender: "Male", level: "Intermediate" } }, 1000);
    s = transition(s, { type: "checkInPlayer", id: `p${i}` }, 1000);
    if (i < 4) s = transition(s, { type: "togglePlayerSelection", courtId: "c1", playerId: `p${i}`, selected: true }, 1000);
  }
  s = transition(s, { type: "startSession" }, 2000);
  return active ? transition(s, { type: "startMatch", courtId: "c1" }, 3000) : s;
}
const finish = (values: Scores): Command => ({ type: "finishMatch", courtId: "c1", players: ["p0", "p1", "p2", "p3"], startTime: 3000, id: "match", values });

describe("consistent match results", () => {
  it.each([
    { team1Score: 21, team2Score: 0, winningTeam: 1 },
    { team1Score: 0, team2Score: 21, winningTeam: 2 },
    { winningTeam: 1 },
  ])("records valid results %j", (values) => {
    const s = transition(fixture(true), finish(values), 4000);
    expect(s.history[0].winners).toBe(values.winningTeam);
    expect(s.players.slice(0, 4).map((p) => p.wins)).toEqual(values.winningTeam === 1 ? [1, 1, 0, 0] : [0, 0, 1, 1]);
  });
  it.each([
    { team1Score: 0, team2Score: 21, winningTeam: 1 },
    { team1Score: 21, team2Score: 0, winningTeam: 2 },
    { team1Score: 21, team2Score: 21, winningTeam: 1 },
    { team1Score: 0, team2Score: 0, winningTeam: 1 },
    { team1Score: 21, winningTeam: 1 },
    { team1Score: -1, team2Score: 21, winningTeam: 2 },
    { team1Score: 20.5, team2Score: 21, winningTeam: 2 },
    {},
  ])("rejects invalid results without mutating the session %j", (values) => {
    const s = fixture(true), before = structuredClone(s);
    expect(() => transition(s, finish(values), 4000)).toThrow();
    expect(s).toEqual(before);
  });
  it("keeps legacy contradictory history readable", () => {
    const s = transition(fixture(true), finish({ team1Score: 21, team2Score: 0, winningTeam: 1 }), 4000);
    s.history[0].score = "0 - 21";
    expect(parseSession(s).history[0].score).toBe("0 - 21");
  });
});

describe("transaction-time conflict checks", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("localStorage", { getItem: () => null });
  });
  const original = { id: "receipt", playerId: "p0", amount: 10000, method: "cash" as const, paidAt: 1000, note: "Original" };
  async function seedReceipt() {
    await transact((data) => ({ ...data, session: fixture() }));
    await commitCommand({ type: "saveReceipt", values: original, editing: false }, 4000);
  }
  it.each(["amount", "method", "paidAt", "note"] as const)("rejects a stale receipt after %s changes", async (field) => {
    await seedReceipt();
    const values = { ...original, [field]: { amount: 25000, method: "digital", paidAt: 2000, note: "Corrected" }[field] };
    await commitCommand({ type: "saveReceipt", editing: true, original, values }, 5000);
    const saved = await transact();
    await expect(commitCommand({ type: "saveReceipt", editing: true, original, values: { ...original, note: "Stale draft" } }, 6000)).rejects.toThrow("reopen");
    expect(await transact()).toEqual(saved);
  });
  it("rejects deleted receipts and permits unrelated changes", async () => {
    await seedReceipt();
    await commitCommand({ type: "createQueueItem", id: "unrelated" }, 5000);
    await commitCommand({ type: "saveReceipt", editing: true, original, values: { ...original, amount: 15000 } }, 6000);
    const current = (await transact()).session.billing.receipts[0];
    await commitCommand({ type: "deleteReceipt", id: original.id }, 7000);
    const saved = await transact();
    await expect(commitCommand({ type: "saveReceipt", editing: true, original: current, values: { ...current, note: "Stale" } }, 8000)).rejects.toThrow("reopen");
    expect(await transact()).toEqual(saved);
  });
  it.each([false, true])("valid transfers preserve teams and timers (active=%s)", async (active) => {
    const session = fixture(active);
    await transact((data) => ({ ...data, session }));
    const original = structuredClone(session.courts[0]);
    await commitCommand({ type: "transferMatch", from: "c1", to: "c2", original }, 5000);
    const saved = (await transact()).session;
    expect(saved.courts[1]).toEqual({ ...original, id: "c2", name: "Court 2" });
    expect(saved.courts[0]).toMatchObject({ status: "idle", startTime: null, players: [null, null, null, null] });
    expect(saved.players).toEqual(session.players);
  });
  it.each(["lineup", "status", "timer", "destination"])("rejects changed %s atomically", async (change) => {
    const session = fixture(change === "timer");
    await transact((data) => ({ ...data, session }));
    const original = structuredClone(session.courts[0]);
    if (change === "lineup") {
      await commitCommand({ type: "clearCourt", id: "c1" }, 4000);
      await commitCommand({ type: "togglePlayerSelection", courtId: "c1", playerId: "p4", selected: true }, 4001);
    } else if (change === "status") {
      await commitCommand({ type: "startMatch", courtId: "c1" }, 4000);
    } else if (change === "timer") {
      await commitCommand({ type: "stopMatch", courtId: "c1", startTime: 3000, reason: "", id: "stopped" }, 4000);
      for (let i = 0; i < 4; i++) await commitCommand({ type: "togglePlayerSelection", courtId: "c1", playerId: `p${i}`, selected: true }, 4001);
      await commitCommand({ type: "startMatch", courtId: "c1" }, 4002);
    } else {
      await commitCommand({ type: "togglePlayerSelection", courtId: "c2", playerId: "p4", selected: true }, 4000);
    }
    const saved = await transact();
    await expect(commitCommand({ type: "transferMatch", from: "c1", to: "c2", original }, 5000)).rejects.toThrow("Reopen");
    expect(await transact()).toEqual(saved);
  });
});

it("shares accumulated idle rules and clamps negative current waits", () => {
  const p = { ...fixture().players[4], totalIdleTime: 120, gamesPlayed: 1, lastMatchEndTime: 4000 };
  expect(getTotalIdleTime(p, 2000, 64000)).toBe(180);
  expect(getTotalIdleTime(p, 2000, 3000)).toBe(120);
  expect(getTotalIdleTime({ ...p, gamesPlayed: 0 }, 2000, 64000)).toBe(120);
  expect(getTotalIdleTime({ ...p, isPlaying: true }, 2000, 64000)).toBe(120);
  expect(getTotalIdleTime({ ...p, checkedInAt: null }, 2000, 64000)).toBe(120);
  expect(getTotalIdleTime({ ...p, isActive: false }, 2000, 64000)).toBe(180);
  expect(getTotalIdleTime(p, null, 64000)).toBe(120);
});
it("waiting eligibility excludes every unavailable or assigned state", () => {
  const s = fixture(), p = s.players[4];
  expect(isWaitingPlayer(p, s.courts, [])).toBe(true);
  expect(isWaitingPlayer(s.players[0], s.courts, [])).toBe(false);
  expect(isWaitingPlayer(p, s.courts, [{ id: "q", team1: [p.id], team2: [], createdAt: 0 }])).toBe(false);
  for (const change of [{ isPlaying: true }, { isActive: false }, { checkedInAt: null }])
    expect(isWaitingPlayer({ ...p, ...change }, [], [])).toBe(false);
});
