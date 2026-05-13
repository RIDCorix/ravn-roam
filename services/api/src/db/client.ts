import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env.js";
import schema from "./schema/index.js";

let cached: ReturnType<typeof drizzle> | null = null;

// Lazy so the service can boot for /healthz even when DATABASE_URL is unset.
// First real call to `getDb()` is the place that hard-fails on missing creds.
export function getDb() {
  if (cached) return cached;
  if (!env.DATABASE_URL) {
    throw new Error(
      "[@roam/api] DATABASE_URL is required to access the database. " +
        "See services/api/.env.example.",
    );
  }
  const client = postgres(env.DATABASE_URL, { prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}

export type Db = ReturnType<typeof getDb>;
