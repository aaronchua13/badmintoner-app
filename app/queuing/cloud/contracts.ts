import { z } from "zod";
import { parseSession, librarySchema } from "../state/model";
import { templateSchema, type SessionMetadata, type WorkspacePayload } from "../state/hub";
const bounded = z.string().max(200);
const metadata = z.object({ title: bounded.trim().min(1), kind: z.enum(["primary", "recovery"]), links: z.record(bounded.min(1)), undo: z.array(z.object({ id: z.string().uuid(), label: bounded, after: z.string().max(4_000_000), before: z.object({ players: z.array(z.unknown()), courts: z.array(z.unknown()), queue: z.array(z.unknown()) }) })).max(20) });
export const writeSchema = z.object({ expectedVersion: z.number().int().nonnegative(), mutationId: z.string().uuid(), session: z.unknown(), metadata, backups: z.array(z.object({ id: z.string().uuid(), session: z.unknown(), metadata, reason: bounded, at: z.number().finite().nonnegative() })).max(100).default([]) });
export function parseWrite(input: unknown) {
  const value = writeSchema.parse(input);
  const session = parseSession(value.session);
  for (const entry of value.metadata.undo) parseSession({ ...session, ...entry.before });
  return { ...value, session, metadata: value.metadata as SessionMetadata, backups: value.backups.map((b) => ({ ...b, session: parseSession(b.session) })) };
}
export const workspaceSchema = z.object({ library: librarySchema, templates: z.array(templateSchema).max(200), identities: z.record(z.object({ name: bounded.min(1) })) });
export function parseWorkspace(input: unknown): WorkspacePayload {
  const p = workspaceSchema.parse(input);
  if (new Set(p.library.map((p) => p.id)).size !== p.library.length || new Set(p.library.map((p) => p.name.toLowerCase())).size !== p.library.length) throw new Error("Duplicate players in library");
  if (new Set(p.templates.map((t) => t.id)).size !== p.templates.length) throw new Error("Duplicate templates");
  return p;
}
