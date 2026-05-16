import { z } from "zod";

// Everything is optional so the service can boot in dev / health-check mode
// without credentials. Code paths that need a var (DATABASE_URL inside the
// db client, FASTMOVE_* inside FastmoveClient) should re-validate at the
// point of use and throw with a useful message — don't `env.X!` blindly.
const schema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  GIT_SHA: z.string().optional(),

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
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),

  // Supabase project URL + anon key. The /trips/* routes call
  // `supabase.auth.getUser(bearerToken)` to resolve the caller's user_id
  // from the JWT the web app forwards in `Authorization: Bearer ...`.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
