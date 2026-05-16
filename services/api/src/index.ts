import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { env } from "./env.js";
import { createAdminRouter } from "./routes/admin.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { supplierPlansRouter } from "./routes/supplier-plans.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { inviteRouter } from "./routes/invite.js";
import { lumiRouter } from "./routes/lumi.js";
import { tripsRouter } from "./routes/trips.js";
import { vendorsRouter } from "./routes/vendors.js";

const app = new Hono();

// Permissive CORS for local dev — the web app at :3000 calls this service
// at :3001. Tighten in production.
app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  if (origin) {
    c.header("access-control-allow-origin", origin);
    c.header("access-control-allow-credentials", "true");
    c.header(
      "access-control-allow-headers",
      "authorization,content-type,x-admin-user,x-admin-token",
    );
    c.header("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  }
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.get("/healthz", (c) => c.json({ ok: true, sha: env.GIT_SHA ?? null }));

// Catalog admin surface. No auth in Phase 2 — `roam_poc_user` BYPASSes RLS,
// see services/api/src/db/migrations/0001_catalog_rls.sql. Mounted before
// the sync admin router so its token-auth middleware (`/admin/*`) doesn't
// also intercept these UI endpoints.
app.route("/admin/products", productsRouter);
app.route("/admin/supplier-plans", supplierPlansRouter);
app.route("/admin/suppliers", suppliersRouter);
app.route("/admin/vendors", vendorsRouter);
app.route("/admin/orders", ordersRouter);

// Storefront — Supabase-auth-gated trips + Lumi.
app.route("/trips", tripsRouter);
app.route("/lumi", lumiRouter);
app.route("/invite", inviteRouter);

// Supplier-plan sync trigger — token-gated; see routes/admin.ts.
app.route("/", createAdminRouter());

if (process.env.NODE_ENV !== "test") {
  const port = env.PORT ?? 3001;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[@roam/api] listening on http://localhost:${info.port}`);
  });
}

export { app };
