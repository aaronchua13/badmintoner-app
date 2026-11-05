import { z } from "zod";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { initialSession, parseSession, type QueueData } from "./model";
import { expensesSchema } from "./billing";
import { appendPlayerLogs } from "./activity";
import type { Command } from "./transitions";
import type { PlayersDbEntry } from "../types";
import { getTotalIdleTime } from "../utils";

export type SessionMetadata = { title: string; kind: "primary" | "recovery"; links: Record<string, string>; undo: UndoEntry[] };
export type UndoEntry = { id: string; label: string; after: string; before: Pick<QueueData, "players" | "courts" | "queue"> };
export type Upload = { mutationId: string; revision: number; expectedVersion: number; session: QueueData; metadata: SessionMetadata; backupIds: string[] };
export type SessionRecord = {
  id: string; ownerId: string | null; session: QueueData; metadata: SessionMetadata;
  version: number; revision: number; acked: number; updatedAt: number;
  deleted?: boolean; flight?: Upload; conflict?: { version: number; session: QueueData; metadata: SessionMetadata };
};
export type RecoverySnapshot = { id: string; sessionId: string; ownerId: string | null; session: QueueData; metadata: SessionMetadata; reason: string; at: number; uploaded: boolean };
export const templateSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(100), playerIds: z.array(z.string()).max(500), courts: z.array(z.string().trim().min(1).max(200)).max(100), expenses: expensesSchema });
export type SessionTemplate = z.infer<typeof templateSchema>;
export type WorkspacePayload = { library: PlayersDbEntry[]; templates: SessionTemplate[]; identities: Record<string, { name: string }> };
export type WorkspaceRecord = { payload: WorkspacePayload; version: number; revision: number; acked: number; flight?: { mutationId: string; revision: number; expectedVersion: number; payload: WorkspacePayload }; conflict?: { version: number; payload: WorkspacePayload } };
export type Hub = { activeId: string; standaloneId: string; accountId: string | null; records: Record<string, SessionRecord>; snapshots: RecoverySnapshot[]; workspaces: Record<string, WorkspaceRecord> };
export type HubData = { revision: number; session: QueueData; library: PlayersDbEntry[]; hub?: Hub };
export const scopeKey = (ownerId: string | null) => ownerId ?? "local";
export function emptyWorkspace(library: PlayersDbEntry[] = []): WorkspaceRecord {
  return { payload: { library, templates: [], identities: Object.fromEntries(library.map((p) => [p.id, { name: p.name }])) }, version: 0, revision: 0, acked: 0 };
}
export function newRecord(session: QueueData, now: number, ownerId: string | null = null, title?: string): SessionRecord {
  return { id: crypto.randomUUID(), ownerId, session, metadata: { title: title ?? `Session ${new Date(now).toLocaleString()}`, kind: "primary", links: {}, undo: [] }, version: 0, revision: 1, acked: 0, updatedAt: now };
}
export function ensureHub(data: HubData, now: number): Hub {
  if (!data.hub) {
    const record = newRecord(data.session, now);
    for (const p of data.session.players) {
      const entry = data.library.find((entry) => entry.id === `pdb-${p.id}`);
      if (entry) record.metadata.links[p.id] = entry.id;
    }
    data.hub = { activeId: record.id, standaloneId: record.id, accountId: null, records: { [record.id]: record }, snapshots: [], workspaces: { local: emptyWorkspace(data.library) } };
  }
  return data.hub;
}
export const activeRecord = (data: HubData) => data.hub?.records[data.hub.activeId];
export const domainFingerprint = (s: QueueData) => bytesToHex(sha256(new TextEncoder().encode(JSON.stringify({ ...s, playerLogs: [] }))));
const reversible = new Set(["createQueueItem", "removeQueueItem", "removePlayersFromQueue", "addPlayerToQueueItem", "removePlayerFromQueue", "moveQueueItem", "changeQueueTeams", "togglePlayerSelection", "clearCourt", "assignQueueToCourt", "checkInPlayer", "undoCheckIn", "togglePlayerActive", "changeCourtTeams", "transferMatch"]);
export function canUndoCommand(before: QueueData, action: Command) {
  if (!reversible.has(action.type)) return false;
  if (action.type === "changeCourtTeams") return action.status === "idle";
  if (action.type === "transferMatch") return before.courts.find((c) => c.id === action.from)?.status === "idle";
  return true;
}
export function backup(data: HubData, reason: string, now: number) {
  const hub = ensureHub(data, now), record = hub.records[hub.activeId];
  hub.snapshots.push({ id: crypto.randomUUID(), sessionId: record.id, ownerId: record.ownerId, session: structuredClone(data.session), metadata: structuredClone(record.metadata), reason, at: now, uploaded: record.ownerId === null });
  pruneSnapshots(hub);
}
export function pruneSnapshots(hub: Hub) {
  const retained = new Map<string, number>();
  hub.snapshots = [...hub.snapshots].reverse().filter((s) => {
    const n = retained.get(s.sessionId) ?? 0;
    retained.set(s.sessionId, n + 1);
    return n < 20 || !s.uploaded;
  }).reverse();
}
export function recordCommand(data: HubData, before: QueueData, action: Command, now: number) {
  const hub = ensureHub(data, now), old = hub.records[hub.activeId];
  if (["resetState", "restartSession", "importSession"].includes(action.type)) {
    const next = newRecord(data.session, now, old.ownerId);
    if (action.type === "importSession") next.metadata.kind = "recovery";
    if (action.type === "restartSession") next.metadata.links = { ...old.metadata.links };
    hub.records[next.id] = next;
    hub.activeId = next.id;
    if (!next.ownerId) hub.standaloneId = next.id;
  } else {
    if (domainFingerprint(before) !== domainFingerprint(data.session)) {
      if (canUndoCommand(before, action)) {
        old.metadata.undo.push({ id: crypto.randomUUID(), label: ({ createQueueItem: "Create queued match", removeQueueItem: "Remove queued match", removePlayersFromQueue: "Clear queued match", addPlayerToQueueItem: "Add player to queue", removePlayerFromQueue: "Remove player from queue", moveQueueItem: "Reorder queue", changeQueueTeams: "Change queued teams", togglePlayerSelection: "Court assignment", clearCourt: "Clear court", assignQueueToCourt: "Assign queue to court", checkInPlayer: "Check in", undoCheckIn: "Undo check-in", togglePlayerActive: "Availability change", changeCourtTeams: "Change court teams", transferMatch: "Transfer idle court" } as Record<string, string>)[action.type] ?? "Queue action", after: domainFingerprint(data.session), before: structuredClone({ players: before.players, courts: before.courts, queue: before.queue }) });
        old.metadata.undo = old.metadata.undo.slice(-20);
      } else old.metadata.undo = [];
      old.revision++;
      old.updatedAt = now;
    }
    old.session = data.session;
  }
  const record = hub.records[hub.activeId];
  const workspace = hub.workspaces[scopeKey(record.ownerId)] ??= emptyWorkspace(data.library);
  if (JSON.stringify(workspace.payload.library) !== JSON.stringify(data.library)) {
    workspace.payload.library = data.library;
    workspace.revision++;
  }
  for (const p of data.library) workspace.payload.identities[p.id] = { name: p.name };
  if (action.type === "addPlayer") {
    const added = data.session.players.find((p) => p.id === action.id)!;
    const entry = data.library.find((p) => p.name.toLowerCase() === added.name.toLowerCase());
    if (entry) record.metadata.links[added.id] = entry.id;
  }
}
export function assertReplaceable(data: HubData) {
  if (data.session.courts.some((c) => c.status === "active")) throw new Error("Finish or stop running matches before switching or restoring sessions");
}
export function selectRecord(data: HubData, id: string, now: number) {
  const hub = ensureHub(data, now), record = hub.records[id];
  if (!record || (record.ownerId && record.ownerId !== hub.accountId)) throw new Error("This session belongs to another account");
  if (id !== hub.activeId) { assertReplaceable(data); backup(data, "Before opening another session", now); }
  hub.activeId = id;
  data.session = parseSession(record.session);
  data.library = (hub.workspaces[scopeKey(record.ownerId)] ??= emptyWorkspace()).payload.library;
  if (!record.ownerId) hub.standaloneId = id;
}
export function undoRecent(data: HubData, id: string, now: number) {
  const hub = ensureHub(data, now), record = hub.records[hub.activeId], entry = record.metadata.undo.at(-1);
  if (!entry || entry.id !== id || entry.after !== domainFingerprint(data.session)) throw new Error("This action changed or has dependent changes and cannot be undone");
  const before = data.session;
  const restored = parseSession({ ...before, ...structuredClone(entry.before), playerLogs: before.playerLogs });
  const firstNew = restored.playerLogs.length;
  appendPlayerLogs(before, restored, { type: "changeQueueTeams", queueId: "undo", original: [], players: [null, null, null, null] }, now);
  for (const log of restored.playerLogs.slice(firstNew)) log.message = `Undo: ${log.message}`;
  record.metadata.undo.pop();
  record.session = data.session = parseSession(restored);
  record.revision++;
  record.updatedAt = now;
}
export function makeTemplate(data: HubData, name: string): SessionTemplate {
  const hub = ensureHub(data, Date.now()), record = hub.records[hub.activeId];
  const unlinked = data.session.players.filter((p) => !record.metadata.links[p.id]);
  if (unlinked.length) throw new Error("Link all session players to the player database before saving a template");
  return templateSchema.parse({ id: crypto.randomUUID(), name, playerIds: data.session.players.map((p) => record.metadata.links[p.id]), courts: data.session.courts.map((c) => c.name), expenses: data.session.billing.expenses });
}
export function applyTemplate(data: HubData, template: SessionTemplate, now: number) {
  assertReplaceable(data);
  backup(data, "Before applying template", now);
  const hub = ensureHub(data, now), previous = hub.records[hub.activeId];
  const workspace = hub.workspaces[scopeKey(previous.ownerId)];
  const missing = template.playerIds.filter((id) => !workspace.payload.library.some((p) => p.id === id));
  if (missing.length) throw new Error("Some template players were removed. Edit the template selection before using it.");
  const s = initialSession(now);
  s.courts = template.courts.map((name) => ({ id: crypto.randomUUID(), name, status: "idle", players: [null, null, null, null], startTime: null }));
  s.courtHistory = s.courts.map((c) => ({ id: c.id, name: c.name, addedAt: now, removedAt: null, gamesPlayed: 0 }));
  s.billing.expenses = structuredClone(template.expenses);
  const next = newRecord(s, now, previous.ownerId, template.name);
  for (const id of template.playerIds) {
    const p = workspace.payload.library.find((p) => p.id === id)!;
    const playerId = crypto.randomUUID();
    s.players.push({ id: playerId, name: p.name, gender: p.gender, level: p.level, joinedAt: now, checkedInAt: null, gamesPlayed: 0, wins: 0, losses: 0, totalIdleTime: 0, lastMatchEndTime: now, firstMatchTime: null, partners: {}, isPlaying: false, isActive: true });
    next.metadata.links[playerId] = id;
  }
  data.session = next.session = parseSession(s);
  hub.records[next.id] = next;
  hub.activeId = next.id;
  if (!next.ownerId) hub.standaloneId = next.id;
}
export function displayProjection(s: QueueData, title: string, updatedAt: number) {
  const name = (id: string | null) => id ? s.players.find((p) => p.id === id)?.name ?? "Removed player" : null;
  return { title, status: s.sessionStatus, updatedAt, courts: s.courts.map((c) => ({ name: c.name, status: c.status, startTime: c.startTime, team1: c.players.slice(0, 2).map(name), team2: c.players.slice(2).map(name) })), queue: s.queue.map((q) => ({ team1: q.team1.map(name), team2: q.team2.map(name) })) };
}
export type DisplayProjection = ReturnType<typeof displayProjection>;
export function playerHistory(records: SessionRecord[]) {
  const totals = new Map<string, { id: string; name: string; sessions: number; games: number; wins: number; losses: number; idle: number; partners: Record<string, number> }>();
  for (const r of records.filter((r) => r.session.sessionStatus === "ended" && r.metadata.kind === "primary")) {
    const s = r.session;
    const historical = new Map(s.history.flatMap((m) => m.players).map((p) => [p.id, p.name]));
    for (const id of new Set([...s.players.map((p) => p.id), ...historical.keys()])) {
      const identity = r.metadata.links[id] ?? `${r.id}:${id}`;
      const p = s.players.find((p) => p.id === id);
      const matches = s.history.filter((m) => m.players.some((p) => p.id === id));
      const attended = (p && p.checkedInAt !== null) || matches.length || s.playerLogs.some((l) => l.playerId === id && l.kind === "attendance" && l.message === "Checked in");
      if (!attended) continue;
      const t = totals.get(identity) ?? { id: identity, name: p?.name ?? historical.get(id) ?? "Removed player", sessions: 0, games: 0, wins: 0, losses: 0, idle: 0, partners: {} };
      t.sessions++;
      if (p) t.idle += getTotalIdleTime(p, s.sessionStartTime, s.sessionEndTime ?? 0);
      for (const m of matches.filter((m) => !m.isStopped)) {
        const player = m.players.find((p) => p.id === id)!;
        t.games++;
        if (m.winners === player.team) t.wins++; else t.losses++;
        for (const partner of m.players.filter((p) => p.id !== id && p.team === player.team)) {
          const partnerId = r.metadata.links[partner.id] ?? `${r.id}:${partner.id}`;
          t.partners[partnerId] = (t.partners[partnerId] ?? 0) + 1;
        }
      }
      totals.set(identity, t);
    }
  }
  return [...totals.values()].map((t) => ({ ...t, idlePerGame: t.games ? t.idle / t.games : null }));
}
