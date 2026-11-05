import { afterEach, describe, expect, it, vi } from "vitest";
import { shareUnchanged } from "../../app/queuing/state/store";
import { initialSession } from "../../app/queuing/state/model";
import { performanceFixture } from "./helpers/performance-fixture";
import { transition, transitionValidated } from "../../app/queuing/state/transitions";
import { parseSession } from "../../app/queuing/state/model";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("shared wall clock", () => {
  it("shares one timer, pauses while hidden, catches up on return, and stops after unsubscribe", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const document = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal("document", document);
    const { subscribeClock, getClockSnapshot } = await import("../../app/queuing/state/clock");
    const first = vi.fn(), second = vi.fn();
    const offFirst = subscribeClock(first), offSecond = subscribeClock(second);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(second).toHaveBeenCalledTimes(3);
    document.hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    const frozen = getClockSnapshot();
    vi.advanceTimersByTime(60_000);
    expect(getClockSnapshot()).toBe(frozen);
    expect(vi.getTimerCount()).toBe(0);
    document.hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(getClockSnapshot()).toBe(Date.now());
    expect(vi.getTimerCount()).toBe(1);
    offFirst(); offSecond();
    expect(vi.getTimerCount()).toBe(0);
  });
});

it("shares unchanged persisted sections and records without keeping stale changes", () => {
  const before = performanceFixture(20).session;
  const after = transition(before, { type: "checkInPlayer", id: "p19" }, Date.now());
  const shared = shareUnchanged(before, after);
  expect(shared).toEqual(after);
  expect(shared).not.toBe(before);
  expect(shared.billing).toBe(before.billing);
  expect(shared.history).toBe(before.history);
  expect(shared.courts).toBe(before.courts);
  expect(shared.players[0]).toBe(before.players[0]);
  expect(shared.players[19]).not.toBe(before.players[19]);
  expect(shareUnchanged(before, structuredClone(before))).toBe(before);
  expect(shareUnchanged([1, 2], [1])).toEqual([1]);
  expect(shareUnchanged({ x: 1 }, { x: 2 })).toEqual({ x: 2 });
});

it("the validated storage path preserves transition results and input immutability", () => {
  const before = performanceFixture(20).session;
  const original = structuredClone(before);
  const command = { type: "checkInPlayer", id: "p19" } as const;
  expect(transitionValidated(parseSession(before), command, 2_000_000_000_000))
    .toEqual(transition(before, command, 2_000_000_000_000));
  expect(before).toEqual(original);
  const invalid = { ...initialSession(0), courts: [{}] };
  expect(() => transition(invalid as never, command, Date.now())).toThrow();
});

it("keeps workspace snapshots stable for saving metadata and unchanged refreshes", async () => {
  vi.resetModules();
  const { IDBFactory } = await import("fake-indexeddb");
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("localStorage", { getItem: () => null });
  const store = await import("../../app/queuing/state/store");
  await store.initialize();
  const initial = store.getWorkspaceSnapshot();
  const notification = vi.fn();
  const unsubscribe = store.subscribe(notification);
  const saving = store.dispatch({ type: "addCourt", id: "new", name: "Extra court" });
  expect(store.getSnapshot().pending).toBe(1);
  expect(store.getWorkspaceSnapshot()).toBe(initial);
  expect(await saving).toEqual({ ok: true, id: "new" });
  const committed = store.getWorkspaceSnapshot();
  expect(committed).not.toBe(initial);
  expect(store.getSnapshot().pending).toBe(0);
  expect(committed.data.session.players).toBe(initial.data.session.players);
  notification.mockClear();
  await store.refresh();
  expect(store.getWorkspaceSnapshot()).toBe(committed);
  expect(notification).not.toHaveBeenCalled();
  unsubscribe();
});
