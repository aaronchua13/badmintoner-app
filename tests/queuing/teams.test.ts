import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { initialSession } from "../../app/queuing/state/model";
import { Command, TeamSlots, transition } from "../../app/queuing/state/transitions";
import { commitCommand, transact } from "../../app/queuing/state/storage";
const original: TeamSlots = ["p0", "p1", "p2", "p3"];
const swapped: TeamSlots = ["p0", "p2", "p1", "p3"];
function fixture(active = false) {
  let s = initialSession(1000);
  for (let i = 0; i < 4; i++) {
    s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i}`, gender: "Male", level: "Intermediate" } }, 1000);
    s = transition(s, { type: "checkInPlayer", id: `p${i}` }, 1000);
    s = transition(s, { type: "togglePlayerSelection", courtId: "c1", playerId: `p${i}`, selected: true }, 1000);
  }
  s = transition(s, { type: "startSession" }, 1000);
  return active ? transition(s, { type: "startMatch", courtId: "c1" }, 2000) : s;
}
function change(active = false): Command {
  return { type: "changeCourtTeams", courtId: "c1", original, players: swapped, status: active ? "active" : "idle", startTime: active ? 2000 : null };
}
describe("team correction", () => {
  it.each([false, true])("rearranges a court without changing timer or player stats (active=%s)", (active) => {
    const before = fixture(active);
    const after = transition(before, change(active), 9000);
    expect(after.courts[0]).toEqual({ ...before.courts[0], players: swapped });
    expect(after.players).toEqual(before.players);
    expect(before.courts[0].players).toEqual(original);
  });
  it("records corrected winners, partners, and history", () => {
    const s = transition(fixture(true), change(true), 9000);
    const ended = transition(s, { type: "finishMatch", courtId: "c1", startTime: 2000, players: swapped, values: { winningTeam: 1 }, id: "match" }, 12000);
    expect(ended.players.map((p) => p.wins)).toEqual([1, 0, 1, 0]);
    expect(ended.players[0].partners).toEqual({ p2: 1 });
    expect(ended.history[0].players.map((p) => [p.id, p.team])).toEqual([["p0", 1], ["p2", 1], ["p1", 2], ["p3", 2]]);
    expect(ended.history[0].duration).toBe(10);
    expect(() => transition(s, { type: "finishMatch", courtId: "c1", startTime: 2000, players: original, values: { winningTeam: 1 }, id: "stale" }, 12000)).toThrow("Reopen Finish Match");
  });
  it("moves into empty court slots", () => {
    let s = fixture();
    s = transition(s, { type: "togglePlayerSelection", courtId: "c1", playerId: "p3", selected: false }, 2000);
    const next = transition(s, { type: "changeCourtTeams", courtId: "c1", status: "idle", startTime: null, original: s.courts[0].players, players: ["p0", null, "p2", "p1"] }, 3000);
    expect(next.courts[0].players).toEqual(["p0", null, "p2", "p1"]);
  });
  it("compacts queue slots while preserving team membership, order and timestamp", () => {
    let s = transition(fixture(), { type: "clearCourt", id: "c1" }, 2000);
    s = transition(s, { type: "createQueueItem", id: "q1" }, 2000);
    s = transition(s, { type: "createQueueItem", id: "q2" }, 2000);
    for (const playerId of original.slice(0, 3) as string[]) s = transition(s, { type: "addPlayerToQueueItem", queueId: "q1", playerId }, 2000);
    const after = transition(s, { type: "changeQueueTeams", queueId: "q1", original: ["p0", "p1", "p2", null], players: ["p0", null, "p2", "p1"] }, 3000);
    expect(after.queue).toEqual([{ ...s.queue[0], team1: ["p0"], team2: ["p2", "p1"] }, s.queue[1]]);
    expect(transition(after, { type: "assignQueueToCourt", queueId: "q1", courtId: "c1" }, 4000).courts[0].players).toEqual(["p0", null, "p2", "p1"]);
  });
  it("rejects stale, missing, ended, and invalid changes", () => {
    const s = fixture();
    const command = change();
    expect(() => transition(transition(s, command, 2000), command, 3000)).toThrow("Reopen");
    expect(() => transition(fixture(true), command, 3000)).toThrow("Reopen");
    expect(() => transition(s, { ...command, courtId: "missing" } as Command, 3000)).toThrow("no longer exists");
    expect(() => transition(transition(s, { type: "stopSession" }, 3000), command, 4000)).toThrow("new session");
    for (const players of [["p0", "p0", "p2", "p3"], ["p0", null, "p2", "p3"], ["p0", "other", "p2", "p3"]] as TeamSlots[]) {
      expect(() => transition(s, { ...command, players } as Command, 3000)).toThrow(/same number|no longer available/);
    }
  });
});
describe("saved team changes", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("localStorage", { getItem: () => null });
  });
  it("rechecks replacement availability at commit time", async () => {
    await transact((data) => ({ ...data, session: withWaiting(true) }));
    await commitCommand({ type: "createQueueItem", id: "other" }, 4000);
    await commitCommand({ type: "addPlayerToQueueItem", queueId: "other", playerId: "waiting" }, 4000);
    const saved = await transact();
    await expect(commitCommand({ ...change(true), players: replaced } as Command, 9000)).rejects.toThrow("no longer available");
    expect(await transact()).toEqual(saved);
  });
  it("rejects a competing edit without overwriting the first save", async () => {
    await transact((data) => ({ ...data, session: fixture(true) }));
    await commitCommand(change(true), 3000);
    const saved = await transact();
    await expect(commitCommand(change(true), 4000)).rejects.toThrow("Reopen");
    expect(await transact()).toEqual(saved);
  });
});

function withWaiting(active = false) {
  let s = transition(fixture(active), { type: "addPlayer", id: "waiting", values: { name: "Waiting Player", gender: "Female", level: "Beginner" } }, 3000);
  s = transition(s, { type: "checkInPlayer", id: "waiting" }, 3000);
  return s;
}
const replaced: TeamSlots = ["waiting", "p1", "p2", "p3"];
describe("waiting-player replacements", () => {
  it.each([false, true])("replaces a court player and returns the old player to waiting (active=%s)", (active) => {
    const before = withWaiting(active);
    const after = transition(before, { ...change(active), players: replaced } as Command, 9000);
    expect(after.courts[0]).toEqual({ ...before.courts[0], players: replaced });
    expect(after.players.find((p) => p.id === "p0")?.isPlaying).toBe(false);
    expect(after.players.find((p) => p.id === "waiting")?.isPlaying).toBe(active);
    expect(after.players.every((p) => p.gamesPlayed === 0)).toBe(true);
    if (active) {
      expect(after.players.find((p) => p.id === "p0")?.lastMatchEndTime).toBe(9000);
      const ended = transition(after, { type: "finishMatch", courtId: "c1", startTime: 2000, players: replaced, values: { winningTeam: 1 }, id: "replaced-match" }, 12000);
      expect(ended.players.find((p) => p.id === "p0")?.gamesPlayed).toBe(0);
      expect(ended.players.find((p) => p.id === "waiting")?.wins).toBe(1);
      expect(ended.history[0].players.map((p) => p.id)).toEqual(replaced);
    } else {
      expect(after.players).toEqual(before.players);
    }
  });
  it("replaces a queued player without changing queue metadata", () => {
    let s = transition(withWaiting(), { type: "clearCourt", id: "c1" }, 4000);
    s = transition(s, { type: "createQueueItem", id: "q" }, 4000);
    for (const playerId of original as string[]) s = transition(s, { type: "addPlayerToQueueItem", queueId: "q", playerId }, 4000);
    const after = transition(s, { type: "changeQueueTeams", queueId: "q", original, players: replaced }, 9000);
    expect(after.queue[0]).toEqual({ ...s.queue[0], team1: ["waiting", "p1"] });
    expect(after.players).toEqual(s.players);
    expect(after.courts).toEqual(s.courts);
  });
  it.each(["absent", "away", "court", "queue", "playing", "missing"])("rejects a replacement who is %s", (status) => {
    let s = withWaiting();
    if (status === "absent") s = transition(s, { type: "undoCheckIn", id: "waiting" }, 4000);
    if (status === "away") s = transition(s, { type: "togglePlayerActive", id: "waiting" }, 4000);
    if (status === "court" || status === "playing") s = transition(s, { type: "togglePlayerSelection", courtId: "c2", playerId: "waiting", selected: true }, 4000);
    if (status === "playing") {
      for (let i = 0; i < 3; i++) {
        const id = `extra${i}`;
        s = transition(s, { type: "addPlayer", id, values: { name: id, gender: "Male", level: "Beginner" } }, 4000);
        s = transition(s, { type: "checkInPlayer", id }, 4000);
        s = transition(s, { type: "togglePlayerSelection", courtId: "c2", playerId: id, selected: true }, 4000);
      }
      s = transition(s, { type: "startMatch", courtId: "c2" }, 4000);
    }
    if (status === "queue") {
      s = transition(s, { type: "createQueueItem", id: "q" }, 4000);
      s = transition(s, { type: "addPlayerToQueueItem", queueId: "q", playerId: "waiting" }, 4000);
    }
    if (status === "missing") s = transition(s, { type: "removePlayer", id: "waiting" }, 4000);
    const snapshot = structuredClone(s);
    expect(() => transition(s, { ...change(), players: replaced } as Command, 9000)).toThrow("no longer available");
    expect(s).toEqual(snapshot);
  });
  it("keeps waiting time accrued before joining a running game", () => {
    const s = withWaiting(true);
    const waiting = s.players.find((p) => p.id === "waiting")!;
    waiting.gamesPlayed = 1;
    waiting.totalIdleTime = 2;
    waiting.lastMatchEndTime = 4000;
    waiting.firstMatchTime = 1000;
    const after = transition(s, { ...change(true), players: replaced } as Command, 9000);
    expect(after.players.find((p) => p.id === "waiting")).toMatchObject({ totalIdleTime: 7, firstMatchTime: 1000, gamesPlayed: 1 });
  });
});
