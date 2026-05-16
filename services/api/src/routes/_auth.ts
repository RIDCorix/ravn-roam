// Resolves a Supabase-authenticated user from the incoming `Authorization:
// Bearer <jwt>` header. The web app's server components forward the user's
// access token; we hand it to Supabase to validate.
//
// Mounted on the `/trips/*` storefront routes. Admin routes still use the
// `x-admin-token` shared-secret pattern documented in routes/admin.ts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Context, Next } from "hono";

import { env } from "../env.js";

export interface AuthedUser {
  id: string;
  email: string | null;
}

let cached: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  cached = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function getUser(c: Context): AuthedUser {
  const u = c.get("user") as AuthedUser | undefined;
  if (!u) throw new Error("requireAuth must run before getUser");
  return u;
}

export async function requireAuth(c: Context, next: Next) {
  const supabase = getSupabase();
  if (!supabase) {
    return c.json(
      { error: "auth_not_configured", message: "SUPABASE_URL / SUPABASE_ANON_KEY missing on the API" },
      503,
    );
  }
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return c.json({ error: "unauthorized", message: "missing bearer token" }, 401);
  }
  const token = header.slice("bearer ".length).trim();
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return c.json({ error: "unauthorized", message: error?.message ?? "invalid token" }, 401);
  }
  c.set("user", { id: data.user.id, email: data.user.email ?? null });
  await next();
}
