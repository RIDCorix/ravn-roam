import { createBrowserClient } from "@supabase/ssr";

import { getEnv } from "../env";

export function createSupabaseBrowserClient() {
  const env = getEnv();
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
