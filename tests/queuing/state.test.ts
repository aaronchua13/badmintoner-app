import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { initialSession, parseSession } from "../../app/queuing/state/model";
import { transition, Command } from "../../app/queuing/state/transitions";
import { commitCommand, transact } from "../../app/queuing/state/storage";
let time = 1000;
function run(s: ReturnType<typeof initialSession>, command: Command) {
  return transition(s, command, ++time);
}
function ready() {
  let s = initialSession(time);
  for (let i = 0; i < 4; i++) {
    s = run(s, {
      type: "addPlayer",
      id: `p${i}`,
      values: { name: `Player ${i}`, gender: "Male", level: "Intermediate" },
    });
    s = run(s, { type: "checkInPlayer", id: `p${i}` });
    s = run(s, {
      type: "togglePlayerSelection",
      courtId: "c1",
      playerId: `p${i}`,
      selected: true,
    });
  }
  return run(s, { type: "startSession" });
}
describe("session transitions", () => {
  it("records a zero score and rejects duplicate completion", () => {
    const started = run(ready(), { type: "startMatch", courtId: "c1" });
    const action: Command = {
      type: "finishMatch",
      courtId: "c1",
      startTime: started.courts[0].startTime,
      id: "m1",
      values: { team1Score: 21, team2Score: 0, winningTeam: 1 },
    };
    const finished = run(started, action);
    expect(finished.history[0].score).toBe("21 - 0");
    expect(finished.players.map((p) => p.wins)).toEqual([1, 1, 0, 0]);
    expect(finished.players.map((p) => p.gamesPlayed)).toEqual([1, 1, 1, 1]);
    expect(() => run(finished, action)).toThrow("already ended");
  });
  it("blocks ending a session until running matches are resolved", () => {
    const s = run(ready(), { type: "startMatch", courtId: "c1" });
    expect(() => run(s, { type: "stopSession" })).toThrow("Court 1");
    const stopped = run(s, {
      type: "stopMatch",
      courtId: "c1",
      startTime: s.courts[0].startTime,
      reason: "Injury",
      id: "stop",
    });
    expect(
      stopped.players.every((p) => p.gamesPlayed === 0 && !p.isPlaying),
    ).toBe(true);
    expect(run(stopped, { type: "stopSession" }).sessionStatus).toBe("ended");
  });
  it("preserves team slots in an incomplete queue and rejects stale assignment", () => {
    let s = run(ready(), { type: "clearCourt", id: "c1" });
    s = run(s, { type: "createQueueItem", id: "q1" });
    for (let i = 0; i < 4; i++)
      s = run(s, {
        type: "addPlayerToQueueItem",
        queueId: "q1",
        playerId: `p${i}`,
      });
    s = run(s, {
      type: "removePlayerFromQueue",
      queueId: "q1",
      playerId: "p0",
    });
    const assigned = run(s, {
      type: "assignQueueToCourt",
      queueId: "q1",
      courtId: "c1",
    });
    expect(assigned.courts[0].players).toEqual(["p1", null, "p2", "p3"]);
    expect(() =>
      run(assigned, {
        type: "assignQueueToCourt",
        queueId: "q1",
        courtId: "c2",
      }),
    ).toThrow();
    expect(() => run(assigned, { type: "startMatch", courtId: "c1" })).toThrow(
      "four",
    );
  });
  it("removes queue references when a player goes away or is removed", () => {
    let s = run(ready(), { type: "clearCourt", id: "c1" });
    s = run(s, { type: "createQueueItem", id: "q" });
    s = run(s, { type: "addPlayerToQueueItem", queueId: "q", playerId: "p0" });
    s = run(s, { type: "togglePlayerActive", id: "p0" });
    expect(s.queue[0].team1).toEqual([]);
    expect(() =>
      run(s, { type: "addPlayerToQueueItem", queueId: "q", playerId: "p0" }),
    ).toThrow("unavailable");
  });
  it("does not displace players from an occupied idle court", () => {
    const s = run(ready(), { type: "createQueueItem", id: "q" });
    expect(() =>
      run(s, { type: "assignQueueToCourt", queueId: "q", courtId: "c1" }),
    ).toThrow("empty");
  });
  it("rejects invalid imports and keeps historical references to removed players", () => {
    expect(() =>
      parseSession({ ...initialSession(time), courts: [{}] }),
    ).toThrow();
    const s = ready();
    s.courts[0].players[0] = "missing";
    expect(() => parseSession(s)).toThrow("Invalid");
    const started = run(ready(), { type: "startMatch", courtId: "c1" });
    const ended = run(started, {
      type: "finishMatch",
      courtId: "c1",
      startTime: started.courts[0].startTime,
      values: { winningTeam: 2 },
      id: "m",
    });
    expect(
      parseSession(run(ended, { type: "removePlayer", id: "p0" })).history[0]
        .players[0].id,
    ).toBe("p0");
  });
  it("accepts valid legacy fields without changing original data", () => {
    const legacy = JSON.parse(JSON.stringify(ready()));
    delete legacy.schemaVersion;
    delete legacy.courtHistory;
    delete legacy.players[0].gender;
    delete legacy.players[0].isActive;
    const parsed = parseSession(legacy);
    expect(parsed.players[0].gender).toBe("Male");
    expect(parsed.courtHistory).toHaveLength(2);
    expect(legacy.schemaVersion).toBeUndefined();
  });
  it("rejects a stale finish after a new match starts on the same court", () => {
    let s = run(ready(), { type: "startMatch", courtId: "c1" });
    const old = s.courts[0].startTime;
    s = run(s, {
      type: "stopMatch",
      courtId: "c1",
      startTime: old,
      reason: "",
      id: "m1",
    });
    for (let i = 0; i < 4; i++)
      s = run(s, {
        type: "togglePlayerSelection",
        courtId: "c1",
        playerId: `p${i}`,
        selected: true,
      });
    s = run(s, { type: "startMatch", courtId: "c1" });
    expect(() =>
      run(s, {
        type: "finishMatch",
        courtId: "c1",
        startTime: old,
        values: { winningTeam: 1 },
        id: "m2",
      }),
    ).toThrow("changed");
  });
});
describe("transactional persistence", () => {
  let local: Map<string, string>;
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    local = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => local.get(key) ?? null,
    });
  });
  it("merges simultaneous independent commands against the latest committed session", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        commitCommand(
          {
            type: "addPlayer",
            id: `p${i}`,
            values: {
              name: `Player ${i}`,
              gender: "Female",
              level: "Beginner",
            },
          },
          time + i,
        ),
      ),
    );
    const data = await transact();
    expect(data.session.players).toHaveLength(10);
    expect(data.library).toHaveLength(10);
    expect(new Set(results.map((r) => r.revision)).size).toBe(10);
  });
  it("migrates once and leaves localStorage backups unchanged", async () => {
    const raw = JSON.stringify({ version: 10, data: ready() });
    local.set("badminton_queue_data_v2", raw);
    const first = await transact();
    expect(first.session.players).toHaveLength(4);
    local.set("badminton_queue_data_v2", "bad json");
    expect((await transact()).session).toEqual(first.session);
    local.set("badminton_queue_data_v2", raw);
    await commitCommand(
      { type: "addCourt", id: "new", name: "New court" },
      time,
    );
    expect(local.get("badminton_queue_data_v2")).toBe(raw);
  });
  it("does not replace corrupt legacy data with an empty session", async () => {
    local.set("badminton_queue_data_v2", "{broken");
    await expect(transact()).rejects.toThrow();
    expect(local.get("badminton_queue_data_v2")).toBe("{broken");
  });
  it("does not write rejected imports or stale replacement operations", async () => {
    const first = await transact();
    await commitCommand({ type: "addCourt", id: "new", name: "New" }, time);
    await expect(
      commitCommand(
        {
          type: "importSession",
          data: initialSession(time),
          revision: first.revision,
        },
        time,
      ),
    ).rejects.toThrow("another tab");
    expect((await transact()).session.courts).toHaveLength(3);
  });
  it("leaves the previous session intact when a transaction throws", async () => {
    const before = await transact();
    await expect(
      transact(() => {
        throw new Error("Quota exceeded");
      }),
    ).rejects.toThrow("Quota exceeded");
    expect(await transact()).toEqual(before);
  });
  it("reports unavailable storage instead of pretending to save", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("Storage disabled");
      },
    });
    await expect(transact()).rejects.toThrow("Storage disabled");
  });
});

describe("manual assignment only", () => {
  it("does not consume queues on court creation, finish or stop, even with a saved auto-assign flag", () => {
    let base = ready();
    base = run(base, {
      type: "addPlayer",
      id: "extra",
      values: { name: "Extra", gender: "Male", level: "Beginner" },
    });
    base = run(base, { type: "checkInPlayer", id: "extra" });
    base = run(base, { type: "createQueueItem", id: "waiting" });
    base = run(base, {
      type: "addPlayerToQueueItem",
      queueId: "waiting",
      playerId: "extra",
    });
    base.autoAssignQueue = true;
    const added = run(base, { type: "addCourt", id: "new", name: "New" });
    expect(added.queue).toEqual(base.queue);
    expect(added.courts.at(-1)!.players).toEqual([null, null, null, null]);
    const started = run(base, { type: "startMatch", courtId: "c1" });
    for (const action of [
      {
        type: "finishMatch",
        courtId: "c1",
        startTime: started.courts[0].startTime,
        values: { winningTeam: 1 },
        id: "finished",
      },
      {
        type: "stopMatch",
        courtId: "c1",
        startTime: started.courts[0].startTime,
        reason: "Stopped",
        id: "stopped",
      },
    ] as Command[]) {
      const next = run({ ...started, autoAssignQueue: true }, action);
      expect(next.queue).toEqual(base.queue);
      expect(next.courts[0].players).toEqual([null, null, null, null]);
      expect(next.autoAssignQueue).toBe(false);
    }
    expect(parseSession(base).autoAssignQueue).toBe(false);
  });
});

describe("session check-in", () => {
  function planned() {
    return run(initialSession(time), {
      type: "addPlayer",
      id: "arrival",
      values: { name: "Arrival", gender: "Female", level: "Intermediate" },
    });
  }
  it("keeps prepared players absent and blocks assignment until check-in", () => {
    const s = run(planned(), { type: "createQueueItem", id: "q" });
    expect(s.players[0].checkedInAt).toBeNull();
    expect(() =>
      run(s, {
        type: "togglePlayerSelection",
        courtId: "c1",
        playerId: "arrival",
        selected: true,
      }),
    ).toThrow("available");
    expect(() =>
      run(s, {
        type: "addPlayerToQueueItem",
        queueId: "q",
        playerId: "arrival",
      }),
    ).toThrow("unavailable");
    const present = run(s, { type: "checkInPlayer", id: "arrival" });
    expect(
      run(present, {
        type: "addPlayerToQueueItem",
        queueId: "q",
        playerId: "arrival",
      }).queue[0].team1,
    ).toEqual(["arrival"]);
  });
  it("records arrival once and does not reset it on repeated check-in", () => {
    const s = run(planned(), { type: "checkInPlayer", id: "arrival" });
    expect(
      run(s, { type: "checkInPlayer", id: "arrival" }).players[0].checkedInAt,
    ).toBe(s.players[0].checkedInAt);
  });
  it("undoes check-in and clears pending queue assignments without deleting the roster", () => {
    let s = run(planned(), { type: "checkInPlayer", id: "arrival" });
    s = run(s, { type: "createQueueItem", id: "q" });
    s = run(s, {
      type: "addPlayerToQueueItem",
      queueId: "q",
      playerId: "arrival",
    });
    s = run(s, { type: "undoCheckIn", id: "arrival" });
    expect(s.players[0].checkedInAt).toBeNull();
    expect(s.queue[0].team1).toEqual([]);
  });
  it("does not allow undoing attendance during a running match", () => {
    const s = run(ready(), { type: "startMatch", courtId: "c1" });
    expect(() => run(s, { type: "undoCheckIn", id: "p0" })).toThrow(
      "Finish or stop",
    );
  });
  it("resets attendance when retaining the roster for a new session", () => {
    const s = run(ready(), { type: "restartSession" });
    expect(s.players.every((p) => p.checkedInAt === null)).toBe(true);
    expect(s.players).toHaveLength(4);
  });
  it("preserves attendance on import and treats missing legacy attendance as present", () => {
    const absent = planned();
    expect(parseSession(absent).players[0].checkedInAt).toBeNull();
    const legacy = ready();
    legacy.players.forEach((p) => {
      delete p.checkedInAt;
    });
    expect(
      parseSession(legacy).players.every((p) => p.checkedInAt === p.joinedAt),
    ).toBe(true);
    const invalid = ready();
    invalid.players[0].checkedInAt = null;
    expect(() => parseSession(invalid)).toThrow("Invalid");
  });
});
