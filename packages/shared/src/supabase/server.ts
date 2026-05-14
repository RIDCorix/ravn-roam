import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getEnv } from "../env";

// Anon-key, cookie-bound Supabase client for Server Components and Route
// Handlers. Honors RLS — same access surface as a browser session.
//
// Server-side privileged Postgres work goes through DATABASE_URL with the
// per-PoC `<slug>_poc_user` role, NOT through the shared service_role key.
// See agent-rules/06-shared-supabase.md.
export async function createSupabaseServerClient() {
  const env = getEnv();
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — Next.js will refresh cookies on the next request.
        }
      },
    },
  });
}
