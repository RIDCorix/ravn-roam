import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { env } from "./env.js";

const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true, sha: env.GIT_SHA ?? null }));

const port = env.PORT ?? 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[@roam/api] listening on http://localhost:${info.port}`);
});

export { app };
