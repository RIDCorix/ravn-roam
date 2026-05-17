import { execSync } from "node:child_process";

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
  const isDev = process.env.NODE_ENV !== "production";

  /* Bind with retry. `tsx watch` on file change can spawn the new
     process before the old one fully releases the port — even with a
     SIGTERM handler. Instead of failing, we just wait and retry. If
     the squatter is an orphan (previous crash, lingering tsx child),
     we SIGKILL it after a few failed retries. Dev-only — production
     should NEVER step on another process's port. */
  type ServerLike = ReturnType<typeof serve>;
  let currentServer: ServerLike | null = null;

  // macOS / Linux: returns PIDs currently bound to the TCP port.
  function findPortSquatters(p: number): number[] {
    try {
      const out = execSync(`lsof -ti tcp:${p}`, {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();
      return out
        .split(/\s+/)
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n !== process.pid);
    } catch {
      return []; // no listener (or lsof unavailable)
    }
  }

  function killSquatters(p: number): number {
    const pids = findPortSquatters(p);
    let killed = 0;
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGKILL");
        killed++;
      } catch {
        /* already gone */
      }
    }
    if (killed > 0) {
      console.warn(
        `[@roam/api] killed ${killed} stale process(es) holding port ${p}: ${pids.join(",")}`,
      );
    }
    return killed;
  }

  const listenWithRetry = (
    attempt: number,
    maxAttempts: number,
    delayMs: number,
  ): Promise<ServerLike> =>
    new Promise((resolve, reject) => {
      const s = serve({ fetch: app.fetch, port }, (info) => {
        console.log(
          `[@roam/api] listening on http://localhost:${info.port}`,
        );
      }) as ServerLike & { on?: (e: string, cb: (err: Error) => void) => void };

      let settled = false;
      s.on?.("error", (err: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        if (err.code === "EADDRINUSE" && attempt < maxAttempts) {
          const retriesLeft = maxAttempts - attempt;
          console.warn(
            `[@roam/api] port ${port} still busy, retry in ${delayMs}ms (${retriesLeft} left)`,
          );
          /* After a few polite retries, our own shutdown handler should
             have finished. If the port is STILL held, the squatter is
             an orphan we can't politely ask — SIGKILL it (dev only). */
          if (isDev && attempt >= 3) killSquatters(port);
          setTimeout(() => {
            listenWithRetry(attempt + 1, maxAttempts, delayMs).then(
              resolve,
              reject,
            );
          }, delayMs);
          return;
        }
        reject(err);
      });
      s.on?.("listening", () => {
        if (settled) return;
        settled = true;
        currentServer = s;
        resolve(s);
      });
    });

  void listenWithRetry(0, 15, 200)
    .then((s) => {
      currentServer = s;
    })
    .catch((err) => {
      console.error("[@roam/api] failed to bind", err);
      process.exit(1);
    });

  /* `tsx watch` sends SIGTERM on file change. We don't wait for in-
     flight requests to drain — dev reloads are disruptive by nature
     and any held keep-alive socket blocks the port for the next
     process. closeAllConnections + immediate exit releases the
     socket as fast as the kernel allows. The new process has the
     retry-with-kill loop above as a final backstop. */
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[@roam/api] received ${signal}, closing`);
    const s = currentServer;
    try {
      (s as unknown as { closeAllConnections?: () => void } | null)?.closeAllConnections?.();
    } catch {
      /* older runtime, fall through */
    }
    /* Don't wait for s.close() — pending keep-alive sockets can hold
       it open arbitrarily long. Exit on the next tick so the OS frees
       the port immediately. */
    setImmediate(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGHUP", shutdown);
}

export { app };
