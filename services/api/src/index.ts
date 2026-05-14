import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { sql } from "drizzle-orm";

import { getDb } from "./db/client.js";
import { env } from "./env.js";

const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true, sha: env.GIT_SHA ?? null }));

// Readiness — used by Railway / orchestrators to gate traffic until DB is
// reachable. Distinguishes "process is up" (/healthz) from "process can serve
// real requests" (/readyz). 503 forces the platform to keep us out of the
// rotation; a non-throwing path returning ok=false would still get traffic.
app.get("/readyz", async (c) => {
  if (!env.DATABASE_URL) {
    return c.json({ ok: false, db: "missing DATABASE_URL" }, 503);
  }
  try {
    await getDb().execute(sql`select 1`);
    return c.json({ ok: true, sha: env.GIT_SHA ?? null, db: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, db: message }, 503);
  }
});

const port = env.PORT ?? 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[@roam/api] listening on http://localhost:${info.port}`);
});

export { app };
