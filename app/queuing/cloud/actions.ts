import { editHub, getSnapshot } from "../state/store";
import { parseWorkspace } from "./contracts";
import { parseSession } from "../state/model";
import { ensureHub, newRecord, backup, selectRecord, assertReplaceable, emptyWorkspace, scopeKey, applyTemplate, makeTemplate, undoRecent, type RecoverySnapshot, type SessionRecord, type SessionTemplate, type SessionMetadata } from "../state/hub";
import { cloudRequest, getCloudState, pullWorkspace, synchronize, type RemoteSession } from "./sync";

export async function localChange(change: Parameters<typeof editHub>[0]) {
  const r = await editHub(change);
  if (!r.ok) throw new Error(r.error);
}
export async function connectCurrent(title: string, linkMatchingNames: boolean) {
  const owner = getCloudState().user?.id;
  if (!owner) throw new Error("Sign in to save a cloud session");
  await pullWorkspace();
  if (getCloudState().user?.id !== owner) throw new Error("The cloud account changed. Save again after reviewing the active account.");
  await localChange((data) => {
    const hub = ensureHub(data, Date.now()), active = hub.records[hub.activeId];
    if (active.ownerId && active.ownerId !== owner) throw new Error("This draft belongs to another account");
    const target = hub.workspaces[owner] ??= emptyWorkspace();
    if (target.conflict) throw new Error("Resolve the player database conflict before saving this session");
    if (active.ownerId === owner && !active.deleted) { active.metadata.title = title.trim() || active.metadata.title; active.revision++; return; }
    const ids: Record<string, string> = {};
    const merged = [...target.payload.library];
    for (const entry of data.library) {
      const sameId = merged.find((p) => p.id === entry.id);
      const sameName = merged.find((p) => p.name.toLowerCase() === entry.name.toLowerCase());
      if (sameId) { ids[entry.id] = sameId.id; continue; }
      if (sameName) {
        if (!linkMatchingNames) throw new Error(`A cloud player named ${entry.name} already exists. Explicitly link matching names, or rename the device entry to keep them separate.`);
        ids[entry.id] = sameName.id;
      } else { merged.push(entry); ids[entry.id] = entry.id; }
    }
    target.payload.library = merged;
    for (const p of merged) target.payload.identities[p.id] = { name: p.name };
    for (const template of hub.workspaces.local.payload.templates) {
      if (!target.payload.templates.some((t) => t.id === template.id)) target.payload.templates.push({ ...structuredClone(template), playerIds: template.playerIds.map((id) => ids[id] ?? id) });
    }
    target.revision++;
    backup(data, "Before saving this device session to cloud", Date.now());
    const record = newRecord(structuredClone(data.session), Date.now(), owner, title.trim() || active.metadata.title);
    record.metadata.links = Object.fromEntries(Object.entries(active.metadata.links).map(([id, libraryId]) => [id, ids[libraryId] ?? libraryId]));
    record.metadata.undo = structuredClone(active.metadata.undo);
    record.metadata.kind = active.deleted ? "recovery" : active.metadata.kind;
    hub.records[record.id] = record; hub.activeId = record.id;
    data.session = record.session; data.library = target.payload.library;
  });
  await synchronize();
}
export async function openCloudSession(id: string) {
  const owner = getCloudState().user?.id;
  if (!owner) throw new Error("Sign in to open cloud sessions");
  const remote = await cloudRequest<RemoteSession>(`sessions/${id}`);
  if (getCloudState().user?.id !== owner) throw new Error("Account changed");
  await localChange((data) => {
    const hub = ensureHub(data, Date.now()), existing = hub.records[id];
    if (existing && (existing.ownerId !== owner || existing.flight || existing.revision > existing.acked)) throw new Error("This device has pending changes. Sync or resolve them before opening the cloud copy.");
    assertReplaceable(data);
    const record: SessionRecord = { id, ownerId: owner, session: parseSession(remote.data), metadata: remote.metadata, version: remote.version, revision: 1, acked: 1, updatedAt: Date.parse(remote.updated_at) };
    hub.records[id] = record;
    selectRecord(data, id, Date.now());
  });
}
export const openDeviceSession = (id: string) => localChange((data) => selectRecord(data, id, Date.now()));
export async function restoreCopy(snapshot: Pick<RecoverySnapshot, "session" | "metadata" | "ownerId">) {
  await localChange((data) => {
    const hub = ensureHub(data, Date.now());
    if (snapshot.ownerId && snapshot.ownerId !== hub.accountId) throw new Error("Sign in to the account that owns this snapshot");
    assertReplaceable(data); backup(data, "Before restoring a recovery snapshot", Date.now());
    const record = newRecord(parseSession(snapshot.session), Date.now(), snapshot.ownerId, `${snapshot.metadata.title} · recovered`);
    record.metadata = { ...structuredClone(snapshot.metadata), title: record.metadata.title, kind: "recovery", undo: [] };
    hub.records[record.id] = record;
    hub.activeId = record.id; data.session = record.session;
    data.library = (hub.workspaces[scopeKey(record.ownerId)] ??= emptyWorkspace()).payload.library;
    if (!record.ownerId) hub.standaloneId = record.id;
  });
}
export const undoLast = (id: string) => localChange((data) => undoRecent(data, id, Date.now()));
export const saveTemplate = (name: string) => localChange((data) => {
  const hub = ensureHub(data, Date.now()), r = hub.records[hub.activeId], w = hub.workspaces[scopeKey(r.ownerId)];
  w.payload.templates.push(makeTemplate(data, name)); w.revision++;
});
export const applySavedTemplate = (template: SessionTemplate) => localChange((data) => applyTemplate(data, template, Date.now()));
export const deleteTemplate = (id: string) => localChange((data) => {
  const hub = ensureHub(data, Date.now()), r = hub.records[hub.activeId], w = hub.workspaces[scopeKey(r.ownerId)];
  w.payload.templates = w.payload.templates.filter((t) => t.id !== id); w.revision++;
});
export const linkPlayer = (playerId: string, identityId: string) => localChange((data) => {
  const hub = ensureHub(data, Date.now()), r = hub.records[hub.activeId], w = hub.workspaces[scopeKey(r.ownerId)];
  if (!data.session.players.some((p) => p.id === playerId) || !w.payload.identities[identityId]) throw new Error("Player identity no longer exists");
  r.metadata.links[playerId] = identityId; r.revision++;
});
export const savePlayerIdentity = (playerId: string) => localChange((data) => {
  const hub = ensureHub(data, Date.now()), r = hub.records[hub.activeId], w = hub.workspaces[scopeKey(r.ownerId)];
  const player = data.session.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Player no longer exists");
  if (w.payload.library.some((p) => p.name.toLowerCase() === player.name.toLowerCase())) throw new Error("A player with this name already exists. Link that identity explicitly.");
  const id = crypto.randomUUID(), now = Date.now();
  w.payload.library.push({ id, name: player.name, level: player.level, gender: player.gender, createdAt: now, updatedAt: now });
  w.payload.identities[id] = { name: player.name }; w.revision++;
  r.metadata.links[playerId] = id; r.revision++; data.library = w.payload.library;
});
export const adoptRecovery = (id: string) => localChange((data) => {
  const hub = ensureHub(data, Date.now()), r = hub.records[id];
  if (!r || (r.ownerId && r.ownerId !== hub.accountId)) throw new Error("Access denied");
  r.metadata.kind = "primary"; r.revision++;
});
export const resolveWorkspace = (choice: "cloud" | "device") => localChange((data) => {
  const hub = ensureHub(data, Date.now()), owner = getCloudState().user?.id, w = owner && hub.workspaces[owner];
  if (!w || !w.conflict) throw new Error("No workspace conflict");
  // Persist both library/template copies before choosing either one.
  const key = `recovery-workspace:${owner}:${crypto.randomUUID()}`;
  hub.workspaces[key] = structuredClone(w);
  hub.workspaces[`recovery-workspace:${owner}:${crypto.randomUUID()}`] = { ...structuredClone(w), payload: structuredClone(w.conflict.payload) };
  if (choice === "cloud") { w.payload = w.conflict.payload; w.revision++; w.acked = w.revision; }
  else w.revision++;
  w.version = w.conflict.version; delete w.flight; delete w.conflict;
  if (hub.records[hub.activeId].ownerId === owner) data.library = w.payload.library;
});
export function currentHub() { const data = getSnapshot().data; return { data, hub: data.hub, record: data.hub?.records[data.hub.activeId] }; }
export async function renameSession(title: string) {
  await localChange((data) => { const hub = ensureHub(data, Date.now()), r = hub.records[hub.activeId]; if (!title.trim() || title.trim().length > 200) throw new Error("Enter a title up to 200 characters"); r.metadata.title = title.trim(); r.revision++; });
}
export async function readCloudSnapshots(id: string) {
  const owner = getCloudState().user?.id;
  if (!owner) throw new Error("Sign in to read cloud backups");
  const result = await cloudRequest<{ snapshots: { id: string; data: unknown; metadata: SessionMetadata; reason: string; created_at: string }[] }>(`sessions/${id}/snapshots`);
  if (getCloudState().user?.id !== owner) throw new Error("Account changed");
  return result.snapshots.map((s) => ({ id: s.id, sessionId: id, ownerId: owner, session: parseSession(s.data), metadata: s.metadata, reason: s.reason, at: Date.parse(s.created_at), uploaded: true }));
}

export const restoreWorkspaceCopy = (key: string) => localChange((data) => {
  const hub = ensureHub(data, Date.now()), owner = getCloudState().user?.id;
  if (!owner || !key.startsWith(`recovery-workspace:${owner}:`) || !hub.workspaces[key]) throw new Error("Workspace copy belongs to another account");
  const current = hub.workspaces[owner];
  if (current.conflict || current.flight) throw new Error("Resolve or finish pending cloud updates before restoring a workspace copy");
  hub.workspaces[`recovery-workspace:${owner}:${crypto.randomUUID()}`] = structuredClone(current);
  current.payload = structuredClone(hub.workspaces[key].payload); current.revision++;
  if (hub.records[hub.activeId].ownerId === owner) data.library = current.payload.library;
});

export const restoreCloudWorkspacePayload = (payload: unknown) => localChange((data) => {
  const hub = ensureHub(data, Date.now()), owner = getCloudState().user?.id;
  if (!owner) throw new Error("Sign in to restore a cloud workspace");
  const current = hub.workspaces[owner];
  if (current.conflict || current.flight) throw new Error("Resolve or finish pending updates before restoring a workspace");
  hub.workspaces[`recovery-workspace:${owner}:${crypto.randomUUID()}`] = structuredClone(current);
  current.payload = parseWorkspace(payload); current.revision++;
  if (hub.records[hub.activeId].ownerId === owner) data.library = current.payload.library;
});
