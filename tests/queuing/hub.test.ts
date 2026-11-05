import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { initialSession, parseSession } from "../../app/queuing/state/model";
import { transition } from "../../app/queuing/state/transitions";
import { commitCommand, transact } from "../../app/queuing/state/storage";
import { activeRecord, applyTemplate, backup, canUndoCommand, displayProjection, domainFingerprint, emptyWorkspace, ensureHub, makeTemplate, newRecord, playerHistory, selectRecord, undoRecent, type HubData } from "../../app/queuing/state/hub";
import { generateInitialPassword } from "../../app/queuing/cloud/password";
import { parseWorkspace, parseWrite } from "../../app/queuing/cloud/contracts";
let time = 1000;
function fixture() {
  let s = initialSession(time);
  for (let i = 0; i < 4; i++) {
    s = transition(s, { type: "addPlayer", id: `p${i}`, values: { name: `Player ${i}`, level: "Intermediate", gender: "Male" } }, ++time);
    s = transition(s, { type: "checkInPlayer", id: `p${i}` }, ++time);
  }
  return s;
}
beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("localStorage", { getItem: () => null }); });
describe("offline session hub", () => {
  it("leaves legacy session JSON unchanged and links known database IDs without matching names", () => {
    const session = fixture(), original = structuredClone(session);
    const data: HubData = { revision: 0, session, library: [{ id: "pdb-p0", name: "Player 0", level: "Intermediate", gender: "Male", createdAt: 0, updatedAt: 0 }, { id: "other", name: "Player 1", level: "Intermediate", gender: "Male", createdAt: 0, updatedAt: 0 }] };
    const hub = ensureHub(data, 2000);
    expect(data.session).toEqual(original);
    expect(hub.records[hub.activeId].metadata.links).toEqual({ p0: "pdb-p0" });
    expect(JSON.parse(JSON.stringify(data.session))).not.toHaveProperty("hub");
  });
  it("undoes queue changes in order without removing previous log entries", async () => {
    await transact((d) => ({ ...d, session: fixture() }));
    await commitCommand({ type: "createQueueItem", id: "q" }, ++time);
    await commitCommand({ type: "addPlayerToQueueItem", queueId: "q", playerId: "p0" }, ++time);
    let data = await transact();
    const originalLogs = structuredClone(data.session.playerLogs);
    const undo = activeRecord(data)!.metadata.undo.at(-1)!;
    await transact((d) => { undoRecent(d, undo.id, ++time); return d; });
    data = await transact();
    expect(data.session.queue[0].team1).toEqual([]);
    expect(data.session.playerLogs.slice(0, originalLogs.length)).toEqual(originalLogs);
    expect(data.session.playerLogs.at(-1)?.message).toContain("Undo:");
    const previous = activeRecord(data)!.metadata.undo.at(-1)!;
    await transact((d) => { undoRecent(d, previous.id, ++time); return d; });
    expect((await transact()).session.queue).toEqual([]);
  });
  it("blocks stale undo and financial or running-match undo", async () => {
    await transact((d) => ({ ...d, session: fixture() }));
    await commitCommand({ type: "createQueueItem", id: "q" }, ++time);
    const undo = activeRecord(await transact())!.metadata.undo.at(-1)!;
    await commitCommand({ type: "setArrangement", playerId: "p0", values: { kind: "none" } }, ++time);
    const before = await transact();
    await expect(transact((d) => { undoRecent(d, undo.id, ++time); return d; })).rejects.toThrow("cannot be undone");
    expect(await transact()).toEqual(before);
    expect(canUndoCommand(fixture(), { type: "startMatch", courtId: "c1" })).toBe(false);
    expect(canUndoCommand(fixture(), { type: "changeCourtTeams", courtId: "c1", original: [], players: [null, null, null, null], status: "active", startTime: 1 })).toBe(false);
  });
  it("bounds undo history and stores compact state guards", async () => {
    await transact((d) => ({ ...d, session: fixture() }));
    for (let i = 0; i < 25; i++) await commitCommand({ type: "createQueueItem", id: `q${i}` }, ++time);
    const entry = activeRecord(await transact())!;
    expect(entry.metadata.undo).toHaveLength(20);
    expect(entry.metadata.undo[0].after).toHaveLength(64);
    expect(domainFingerprint(entry.session)).toHaveLength(64);
  });
  it("backs up before replacement and keeps a linked outgoing draft pending", async () => {
    await transact((d) => ({ ...d, session: fixture() }));
    await commitCommand({ type: "createQueueItem", id: "q" }, ++time);
    const saved = await transact(), id = saved.hub!.activeId;
    await transact((d) => { d.hub!.records[id].ownerId = "owner"; return d; });
    await commitCommand({ type: "resetState" }, ++time);
    const next = await transact();
    expect(next.hub!.activeId).not.toBe(id);
    expect(next.hub!.records[id].session).toEqual(saved.session);
    expect(next.hub!.records[id].revision).toBeGreaterThan(next.hub!.records[id].acked);
    expect(next.hub!.snapshots[0].session).toEqual(saved.session);
    expect(next.hub!.snapshots[0].uploaded).toBe(false);
    expect(next.session.players).toEqual([]);
  });
  it("keeps the latest twenty durable backups without pruning unsent cloud snapshots", () => {
    const data: HubData = { revision: 0, session: fixture(), library: [] };
    for (let i = 0; i < 25; i++) backup(data, `Backup ${i}`, ++time);
    expect(data.hub!.snapshots).toHaveLength(20);
    activeRecord(data)!.ownerId = "owner";
    for (let i = 0; i < 25; i++) backup(data, `Pending ${i}`, ++time);
    expect(data.hub!.snapshots.filter((s) => !s.uploaded)).toHaveLength(25);
  });
  it("switches sessions only after preserving the outgoing draft and validates account ownership", () => {
    const data: HubData = { revision: 0, session: fixture(), library: [] }, hub = ensureHub(data, time);
    const old = hub.activeId, next = newRecord(initialSession(time), time);
    hub.records[next.id] = next;
    selectRecord(data, next.id, ++time);
    expect(hub.snapshots[0].sessionId).toBe(old);
    const other = newRecord(initialSession(time), time, "other"); hub.records[other.id] = other;
    expect(() => selectRecord(data, other.id, ++time)).toThrow("another account");
  });
  it("creates fresh sessions from templates and preserves identity links", () => {
    const data: HubData = { revision: 0, session: fixture(), library: fixture().players.map((p) => ({ id: `pdb-${p.id}`, name: p.name, level: p.level, gender: p.gender, createdAt: 0, updatedAt: 0 })) };
    ensureHub(data, time);
    data.session.billing.expenses.courtFee = 10000;
    const template = makeTemplate(data, "Wednesday evening");
    applyTemplate(data, template, ++time);
    expect(data.session.sessionStatus).toBe("idle");
    expect(data.session.players.every((p) => p.checkedInAt === null && !p.isPlaying && p.gamesPlayed === 0)).toBe(true);
    expect(data.session.players.every((p) => activeRecord(data)!.metadata.links[p.id])).toBe(true);
    expect(data.session.history).toEqual([]); expect(data.session.playerLogs).toEqual([]);
    expect(data.session.billing.receipts).toEqual([]); expect(data.session.billing.arrangements).toEqual({});
    expect(data.session.billing.expenses.courtFee).toBe(10000);
    expect(data.hub!.snapshots).toHaveLength(1);
  });
  it("archives settlement updates on the same session and excludes recovery copies from statistics", async () => {
    await transact((d) => ({ ...d, session: fixture() }));
    await commitCommand({ type: "startSession" }, ++time);
    await commitCommand({ type: "stopSession" }, ++time);
    const id = (await transact()).hub!.activeId;
    await commitCommand({ type: "saveReceipt", values: { id: "r", playerId: "p0", amount: 100, method: "cash", paidAt: time, note: "" }, editing: false }, ++time);
    const d = await transact(), record = d.hub!.records[id];
    expect(record.session.billing.receipts).toHaveLength(1);
    expect(Object.keys(d.hub!.records)).toHaveLength(1);
    const copy = structuredClone(record); copy.id = "copy"; copy.metadata.kind = "recovery";
    expect(playerHistory([record, copy]).every((p) => p.sessions === 1)).toBe(true);
  });
});
it("publishes only sanitized public queue fields", () => {
  const session = fixture();
  session.billing.receipts.push({ id: "r", playerId: "p0", amount: 12345, paidAt: 1, note: "PRIVATE_PAYMENT_NOTE", method: "cash" });
  session.playerLogs.push({ id: 100, playerId: "p0", playerName: "Player 0", at: 1, kind: "profile", message: "PRIVATE_ACTIVITY_NOTE" });
  const result = displayProjection(session, "Court night", 2000), serialized = JSON.stringify(result);
  expect(serialized).not.toContain("PRIVATE"); expect(serialized).not.toContain("billing"); expect(serialized).not.toContain("playerLogs");
  expect(Object.keys(result)).toEqual(["title", "status", "updatedAt", "courts", "queue"]);
});
it("validates cloud contracts and never adds cloud metadata to session exports", () => {
  const s = fixture(), r = newRecord(s, time);
  const write = parseWrite({ expectedVersion: 0, mutationId: crypto.randomUUID(), session: s, metadata: r.metadata });
  expect(parseSession(write.session)).toEqual(s);
  expect(() => parseWrite({ ...write, expectedVersion: -1 })).toThrow();
  expect(() => parseWrite({ ...write, session: { schemaVersion: 4 } })).toThrow();
  expect(parseWorkspace(emptyWorkspace().payload).templates).toEqual([]);
});
it("generates twenty-character passwords containing all required character classes", () => {
  const passwords = Array.from({ length: 100 }, generateInitialPassword);
  expect(new Set(passwords).size).toBe(100);
  for (const p of passwords) { expect(p).toHaveLength(20); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[0-9]/); expect(p).toMatch(/[!@#$%*\-_+]/); }
});
