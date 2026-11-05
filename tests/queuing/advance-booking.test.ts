import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { initialSession, parseSession } from "../../app/queuing/state/model";
import { Command, transition } from "../../app/queuing/state/transitions";
import { commitCommand, transact } from "../../app/queuing/state/storage";
import { canQueuePlayer } from "../../app/queuing/utils";

function fixture() {
  let s = initialSession(1000);
  const run = (command: Command) => { s = transition(s, command, 2000); };
  for (let i = 0; i < 4; i++) {
    run({ type: "addPlayer", id: `p${i}`, values: { name: `Player ${i}`, gender: "Male", level: "Intermediate" } });
    run({ type: "checkInPlayer", id: `p${i}` });
    run({ type: "togglePlayerSelection", courtId: "c1", playerId: `p${i}`, selected: true });
  }
  run({ type: "startSession" });
  run({ type: "startMatch", courtId: "c1" });
  run({ type: "createQueueItem", id: "q1" });
  run({ type: "createQueueItem", id: "q2" });
  return s;
}
function booked() {
  let s = fixture();
  for (let i = 0; i < 4; i++) s = transition(s, { type: "addPlayerToQueueItem", queueId: "q1", playerId: `p${i}` }, 3000);
  return s;
}
describe("advance booking", () => {
  it("books a running roster without changing its match, timer or statistics and survives serialization", () => {
    const before = fixture();
    expect(canQueuePlayer(before.players[0], before.courts, before.queue)).toBe(true);
    const s = booked();
    expect(s.courts).toEqual(before.courts);
    expect(s.players).toEqual(before.players);
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(canQueuePlayer(s.players[0], s.courts, s.queue)).toBe(false);
    expect(() => transition(s, { type: "addPlayerToQueueItem", queueId: "q2", playerId: "p0" }, 4000)).toThrow("unavailable");
    const duplicate = structuredClone(s);
    duplicate.queue[1].team1.push("p0");
    expect(() => parseSession(duplicate)).toThrow("duplicate queued");
  });
  it.each(["finishMatch", "stopMatch"] as const)("keeps the upcoming booking after %s and allows manual assignment", (type) => {
    const s = booked();
    expect(() => transition(s, { type: "assignQueueToCourt", queueId: "q1", courtId: "c2" }, 4000)).toThrow("available");
    const ended = transition(s, type === "finishMatch"
      ? { type, courtId: "c1", startTime: 2000, players: ["p0", "p1", "p2", "p3"], values: { winningTeam: 1 }, id: "m1" }
      : { type, courtId: "c1", startTime: 2000, reason: "Stopped", id: "m1" }, 5000);
    expect(ended.queue).toEqual(s.queue);
    expect(ended.courts[0].players).toEqual([null, null, null, null]);
    const assigned = transition(ended, { type: "assignQueueToCourt", queueId: "q1", courtId: "c2" }, 6000);
    expect(assigned.courts[1].players).toEqual(["p0", "p1", "p2", "p3"]);
    expect(transition(assigned, { type: "startMatch", courtId: "c2" }, 7000).players.every((p) => p.isPlaying)).toBe(true);
  });
  it("removes a future booking without disturbing the running court", () => {
    const s = booked();
    const after = transition(s, { type: "removePlayerFromQueue", queueId: "q1", playerId: "p0" }, 4000);
    expect(after.courts).toEqual(s.courts);
    expect(after.players).toEqual(s.players);
  });
  it("rejects queued overlap with an idle court or duplicate court assignments", () => {
    const s = booked();
    const idle = structuredClone(s);
    idle.courts[0].status = "idle";
    idle.courts[0].startTime = null;
    idle.players.forEach((p) => { p.isPlaying = false; });
    expect(() => parseSession(idle)).toThrow("duplicate queued");
    const duplicate = structuredClone(s);
    duplicate.courts[1].players[0] = "p0";
    expect(() => parseSession(duplicate)).toThrow("duplicate court");
  });
  it("permits playing replacements only in upcoming matches", () => {
    let s = fixture();
    s = transition(s, { type: "addPlayer", id: "waiting", values: { name: "Waiting", gender: "Female", level: "Beginner" } }, 3000);
    s = transition(s, { type: "checkInPlayer", id: "waiting" }, 3000);
    s = transition(s, { type: "addPlayerToQueueItem", queueId: "q1", playerId: "waiting" }, 3000);
    const after = transition(s, { type: "changeQueueTeams", queueId: "q1", original: ["waiting", null, null, null], players: ["p0", null, null, null] }, 4000);
    expect(after.queue[0].team1).toEqual(["p0"]);
    expect(after.courts).toEqual(s.courts);
    expect(after.players).toEqual(s.players);
  });
});
describe("saved advance bookings", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("localStorage", { getItem: () => null });
  });
  it("rejects a competing booking without losing the first save", async () => {
    await transact((data) => ({ ...data, session: fixture() }));
    await commitCommand({ type: "addPlayerToQueueItem", queueId: "q1", playerId: "p0" }, 3000);
    const saved = await transact();
    await expect(commitCommand({ type: "addPlayerToQueueItem", queueId: "q2", playerId: "p0" }, 4000)).rejects.toThrow("unavailable");
    expect(await transact()).toEqual(saved);
  });
});
