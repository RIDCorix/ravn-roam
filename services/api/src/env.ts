import { z } from "zod";

// Everything is optional so the service can boot in dev / health-check mode
// without credentials. Code paths that need a var (DATABASE_URL inside the
// db client, FASTMOVE_* inside FastmoveClient) should re-validate at the
// point of use and throw with a useful message — don't `env.X!` blindly.
const schema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  GIT_SHA: z.string().optional(),
  // Railway injects this into the running container for every git-sourced
  // deployment. It is NOT usable from a `${{RAILWAY_GIT_COMMIT_SHA}}`
  // variable reference — Railway renders deployment-scoped git variables to
  // an empty string there, which is exactly how the 2026-09 incident ended
  // up with `sha: ""` after the documented fix was applied. Reading it
  // directly is the only thing that works, and it removes the manual step.
  RAILWAY_GIT_COMMIT_SHA: z.string().optional(),

  DATABASE_URL: z.string().url().optional(),

  FASTMOVE_BASE_URL: z.string().url().optional(),
  FASTMOVE_MERCHANT_ID: z.string().optional(),
  FASTMOVE_DEPT_ID: z.string().optional(),
  FASTMOVE_MERCHANT_KEY: z.string().optional(),

  // Shared secret for the `/admin/*` routes. The admin UI button passes
  // this in `x-admin-token`. Until a proper auth layer lands (post-Phase 2)
  // the route refuses to start the sync when this is unset, so we never
  // ship an open trigger to staging by accident.
  ADMIN_API_TOKEN: z.string().min(16).optional(),

  OPENAI_API_KEY: z.string().min(1).optional(),
  // Lumi itinerary planning needs strong instruction-following over a large
  // structured-output contract; gpt-4o-mini drifts. gpt-4.1 is the floor.
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1"),
  OPENAI_SEARCH_MODEL: z.string().min(1).default("gpt-4o-mini-search-preview"),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  GOOGLE_MAPS_HTTP_REFERER: z.string().url().optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GEMINI_SEARCH_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  EVENT_CRAWLER_PROVIDER: z.enum(["gemini", "openai"]).optional(),
  EVENT_CRAWLER_REQUEST_DELAY_MS: z.coerce.number().int().min(0).default(0),
  EVENT_CRAWLER_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(4),

  // Supabase project URL + anon key. The /trips/* routes call
  // `supabase.auth.getUser(bearerToken)` to resolve the caller's user_id
  // from the JWT the web app forwards in `Authorization: Bearer ...`.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);

export type ShaSource = Pick<Env, "GIT_SHA" | "RAILWAY_GIT_COMMIT_SHA">;

/**
 * The commit this process is running, or `null` when it genuinely cannot be
 * determined. `GIT_SHA` wins so a non-Railway host can still declare it;
 * Railway's own deploy-time variable is the fallback.
 *
 * Blank is treated as absent: an unresolved variable reference renders as
 * `""`, and reporting `sha: ""` would look like a configured value while
 * telling an on-call responder nothing.
 */
export function deploymentSha(source: ShaSource = env): string | null {
  return source.GIT_SHA?.trim() || source.RAILWAY_GIT_COMMIT_SHA?.trim() || null;
}
