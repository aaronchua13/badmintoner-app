import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { cloudClient, anonymousCloudClient, cloudConfigured, signupReady, CloudError, cloudResponse, databaseError } from "../../../../../lib/queue-cloud/server";
import { parseWrite, parseWorkspace } from "../../../../queuing/cloud/contracts";
import { parseSession, errorText } from "../../../../queuing/state/model";
import { playerHistory, type SessionRecord, type SessionMetadata } from "../../../../queuing/state/hub";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
const idSchema = z.string().uuid();
async function json(request: NextRequest) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 16 * 1024 * 1024) throw new CloudError("This cloud upload is too large. Your local copy is safe.", 413);
  try { return JSON.parse(text); } catch { throw new CloudError("Invalid JSON"); }
}
async function handle(request: NextRequest, context: Context) {
  try {
    const { path } = await context.params;
    const method = request.method;
    if (method !== "GET") {
      if (request.headers.get("x-queue-client") !== "1") throw new CloudError("Invalid request", 403);
      const origin = request.headers.get("origin");
      if (origin && origin !== request.nextUrl.origin) throw new CloudError("Invalid request origin", 403);
    }
    const endpoint = path.join("/");
    if (endpoint === "config" && method === "GET") return cloudResponse({ configured: cloudConfigured(), signupReady: await signupReady() });
    if (path[0] === "display" && path.length === 2 && method === "GET") {
      if (!/^[A-Za-z0-9_-]{43}$/.test(path[1])) throw new CloudError("This display link is unavailable", 404);
      const { data, error } = await anonymousCloudClient().rpc("queue_read_display", { p_token: path[1] });
      databaseError(error);
      if (!data) throw new CloudError("This display link is unavailable", 404);
      return cloudResponse(data);
    }
    const client = await cloudClient();
    if (endpoint === "auth/signup" && method === "POST") {
      if (!await signupReady()) throw new CloudError("Registration is disabled until no-email signup is configured in Supabase.", 503);
      const input = z.object({ email: z.string().email().max(254), password: z.string().length(20) }).parse(await json(request));
      const { data, error } = await client.auth.signUp(input);
      if (error) throw new CloudError(error.message, 400);
      if (!data.session || !data.user) throw new CloudError("No-email signup is not available. Your local queue is unchanged.", 503);
      return cloudResponse({ user: { id: data.user.id, email: data.user.email } });
    }
    if (endpoint === "auth/login" && method === "POST") {
      const input = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).parse(await json(request));
      const { data, error } = await client.auth.signInWithPassword(input);
      if (error) throw new CloudError("Invalid email or password", 401);
      return cloudResponse({ user: { id: data.user.id, email: data.user.email } });
    }
    const { data: auth, error: authError } = await client.auth.getUser();
    if (endpoint === "auth/me" && method === "GET") return cloudResponse({ user: authError || !auth.user ? null : { id: auth.user.id, email: auth.user.email } });
    if (authError || !auth.user) throw new CloudError("Sign in to use cloud features. Your offline changes are safe.", 401);
    const owner = auth.user.id;
    const expectedOwner = request.headers.get("x-queue-owner");
    if (expectedOwner && expectedOwner !== owner) throw new CloudError("The cloud account changed. This device draft has not been uploaded.", 401);
    if (endpoint === "auth/logout" && method === "POST") {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw new CloudError(error.message);
      return cloudResponse({ ok: true });
    }
    if (endpoint === "auth/password" && method === "POST") {
      const input = z.object({ currentPassword: z.string().min(1).max(200), password: z.string().min(12).max(200) }).parse(await json(request));
      const { error } = await client.auth.updateUser({ password: input.password, current_password: input.currentPassword });
      if (error) throw new CloudError(error.message);
      return cloudResponse({ ok: true });
    }
    if (endpoint === "workspace/snapshots" && method === "GET") {
      const { data, error } = await client.from("queue_workspace_snapshots").select("id,payload,version,created_at").eq("owner_id", owner).order("created_at", { ascending: false }).limit(20);
      databaseError(error); return cloudResponse({ snapshots: data });
    }
    if (endpoint === "workspace") {
      if (method === "GET") {
        const { data, error } = await client.from("queue_workspaces").select("version,payload").eq("owner_id", owner).maybeSingle();
        databaseError(error);
        return cloudResponse(data ?? { version: 0, payload: { library: [], templates: [], identities: {} } });
      }
      if (method === "PUT") {
        const input = z.object({ expectedVersion: z.number().int().nonnegative(), mutationId: idSchema, payload: z.unknown() }).parse(await json(request));
        const { data, error } = await client.rpc("queue_save_workspace", { p_expected: input.expectedVersion, p_mutation: input.mutationId, p_payload: parseWorkspace(input.payload) });
        databaseError(error);
        return cloudResponse(data);
      }
    }
    if (endpoint === "sessions" && method === "GET") {
      const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);
      const { data, error } = await client.from("queue_sessions").select("id,version,metadata,updated_at,status").eq("owner_id", owner).order("updated_at", { ascending: false }).range(offset, offset + 49);
      databaseError(error); return cloudResponse({ sessions: data });
    }
    if (endpoint === "history" && method === "GET") {
      const records: SessionRecord[] = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.from("queue_sessions").select("id,version,data,metadata,updated_at").eq("owner_id", owner).eq("status", "ended").order("id").range(offset, offset + 99);
        databaseError(error);
        for (const row of data ?? []) records.push({ id: row.id, ownerId: owner, version: row.version, revision: 0, acked: 0, session: parseSession(row.data), metadata: row.metadata as SessionMetadata, updatedAt: Date.parse(row.updated_at) });
        if (!data || data.length < 100) break;
      }
      return cloudResponse({ players: playerHistory(records) });
    }
    if (endpoint === "templates" && method === "GET") {
      const { data, error } = await client.from("queue_workspaces").select("payload").eq("owner_id", owner).maybeSingle();
      databaseError(error); return cloudResponse({ templates: data?.payload.templates ?? [] });
    }
    if (path[0] === "sessions" && path[1]) {
      const id = idSchema.parse(path[1]);
      if (path.length === 2 && method === "GET") {
        const { data: head, error: headError } = await client.from("queue_sessions").select("version").eq("owner_id", owner).eq("id", id).maybeSingle();
        databaseError(headError);
        if (!head) throw new CloudError("Session not found", 404);
        if (request.headers.get("if-none-match") === String(head.version)) return cloudResponse(null, 304);
        const { data, error } = await client.from("queue_sessions").select("id,version,data,metadata,updated_at").eq("owner_id", owner).eq("id", id).single();
        databaseError(error); return cloudResponse(data, 200, { ETag: String(data!.version) });
      }
      if (path.length === 2 && method === "PUT") {
        const input = parseWrite(await json(request));
        const { data, error } = await client.rpc("queue_save_session", { p_id: id, p_expected: input.expectedVersion, p_mutation: input.mutationId, p_data: input.session, p_meta: input.metadata, p_backups: input.backups });
        databaseError(error); return cloudResponse(data);
      }
      if (path.length === 2 && method === "DELETE") {
        const { error } = await client.rpc("queue_delete_session", { p_id: id });
        databaseError(error); return cloudResponse({ ok: true });
      }
      if (path[2] === "snapshots" && path.length === 3 && method === "GET") {
        const { data, error } = await client.from("queue_snapshots").select("id,reason,created_at,data,metadata").eq("owner_id", owner).eq("session_id", id).order("created_at", { ascending: false }).limit(20);
        databaseError(error); return cloudResponse({ snapshots: data });
      }
      if (path[2] === "restore" && path.length === 3 && method === "POST") {
        const input = z.object({ snapshotId: idSchema, expectedVersion: z.number().int().nonnegative(), mutationId: idSchema }).parse(await json(request));
        // The source may have aged out of retention after an acknowledged restore.
        // A lost-response retry still returns its original committed result.
        const { data: receipt, error: receiptError } = await client.from("queue_write_receipts").select("version").eq("owner_id", owner).eq("resource_id", id.toLowerCase()).eq("mutation_id", input.mutationId).maybeSingle();
        databaseError(receiptError);
        if (receipt) return cloudResponse({ version: receipt.version, duplicate: true });
        const { data: snapshot, error } = await client.from("queue_snapshots").select("data,metadata").eq("owner_id", owner).eq("session_id", id).eq("id", input.snapshotId).single();
        databaseError(error);
        const { data, error: writeError } = await client.rpc("queue_save_session", { p_id: id, p_expected: input.expectedVersion, p_mutation: input.mutationId, p_data: parseSession(snapshot!.data), p_meta: snapshot!.metadata, p_backups: [] });
        databaseError(writeError); return cloudResponse(data);
      }
      if (path[2] === "share" && path.length === 3) {
        if (method === "GET") {
          const { data, error } = await client.from("queue_displays").select("token").eq("owner_id", owner).eq("session_id", id).maybeSingle();
          databaseError(error); return cloudResponse({ token: data?.token ?? null });
        }
        if (method === "POST" || method === "DELETE") {
          const { data, error } = await client.rpc("queue_share_session", { p_id: id, p_token: method === "DELETE" ? null : randomBytes(32).toString("base64url") });
          databaseError(error); return cloudResponse(data);
        }
      }
    }
    throw new CloudError("Not found", 404);
  } catch (error) {
    return cloudResponse({ error: errorText(error) }, error instanceof CloudError ? error.status : 400);
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
