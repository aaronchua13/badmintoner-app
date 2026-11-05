import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { SessionMetadata } from "../../app/queuing/state/hub";
import type { QueueData } from "../../app/queuing/state/model";
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
let store: typeof import("../../app/queuing/state/store");
let storage: typeof import("../../app/queuing/state/storage");
let sync: typeof import("../../app/queuing/cloud/sync");
let hubModule: typeof import("../../app/queuing/state/hub");
let rows: Map<string, { id: string; data: QueueData; metadata: SessionMetadata; version: number; updated_at: string }>;
let receipts: Map<string, number>;
let writes: { mutationId: string; expectedVersion: number; revision: number; session: QueueData; metadata: SessionMetadata; backups: unknown[] }[];
let applyThenDisconnect: boolean;
let unauthenticated: boolean;
let duringWrite: (() => Promise<void>) | undefined;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal("document", { hidden: false, addEventListener: vi.fn() });
  vi.stubGlobal("navigator", { onLine: true, locks: { request: (_: string, __: unknown, work: (lock: object) => Promise<void>) => work({}) } });
  rows = new Map(); receipts = new Map(); writes = []; applyThenDisconnect = false; unauthenticated = false; duringWrite = undefined;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    const path = url.replace("/api/queuing/cloud/", "");
    if (path === "workspace") return response({ version: 0, payload: { library: [], identities: {}, templates: [] } });
    if (path.startsWith("sessions/")) {
      const id = path.split("/")[1], current = rows.get(id);
      if (options?.method === "PUT") {
        const body = JSON.parse(options.body as string); writes.push(body);
        if (unauthenticated) return response({ error: "Sign in" }, 401);
        if (receipts.has(body.mutationId)) return response({ version: receipts.get(body.mutationId), duplicate: true });
        if (body.expectedVersion !== (current?.version ?? 0)) return response({ error: "Version conflict" }, 409);
        rows.set(id, { id, data: structuredClone(body.session), metadata: structuredClone(body.metadata), version: (current?.version ?? 0) + 1, updated_at: new Date().toISOString() });
        receipts.set(body.mutationId, rows.get(id)!.version);
        if (duringWrite) { const callback = duringWrite; duringWrite = undefined; await callback(); }
        if (applyThenDisconnect) { applyThenDisconnect = false; throw new TypeError("Connection lost after commit"); }
        return response({ version: rows.get(id)!.version });
      }
      return current ? response(current) : response({ error: "Not found" }, 404);
    }
    return response({});
  }));
  store = await import("../../app/queuing/state/store");
  storage = await import("../../app/queuing/state/storage");
  hubModule = await import("../../app/queuing/state/hub");
  sync = await import("../../app/queuing/cloud/sync");
  await store.initialize();
  await sync.setCloudUser({ id: owner, email: "owner@example.invalid" });
  await store.editHub((d) => {
    const hub = hubModule.ensureHub(d, Date.now());
    const r = hubModule.newRecord(structuredClone(d.session), Date.now(), owner, "Cloud night");
    hub.records[r.id] = r; hub.activeId = r.id; d.session = r.session;
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("keeps queue changes local and pending while offline", async () => {
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  await store.dispatch({ type: "addCourt", id: "offline", name: "Offline court" });
  const count = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
  await sync.synchronize();
  expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(count);
  const d = await storage.transact(), r = hubModule.activeRecord(d)!;
  expect(d.session.courts.some((c) => c.id === "offline")).toBe(true);
  expect(r.revision).toBeGreaterThan(r.acked);
});
it("does not acknowledge edits made during an upload", async () => {
  duringWrite = async () => { await store.dispatch({ type: "addCourt", id: "during", name: "During upload" }); };
  await sync.synchronize();
  let d = await storage.transact(), r = hubModule.activeRecord(d)!;
  expect(r.version).toBe(1); expect(r.acked).toBe(1); expect(r.revision).toBe(2);
  expect(d.session.courts.some((c) => c.id === "during")).toBe(true);
  expect(rows.get(r.id)!.data.courts.some((c) => c.id === "during")).toBe(false);
  await sync.synchronize();
  d = await storage.transact(); r = hubModule.activeRecord(d)!;
  expect(r.acked).toBe(r.revision); expect(r.version).toBe(2);
  expect(rows.get(r.id)!.data.courts.some((c) => c.id === "during")).toBe(true);
});
it("reuses the persisted mutation ID when a response is lost after a server commit", async () => {
  applyThenDisconnect = true;
  await sync.synchronize();
  let r = hubModule.activeRecord(await storage.transact())!;
  expect(r.flight).toBeDefined(); expect(r.version).toBe(0);
  vi.setSystemTime(Date.now() + 5000);
  await sync.synchronize();
  r = hubModule.activeRecord(await storage.transact())!;
  expect(writes).toHaveLength(2); expect(writes[0].mutationId).toBe(writes[1].mutationId);
  expect(rows.get(r.id)!.version).toBe(1); expect(r.version).toBe(1); expect(r.flight).toBeUndefined();
});
it("keeps new snapshots pending when retrying a committed upload", async () => {
  await store.editHub((d) => hubModule.backup(d, "Before original upload", Date.now()));
  applyThenDisconnect = true;
  await sync.synchronize();
  await store.editHub((d) => hubModule.backup(d, "Created after lost response", Date.now()));
  vi.setSystemTime(Date.now() + 5000);
  await sync.synchronize();
  let d = await storage.transact();
  expect(writes[1].backups).toEqual(writes[0].backups);
  expect(d.hub!.snapshots.find((b) => b.reason === "Created after lost response")!.uploaded).toBe(false);
  await sync.synchronize();
  d = await storage.transact();
  expect(d.hub!.snapshots.every((b) => b.uploaded)).toBe(true);
  expect(writes[2].backups).toHaveLength(1);
});
it("bounds recovery batches and leaves remaining snapshots for later uploads", async () => {
  await store.editHub((d) => { hubModule.backup(d, "One", Date.now()); hubModule.backup(d, "Two", Date.now()); });
  const d = await storage.transact(), r = hubModule.activeRecord(d)!, [first] = d.hub!.snapshots;
  const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
  const budget = size({ session: r.session, metadata: r.metadata }) + 1024 + size({ id: first.id, session: first.session, metadata: first.metadata, reason: first.reason, at: first.at }) + 1;
  expect(sync.snapshotBatchIds(r, d.hub!.snapshots, budget)).toEqual([first.id]);
  expect(d.hub!.snapshots.every((b) => !b.uploaded)).toBe(true);
});
it("preserves both conflicting versions and snapshots a discarded device copy", async () => {
  await sync.synchronize();
  const initial = await storage.transact(), id = initial.hub!.activeId;
  rows.get(id)!.version = 2; rows.get(id)!.metadata = { ...rows.get(id)!.metadata, title: "Other device" };
  await store.dispatch({ type: "addCourt", id: "local", name: "Local draft" });
  await sync.synchronize();
  let d = await storage.transact(), r = hubModule.activeRecord(d)!;
  expect(r.conflict?.version).toBe(2);
  expect(d.session.courts.some((c) => c.id === "local")).toBe(true);
  expect(rows.get(id)!.data.courts.some((c) => c.id === "local")).toBe(false);
  await sync.resolveSessionConflict(id, "cloud");
  d = await storage.transact(); r = hubModule.activeRecord(d)!;
  expect(r.metadata.title).toBe("Other device");
  expect(d.hub!.snapshots.at(-1)!.session.courts.some((c) => c.id === "local")).toBe(true);
  await sync.synchronize();
  expect(writes.at(-1)!.backups).toHaveLength(1);
});
it("stops uploads on authentication expiry without discarding offline edits", async () => {
  unauthenticated = true;
  await store.dispatch({ type: "addCourt", id: "unsent", name: "Unsent court" });
  await sync.synchronize();
  expect(sync.getCloudState().user).toBeNull();
  const d = await storage.transact();
  expect(d.session.courts.some((c) => c.id === "unsent")).toBe(true);
  expect(hubModule.activeRecord(d)!.flight).toBeDefined();
});
it("account switching preserves the outgoing draft and never uploads it as the new owner", async () => {
  await store.dispatch({ type: "addCourt", id: "private-a", name: "Account A private court" });
  const old = hubModule.activeRecord(await storage.transact())!;
  await sync.setCloudUser({ id: other, email: "other@example.invalid" });
  const d = await storage.transact();
  expect(d.hub!.records[old.id].session.courts.some((c) => c.id === "private-a")).toBe(true);
  expect(hubModule.activeRecord(d)!.ownerId).toBeNull();
  const count = writes.length;
  await sync.synchronize();
  expect(writes).toHaveLength(count);
});
it("does not change the local revision for background no-op checks", async () => {
  await sync.synchronize();
  const revision = (await storage.transact()).revision;
  await sync.synchronize();
  expect((await storage.transact()).revision).toBe(revision);
});
it("keeps a remotely deleted archive as a device draft without recreating it", async () => {
  await sync.synchronize();
  const id = (await storage.transact()).hub!.activeId;
  rows.delete(id);
  await store.dispatch({ type: "addCourt", id: "kept", name: "Device draft" });
  // Emulate the server's expectedVersion rejection for a deleted resource.
  await sync.synchronize();
  const d = await storage.transact();
  expect(d.hub!.records[id].deleted).toBe(true);
  expect(d.session.courts.some((c) => c.id === "kept")).toBe(true);
  expect(d.hub!.snapshots.at(-1)!.reason).toContain("deleted");
  expect(rows.has(id)).toBe(false);
});
it("uploads an outgoing pending session after reset gives the active session a fresh ID", async () => {
  await sync.synchronize();
  const outgoing = (await storage.transact()).hub!.activeId;
  await store.dispatch({ type: "addCourt", id: "outgoing", name: "Outgoing court" });
  expect((await store.dispatch({ type: "resetState" })).ok).toBe(true);
  const fresh = (await storage.transact()).hub!.activeId;
  expect(fresh).not.toBe(outgoing);
  await sync.synchronize();
  expect(rows.get(outgoing)!.data.courts.some((c) => c.id === "outgoing")).toBe(true);
  expect(rows.get(fresh)!.data.players).toEqual([]);
  const d = await storage.transact();
  expect(d.hub!.records[outgoing].acked).toBe(d.hub!.records[outgoing].revision);
});
