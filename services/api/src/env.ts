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
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
