import { z } from "zod";
import {
  Billing,
  billingSchema,
  emptyBilling,
  validateBilling,
  migrateManualBilling,
} from "./billing";
import {
  LEVEL_VALUE,
  PlayerLevel,
  Player,
  Court,
  MatchHistory,
  QueueItem,
  CourtHistoryItem,
  PlayersDbEntry,
} from "../types";

export interface QueueData {
  schemaVersion?: number;
  billing: Billing;
  sessionStartTime: number | null;
  sessionEndTime: number | null;
  sessionStatus: "idle" | "active" | "ended";
  courts: Court[];
  players: Player[];
  history: MatchHistory[];
  queue: QueueItem[];
  autoAssignQueue: boolean;
  courtHistory: CourtHistoryItem[];
}
export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };
export const initialSession = (now: number): QueueData => ({
  schemaVersion: 3,
  billing: emptyBilling(),
  sessionStartTime: null,
  sessionEndTime: null,
  sessionStatus: "idle",
  courts: ["Court 1", "Court 2"].map((name, i) => ({
    id: `c${i + 1}`,
    name,
    status: "idle",
    players: [null, null, null, null],
    startTime: null,
  })),
  players: [],
  history: [],
  queue: [],
  autoAssignQueue: false,
  courtHistory: ["Court 1", "Court 2"].map((name, i) => ({
    id: `c${i + 1}`,
    name,
    addedAt: now,
    removedAt: null,
    gamesPlayed: 0,
  })),
});
const text = z.string().trim().min(1).max(200);
const time = z.number().finite().nonnegative();
const count = time.int();
const level = z.custom<PlayerLevel>(
  (v) => typeof v === "string" && Object.hasOwn(LEVEL_VALUE, v),
  "Invalid player level",
);
const gender = z.enum(["Male", "Female"]);
export const playerInput = z.object({ name: text, level, gender });
const playerSchema = playerInput.extend({
  id: text,
  joinedAt: time,
  checkedInAt: time.nullable().optional(),
  gamesPlayed: count,
  wins: count,
  losses: count,
  totalIdleTime: time,
  lastMatchEndTime: time,
  firstMatchTime: time.nullable(),
  partners: z.record(count),
  isPlaying: z.boolean(),
  isActive: z.boolean().default(true),
  gender: gender.default("Male"),
});
export const librarySchema = z.array(
  playerInput.extend({ id: text, createdAt: time, updatedAt: time }),
);
const courtSchema = z.object({
  id: text,
  name: text,
  status: z.enum(["idle", "active"]),
  players: z.array(text.nullable()).length(4),
  startTime: time.nullable(),
});
const historySchema = z
  .object({
    id: text,
    courtName: text,
    startTime: time,
    endTime: time,
    duration: time,
    players: z
      .array(
        z.object({
          id: text,
          name: text,
          team: z.union([z.literal(1), z.literal(2)]),
        }),
      )
      .max(4),
    winners: z.union([z.literal(1), z.literal(2)]).optional(),
    score: z.string().optional(),
    reason: z.string().optional(),
    isStopped: z.boolean().optional(),
  })
  .refine((h) => h.endTime >= h.startTime, "Match ends before it starts");
const sessionSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  billing: billingSchema.optional(),
  sessionStartTime: time.nullable().default(null),
  sessionEndTime: time.nullable().default(null),
  sessionStatus: z.enum(["idle", "active", "ended"]).optional(),
  courts: z.array(courtSchema),
  players: z.array(playerSchema),
  history: z.array(historySchema),
  queue: z
    .array(
      z.object({
        id: text,
        team1: z.array(text).max(2),
        team2: z.array(text).max(2),
        createdAt: time,
      }),
    )
    .default([]),
  autoAssignQueue: z.boolean().default(false),
  courtHistory: z
    .array(
      z.object({
        id: text,
        name: text,
        addedAt: time,
        removedAt: time.nullable(),
        gamesPlayed: count,
      }),
    )
    .optional(),
});
export function parseSession(input: unknown): QueueData {
  const s = sessionSchema.parse(input);
  if ((s.schemaVersion === 2 || s.schemaVersion === 3) && !s.billing)
    throw new Error("Sessions version 2 and newer require payment data");
  const data: QueueData = {
    ...s,
    schemaVersion: 3,
    billing: s.billing ?? emptyBilling(),
    autoAssignQueue: false,
    players: s.players.map((p) => ({
      ...p,
      checkedInAt: p.checkedInAt === undefined ? p.joinedAt : p.checkedInAt,
    })),
    sessionStatus:
      s.sessionStatus ?? (s.sessionStartTime === null ? "idle" : "active"),
    courtHistory:
      s.courtHistory ??
      s.courts.map((c) => ({
        id: c.id,
        name: c.name,
        addedAt: s.sessionStartTime ?? 0,
        removedAt: null,
        gamesPlayed: 0,
      })),
  };
  for (const records of [
    data.players,
    data.courts,
    data.queue,
    data.history,
    data.courtHistory,
  ]) {
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error("Duplicate record IDs");
  }
  const assigned = new Set<string>();
  const playing = new Set<string>();
  const playerMap = new Map(data.players.map((p) => [p.id, p]));
  for (const c of data.courts) {
    if (
      c.status === "active" &&
      (c.players.some((p) => !p) || c.startTime === null)
    )
      throw new Error("Active courts need four players and a start time");
    if (c.status === "idle" && c.startTime !== null)
      throw new Error("Idle courts cannot have a running timer");
    for (const id of c.players.filter((id): id is string => id !== null)) {
      if (
        !playerMap.get(id)?.isActive ||
        playerMap.get(id)?.checkedInAt === null ||
        assigned.has(id)
      )
        throw new Error("Invalid or duplicate court player");
      assigned.add(id);
      if (c.status === "active") playing.add(id);
    }
  }
  for (const q of data.queue)
    for (const id of [...q.team1, ...q.team2]) {
      if (
        !playerMap.get(id)?.isActive ||
        playerMap.get(id)?.checkedInAt === null ||
        assigned.has(id)
      )
        throw new Error("Invalid or duplicate queued player");
      assigned.add(id);
    }
  if (data.players.some((p) => p.isPlaying !== playing.has(p.id)))
    throw new Error("Player and court playing states disagree");
  if (data.sessionStatus !== "idle" && data.sessionStartTime === null)
    throw new Error("Session start time is missing");
  if (data.sessionStatus === "active" && data.sessionEndTime !== null)
    throw new Error("Active session cannot have an end time");
  if (
    data.sessionStatus === "ended" &&
    (data.sessionEndTime === null ||
      data.sessionEndTime < (data.sessionStartTime ?? 0))
  )
    throw new Error("Invalid session end time");
  if (data.sessionStatus !== "active" && playing.size)
    throw new Error("Running matches require an active session");
  if (s.schemaVersion !== 3 && s.billing) migrateManualBilling(data);
  if (
    Object.values(data.billing.arrangements).some(
      (a) => a.kind === "shared" && a.adjustment !== "fixed",
    )
  )
    throw new Error("Assign a fixed charge per player");
  validateBilling(data);
  return data;
}
export function parseLibrary(input: unknown): PlayersDbEntry[] {
  const entries = librarySchema.parse(input);
  if (
    new Set(entries.map((e) => e.id)).size !== entries.length ||
    new Set(entries.map((e) => e.name.toLowerCase())).size !== entries.length
  )
    throw new Error("Duplicate players in database");
  return entries;
}
export const errorText = (error: unknown) =>
  error instanceof z.ZodError
    ? `Invalid data: ${error.issues[0]?.path.join(".")} ${error.issues[0]?.message}`
    : error instanceof Error
      ? error.message
      : "Unable to save. Please retry.";
