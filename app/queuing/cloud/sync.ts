import { useSyncExternalStore } from "react";
import { editHub, getSnapshot, refresh, subscribe } from "../state/store";
import { transact } from "../state/storage";
import { parseSession } from "../state/model";
import { ensureHub, emptyWorkspace, newRecord, pruneSnapshots, type SessionMetadata, type SessionRecord, type Hub, type WorkspacePayload } from "../state/hub";
import { parseWorkspace } from "./contracts";

export class CloudRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function cloudRequest<T = unknown>(path: string, method = "GET", body?: unknown, version?: number, expectedOwner?: string): Promise<T> {
  const owner = expectedOwner ?? state.user?.id;
  const response = await fetch(`/api/queuing/cloud/${path}`, { method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "x-queue-client": "1", ...(owner ? { "x-queue-owner": owner } : {}), ...(version === undefined ? {} : { "If-None-Match": String(version) }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (response.status === 304) return { notModified: true } as T;
  const result = await response.json();
  if (!response.ok) throw new CloudRequestError(result.error ?? "Cloud request failed", response.status);
  return result as T;
}
export type CloudUser = { id: string; email?: string };
type CloudState = { loaded: boolean; configured: boolean; signupReady: boolean; user: CloudUser | null; status: string; error: string | null };
const initial: CloudState = { loaded: false, configured: false, signupReady: false, user: null, status: "Offline mode", error: null };
let state = initial;
const listeners = new Set<() => void>();
const emit = (patch: Partial<CloudState>) => { state = { ...state, ...patch }; listeners.forEach((f) => f()); };
export const getCloudState = () => state;
export const useCloudState = () => useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => state, () => initial);
export type RemoteSession = { id: string; version: number; data: unknown; metadata: SessionMetadata; updated_at: string };
let started = false, busy = false, timer: ReturnType<typeof setTimeout> | undefined;
let firstPending = 0, nextAttempt = 0, failures = 0, lastRevision = -1, pollCount = 0;
const hasPending = (hub?: Hub) => {
  if (!state.user || !hub) return false;
  const owner = state.user.id, w = hub.workspaces[owner];
  return (!!w && !w.conflict && (w.flight || w.revision > w.acked)) || Object.values(hub.records).some((r) => r.ownerId === owner && !r.deleted && !r.conflict && (r.flight || r.revision > r.acked || hub.snapshots.some((b) => b.sessionId === r.id && !b.uploaded)));
};
function schedule() {
  if (!hasPending(getSnapshot().data.hub) || !navigator.onLine || document.hidden) return;
  firstPending ||= Date.now();
  clearTimeout(timer);
  timer = setTimeout(() => { void synchronize(); }, Math.max(0, nextAttempt - Date.now(), Math.min(1500, 5000 - (Date.now() - firstPending))));
}
export async function setCloudUser(user: CloudUser | null, explicitLogout = false) {
  const result = await editHub((data) => {
    const hub = ensureHub(data, Date.now()), active = hub.records[hub.activeId];
    if (explicitLogout || (user && active.ownerId && active.ownerId !== user.id)) {
      active.session = data.session;
      let standalone = hub.records[hub.standaloneId];
      if (!standalone || standalone.ownerId) {
        standalone = newRecord(parseSession({ ...data.session, courts: [], queue: [], history: [], players: [], playerLogs: [], sessionStatus: "idle", sessionStartTime: null, sessionEndTime: null, courtHistory: [], billing: { expenses: { courtFee: 0, tubePrice: 0, piecesPerTube: 12, tubes: 0, pieces: 0 }, calculatorExcluded: [], arrangements: {}, receipts: [], estimate: null, finalized: null } }), Date.now());
        hub.records[standalone.id] = standalone; hub.standaloneId = standalone.id;
      }
      hub.activeId = standalone.id; data.session = standalone.session;
      data.library = hub.workspaces.local.payload.library;
    }
    hub.accountId = user?.id ?? null;
    if (user) hub.workspaces[user.id] ??= emptyWorkspace();
  });
  if (!result.ok) throw new Error(result.error);
  emit({ user, loaded: true, error: null, status: user ? "Cloud connected" : "Offline mode" });
  if (user) { await pullWorkspace(); schedule(); }
}
export async function refreshCloudAuth() {
  try {
    const config = await cloudRequest<{ configured: boolean; signupReady: boolean }>("config");
    emit({ ...config, loaded: true });
    if (!config.configured) return;
    const { user } = await cloudRequest<{ user: CloudUser | null }>("auth/me");
    if (user?.id !== state.user?.id) await setCloudUser(user);
  } catch { emit({ loaded: true, status: state.user ? "Cloud unavailable · saved on device" : "Offline mode" }); }
}
export async function pullWorkspace() {
  const owner = state.user?.id;
  if (!owner) return;
  const remote = await cloudRequest<{ version: number; payload: WorkspacePayload }>("workspace");
  if (state.user?.id !== owner) return;
  await editHub((data) => {
    const hub = ensureHub(data, Date.now()), local = hub.workspaces[owner] ??= emptyWorkspace();
    if (remote.version === local.version) return;
    const payload = parseWorkspace(remote.payload);
    if (local.revision > local.acked || local.flight) { local.conflict = { version: remote.version, payload }; return; }
    local.payload = payload; local.version = remote.version;
    if (hub.records[hub.activeId].ownerId === owner) data.library = payload.library;
  });
}
export async function receiveSession(remote: RemoteSession, owner: string) {
  if (state.user?.id !== owner) return;
  await editHub((data) => {
    const hub = ensureHub(data, Date.now()), local = hub.records[remote.id];
    if (!local || local.ownerId !== owner || local.version === remote.version) return;
    const session = parseSession(remote.data);
    if (local.flight || local.revision > local.acked) { local.conflict = { version: remote.version, session, metadata: remote.metadata }; return; }
    local.session = session; local.metadata = remote.metadata; local.version = remote.version;
    local.updatedAt = Date.parse(remote.updated_at);
    if (hub.activeId === remote.id) data.session = session;
  });
}
async function receiveDeletion(id: string, owner: string) {
  if (state.user?.id !== owner) return;
  await editHub((data) => {
    const hub = ensureHub(data, Date.now()), r = hub.records[id];
    if (!r || r.ownerId !== owner || r.deleted) return;
    hub.snapshots.push({ id: crypto.randomUUID(), sessionId: id, ownerId: owner, session: structuredClone(r.session), metadata: structuredClone(r.metadata), reason: "Cloud archive deleted · device copy preserved", at: Date.now(), uploaded: true });
    r.deleted = true; delete r.flight; delete r.conflict;
    pruneSnapshots(hub);
  });
  emit({ status: "Cloud archive deleted · device draft kept", error: null });
}
async function uploadWorkspace(owner: string) {
  let flight: NonNullable<Hub["workspaces"][string]["flight"]> | undefined;
  await editHub((data) => {
    const w = data.hub?.workspaces[owner];
    if (!w || w.conflict || (!w.flight && w.revision <= w.acked)) return;
    w.flight ??= { mutationId: crypto.randomUUID(), revision: w.revision, expectedVersion: w.version, payload: structuredClone(w.payload) };
    flight = structuredClone(w.flight);
  });
  if (!flight) return;
  try {
    if (state.user?.id !== owner) return;
    const result = await cloudRequest<{ version: number }>("workspace", "PUT", flight, undefined, owner);
    await editHub((data) => {
      const w = data.hub?.workspaces[owner];
      if (w?.flight?.mutationId !== flight!.mutationId) return;
      w.version = result.version; w.acked = flight!.revision; delete w.flight;
    });
  } catch (e) {
    if (e instanceof CloudRequestError && e.status === 409) { await pullWorkspace(); return; }
    throw e;
  }
}
// Bound batches independently of the number/size of saved recovery documents.
// A later upload carries the remainder, using a new mutation ID.
export function snapshotBatchIds(session: SessionRecord, snapshots: Hub["snapshots"], maxBytes = 15 * 1024 * 1024) {
  let bytes = new TextEncoder().encode(JSON.stringify({ session: session.session, metadata: session.metadata })).length + 1024;
  const ids: string[] = [];
  for (const b of snapshots) {
    if (b.sessionId !== session.id || b.ownerId !== session.ownerId || b.uploaded) continue;
    const size = new TextEncoder().encode(JSON.stringify({ id: b.id, session: b.session, metadata: b.metadata, reason: b.reason, at: b.at })).length + 1;
    if (bytes + size > maxBytes) break;
    ids.push(b.id); bytes += size;
    if (ids.length === 100) break;
  }
  return ids;
}
async function uploadSession(id: string, owner: string) {
  let flight: SessionRecord["flight"];
  let backups: Hub["snapshots"] = [];
  await editHub((data) => {
    const hub = data.hub!, r = hub.records[id];
    if (!r || r.ownerId !== owner || r.deleted || r.conflict || (!r.flight && r.revision <= r.acked && !hub.snapshots.some((b) => b.sessionId === id && !b.uploaded))) return;
    r.flight ??= { mutationId: crypto.randomUUID(), revision: r.revision, expectedVersion: r.version, session: structuredClone(r.session), metadata: structuredClone(r.metadata), backupIds: snapshotBatchIds(r, hub.snapshots) };
    flight = structuredClone(r.flight);
    backups = hub.snapshots.filter((b) => flight!.backupIds.includes(b.id));
  });
  if (!flight) return;
  try {
    if (state.user?.id !== owner) return;
    const result = await cloudRequest<{ version: number }>(`sessions/${id}`, "PUT", { ...flight, backups: backups.map((b) => ({ id: b.id, session: b.session, metadata: b.metadata, reason: b.reason, at: b.at })) }, undefined, owner);
    await editHub((data) => {
      const hub = data.hub!, r = hub.records[id];
      if (r?.flight?.mutationId !== flight!.mutationId) return;
      r.version = result.version; r.acked = flight!.revision; delete r.flight;
      for (const b of hub.snapshots) if (backups.some((sent) => sent.id === b.id)) b.uploaded = true;
      pruneSnapshots(hub);
    });
  } catch (e) {
    if (e instanceof CloudRequestError && e.status === 409) {
      try { await receiveSession(await cloudRequest<RemoteSession>(`sessions/${id}`), owner); }
      catch (readError) { if (readError instanceof CloudRequestError && readError.status === 404) await receiveDeletion(id, owner); else throw readError; }
      return;
    }
    throw e;
  }
}
async function withLeader(work: () => Promise<void>) {
  if (navigator.locks) return navigator.locks.request("badminton-queue-cloud-sync", { ifAvailable: true }, async (lock) => { if (lock) await work(); });
  const id = crypto.randomUUID(); let acquired = false;
  await transact((data) => {
    const hub = ensureHub(data, Date.now()) as Hub & { lease?: { id: string; expiresAt: number } };
    if (!hub.lease || hub.lease.expiresAt < Date.now()) { hub.lease = { id, expiresAt: Date.now() + 120000 }; acquired = true; }
    return data;
  });
  if (!acquired) return;
  try { await work(); } finally {
    await transact((data) => { const h = data.hub as Hub & { lease?: { id: string; expiresAt: number } }; if (h?.lease?.id === id) delete h.lease; return data; });
  }
}
export async function synchronize() {
  if (busy || !state.user || !navigator.onLine || document.hidden || !getSnapshot().loaded || Date.now() < nextAttempt) return;
  busy = true; firstPending = 0;
  const owner = state.user.id;
  try {
    await withLeader(async () => {
      emit({ status: "Syncing…", error: null });
      await refresh();
      await uploadWorkspace(owner);
      if (getSnapshot().data.hub?.workspaces[owner]?.conflict) { emit({ status: "Workspace conflict · both copies kept" }); return; }
      const ids = Object.values(getSnapshot().data.hub?.records ?? {}).filter((r) => r.ownerId === owner).map((r) => r.id);
      for (const id of ids) { if (state.user?.id !== owner) return; await uploadSession(id, owner); }
      const conflict = ids.some((id) => getSnapshot().data.hub?.records[id]?.conflict);
      emit({ status: conflict ? "Conflict · both copies kept" : "Cloud synced", error: null });
      failures = 0; nextAttempt = 0;
    });
  } catch (e) {
    failures++;
    nextAttempt = Date.now() + Math.min(60000, 2000 * 2 ** Math.min(failures - 1, 5));
    emit({ status: e instanceof CloudRequestError && e.status === 401 ? "Sign in to sync · saved on device" : "Cloud pending · saved on device", error: e instanceof Error ? e.message : "Cloud unavailable" });
    if (e instanceof CloudRequestError && e.status === 401 && state.user?.id === owner) emit({ user: null });
  } finally { busy = false; schedule(); }
}
export function startCloudSync() {
  if (started) return;
  started = true;
  void refreshCloudAuth();
  subscribe(() => { const s = getSnapshot(); if (s.loaded && s.data.revision !== lastRevision) { lastRevision = s.data.revision; schedule(); } });
  const wake = () => { nextAttempt = 0; void refreshCloudAuth().then(() => synchronize()); };
  window.addEventListener("online", wake);
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  setInterval(() => {
    if (document.hidden || !navigator.onLine || busy || !getSnapshot().loaded) return;
    void (async () => {
      try {
        if (++pollCount % 6 === 0 || !state.user) { await refreshCloudAuth(); }
        const owner = state.user?.id, active = getSnapshot().data.hub?.records[getSnapshot().data.hub!.activeId];
        if (!owner) return;
        if (active?.ownerId === owner && !active.deleted && active.version > 0) {
          try {
            const remote = await cloudRequest<RemoteSession & { notModified?: boolean }>(`sessions/${active.id}`, "GET", undefined, active.version);
            if (!remote.notModified) await receiveSession(remote, owner);
          } catch (e) { if (e instanceof CloudRequestError && e.status === 404) await receiveDeletion(active.id, owner); else throw e; }
        }
        if (pollCount % 3 === 0) await pullWorkspace();
        await synchronize();
      } catch (e) { emit({ status: "Cloud unavailable · saved on device", error: e instanceof Error ? e.message : "Cloud unavailable" }); }
    })();
  }, 5000);
}
export async function resolveSessionConflict(id: string, choice: "cloud" | "device" | "copy") {
  const owner = state.user?.id;
  if (!owner) throw new Error("Sign in before resolving this conflict");
  const latest = await cloudRequest<RemoteSession>(`sessions/${id}`);
  const result = await editHub((data) => {
    const hub = ensureHub(data, Date.now()), r = hub.records[id];
    if (!r || r.ownerId !== owner || !r.conflict) throw new Error("Conflict no longer exists");
    // Always preserve the device version, including its logs and identity links.
    hub.snapshots.push({ id: crypto.randomUUID(), sessionId: id, ownerId: owner, session: structuredClone(r.session), metadata: structuredClone(r.metadata), reason: "Before conflict resolution", at: Date.now(), uploaded: false });
    if (choice === "copy") {
      const copy = newRecord(structuredClone(r.session), Date.now(), owner, `${r.metadata.title} · recovery copy`);
      copy.metadata = { ...structuredClone(r.metadata), title: copy.metadata.title, kind: "recovery", undo: [] };
      hub.records[copy.id] = copy;
    }
    if (choice !== "device") {
      r.session = parseSession(latest.data); r.metadata = latest.metadata;
      r.revision++; r.acked = r.revision;
      if (hub.activeId === id) data.session = r.session;
    }
    r.version = latest.version; delete r.flight; delete r.conflict;
    if (choice === "device") r.revision++;
  });
  if (!result.ok) throw new Error(result.error);
  schedule();
}
