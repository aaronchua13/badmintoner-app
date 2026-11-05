import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export class CloudError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const cloudConfigured = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export async function cloudClient() {
  if (!cloudConfigured()) throw new CloudError("Cloud features are not configured. Offline queuing is available.", 503);
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { name: "queue-cloud-auth", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: { getAll: () => jar.getAll(), setAll: (items) => { for (const item of items) jar.set(item.name, item.value, item.options); } },
  });
}
export function anonymousCloudClient() {
  if (!cloudConfigured()) throw new CloudError("Cloud features are not configured", 503);
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function signupReady() {
  // Notification settings are admin-only; an operator must verify them before
  // enabling registration. The public Auth settings are checked on every signup.
  if (!cloudConfigured() || process.env.QUEUING_CLOUD_NO_EMAIL_VERIFIED !== "true") return false;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    return response.ok && data.mailer_autoconfirm === true && data.disable_signup !== true && data.external?.email === true;
  } catch { return false; }
}
export function cloudResponse(body: unknown, status = 200, extra?: Record<string, string>) {
  const headers = { "Cache-Control": "private, no-store", Pragma: "no-cache", Expires: "0", "Referrer-Policy": "no-referrer", ...extra };
  return status === 304 ? new NextResponse(null, { status, headers }) : NextResponse.json(body, { status, headers });
}
export function databaseError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "40001") throw new CloudError("This cloud copy changed on another device. Both copies have been preserved.", 409);
  if (error.code === "42501") throw new CloudError("Access denied", 403);
  throw new CloudError(error.message, 400);
}
