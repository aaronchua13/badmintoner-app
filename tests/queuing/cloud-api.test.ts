import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { initialSession } from "../../app/queuing/state/model";
const mocks = vi.hoisted(() => {
  const user = { id: "10000000-0000-4000-8000-000000000001", email: "organizer@example.invalid" };
  return {
    user,
    jar: { getAll: vi.fn(() => []), set: vi.fn() },
    auth: { getUser: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), updateUser: vi.fn() },
    rpc: vi.fn(), anonymousRpc: vi.fn(), factory: vi.fn(), from: vi.fn(),
  };
});
vi.mock("next/headers", () => ({ cookies: async () => mocks.jar }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (...args: unknown[]) => { mocks.factory(...args); return { auth: mocks.auth, rpc: mocks.rpc, from: mocks.from }; } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.anonymousRpc }) }));
import { GET, POST, PUT } from "../../app/api/queuing/cloud/[...path]/route";
const invoke = (path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) => {
  const request = new NextRequest(`https://queue.example/api/queuing/cloud/${path}`, { method, headers: { "x-queue-client": "1", origin: "https://queue.example", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return ({ GET, POST, PUT }[method as "GET" | "POST" | "PUT"])(request, { params: Promise.resolve({ path: path.split("/") }) });
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("QUEUING_CLOUD_NO_EMAIL_VERIFIED", "true");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ mailer_autoconfirm: true, external: { email: true }, disable_signup: false }))));
  mocks.auth.getUser.mockResolvedValue({ data: { user: mocks.user }, error: null });
  mocks.auth.signUp.mockResolvedValue({ data: { session: { access_token: "test" }, user: mocks.user }, error: null });
  mocks.auth.signInWithPassword.mockResolvedValue({ data: { user: mocks.user }, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
  mocks.auth.updateUser.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: { version: 1 }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("leaves cloud unavailable with missing configuration and keeps responses private", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  const response = await invoke("config");
  expect(await response.json()).toEqual({ configured: false, signupReady: false });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("does not register until no-email settings have been explicitly verified", async () => {
  vi.stubEnv("QUEUING_CLOUD_NO_EMAIL_VERIFIED", "");
  expect((await invoke("auth/signup", "POST", { email: mocks.user.email, password: "A234567890abcdefghi!" })).status).toBe(503);
  expect(mocks.auth.signUp).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects registration if email confirmation is turned back on", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ mailer_autoconfirm: false, external: { email: true } }))));
  expect((await invoke("auth/signup", "POST", { email: mocks.user.email, password: "A234567890abcdefghi!" })).status).toBe(503);
  expect(mocks.auth.signUp).not.toHaveBeenCalled();
});
it("uses password signup with separate HttpOnly cloud cookies and no OTP calls", async () => {
  const input = { email: mocks.user.email, password: "A234567890abcdefghi!" };
  const response = await invoke("auth/signup", "POST", input);
  expect(response.status).toBe(200);
  expect(mocks.auth.signUp).toHaveBeenCalledWith(input);
  expect(await response.json()).toEqual({ user: mocks.user });
  expect(mocks.factory.mock.calls[0][2].cookieOptions).toMatchObject({ name: "queue-cloud-auth", httpOnly: true, sameSite: "lax" });
});
it("requires the current password when changing it", async () => {
  expect((await invoke("auth/password", "POST", { password: "new-password-123" })).status).toBe(400);
  expect(mocks.auth.updateUser).not.toHaveBeenCalled();
  expect((await invoke("auth/password", "POST", { currentPassword: "old-password", password: "new-password-123" })).status).toBe(200);
  expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password: "new-password-123", current_password: "old-password" });
});
it("verifies authentication before private operations and signs out only cloud auth", async () => {
  expect((await invoke("auth/login", "POST", { email: mocks.user.email, password: "test-password" })).status).toBe(200);
  expect((await invoke("auth/logout", "POST", {})).status).toBe(200);
  expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  mocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Expired") });
  expect((await invoke("sessions")).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects cross-origin mutations", async () => {
  expect((await invoke("auth/login", "POST", {}, { origin: "https://other.example" })).status).toBe(403);
  expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
});
it("rejects writes captured for an account whose cookies have since switched", async () => {
  const response = await invoke("workspace", "PUT", {}, { "x-queue-owner": "10000000-0000-4000-8000-000000000002" });
  expect(response.status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("validates JSON and uses authenticated ownership rather than a supplied owner", async () => {
  const path = "sessions/20000000-0000-4000-8000-000000000001";
  const input = { expectedVersion: 0, mutationId: "30000000-0000-4000-8000-000000000001", ownerId: "attacker", session: initialSession(1000), metadata: { title: "Test", kind: "primary", links: {}, undo: [] } };
  expect((await invoke(path, "PUT", { ...input, session: { schemaVersion: 99 } })).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect((await invoke(path, "PUT", input)).status).toBe(200);
  expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("ownerId");
  expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_expected: 0, p_mutation: input.mutationId });
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "Version conflict" } });
  expect((await invoke(path, "PUT", input)).status).toBe(409);
});
it("serves spectators only through the token projection RPC", async () => {
  mocks.anonymousRpc.mockResolvedValue({ data: { title: "TV", courts: [], queue: [] }, error: null });
  expect((await invoke(`display/${"a".repeat(43)}`)).status).toBe(200);
  expect(mocks.auth.getUser).not.toHaveBeenCalled();
  expect(mocks.anonymousRpc).toHaveBeenCalledWith("queue_read_display", { p_token: "a".repeat(43) });
  mocks.anonymousRpc.mockResolvedValue({ data: null, error: null });
  expect((await invoke(`display/${"a".repeat(43)}`)).status).toBe(404);
});
it("acknowledges a repeated restore even after its source snapshot has been pruned", async () => {
  const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { version: 3 }, error: null })) };
  builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); mocks.from.mockReturnValue(builder);
  const response = await invoke("sessions/20000000-0000-4000-8000-000000000001/restore", "POST", { snapshotId: "40000000-0000-4000-8000-000000000001", expectedVersion: 2, mutationId: "30000000-0000-4000-8000-000000000001" });
  expect(await response.json()).toEqual({ version: 3, duplicate: true });
  expect(mocks.from).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
