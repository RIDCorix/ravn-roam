import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { env } from "./env.js";
import { createAdminRouter } from "./routes/admin.js";

const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true, sha: env.GIT_SHA ?? null }));

app.route("/", createAdminRouter());

const port = env.PORT ?? 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[@roam/api] listening on http://localhost:${info.port}`);
});

export { app };
