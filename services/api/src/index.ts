import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { env } from "./env.js";
import { createAdminRouter } from "./routes/admin.js";
import { productsRouter } from "./routes/products.js";
import { supplierPlansRouter } from "./routes/supplier-plans.js";
import { suppliersRouter } from "./routes/suppliers.js";

const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true, sha: env.GIT_SHA ?? null }));

// Catalog admin surface. No auth in Phase 2 — `roam_poc_user` BYPASSes RLS,
// see services/api/src/db/migrations/0001_catalog_rls.sql. Mounted before
// the sync admin router so its token-auth middleware (`/admin/*`) doesn't
// also intercept these UI endpoints.
app.route("/admin/products", productsRouter);
app.route("/admin/supplier-plans", supplierPlansRouter);
app.route("/admin/suppliers", suppliersRouter);

// Supplier-plan sync trigger — token-gated; see routes/admin.ts.
app.route("/", createAdminRouter());

if (process.env.NODE_ENV !== "test") {
  const port = env.PORT ?? 3001;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[@roam/api] listening on http://localhost:${info.port}`);
  });
}

export { app };
