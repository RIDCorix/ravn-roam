// The standing check that the public storefront is actually serving.
//
// The 2026-09 outage ran for an unknown length of time before a human noticed,
// because nothing was watching the endpoints the shop depends on. A runbook
// paragraph telling somebody to "point an uptime monitor at /readyz" is not
// monitoring; this is the thing that runs.
//
// It is deliberately dependency-free (global `fetch`, no SDK) so it can run
// from a GitHub Actions cron, from a laptop during an incident, or from any
// box with node — see .github/workflows/storefront-monitor.yml and
// `pnpm --filter @roam/api monitor:storefront`.

/** Every probe outcome that is not a hard failure still has to be reportable. */
export type ProbeStatus = "pass" | "warn" | "fail";

export interface ProbeCheck {
  name: string;
  status: ProbeStatus;
  /** Path probed, relative to the API origin. */
  path: string;
  /** HTTP status observed, or null when the request never completed. */
  http_status: number | null;
  duration_ms: number;
  detail?: string;
}

export interface ProbeReport {
  ok: boolean;
  /** True when nothing failed but something needs a human eventually. */
  degraded: boolean;
  base_url: string;
  checked_at: string;
  /** Commit reported by /healthz, so an alert says which build is live. */
  sha: string | null;
  checks: ProbeCheck[];
}

export interface ProbeOptions {
  baseUrl: string;
  /** ISO code used for the catalog spot-check. */
  destination?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface Fetched {
  status: number | null;
  body: unknown;
  error?: string;
  durationMs: number;
}

async function getJson(
  base: string,
  path: string,
  opts: Required<Pick<ProbeOptions, "timeoutMs">> & {
    fetchImpl: typeof fetch;
    now: () => number;
  },
): Promise<Fetched> {
  const started = opts.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await opts.fetchImpl(`${base}${path}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // A 500 from a proxy is often HTML; the status alone is the signal.
      body = null;
    }
    return { status: res.status, body, durationMs: opts.now() - started };
  } catch (err) {
    return {
      status: null,
      body: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: opts.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

function rowsOf(body: unknown, key: string): unknown[] | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : null;
}

export async function probeStorefront(
  options: ProbeOptions,
): Promise<ProbeReport> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const destination = (options.destination ?? "JP").toUpperCase();
  const get = (path: string) =>
    getJson(base, path, {
      timeoutMs: options.timeoutMs ?? 15_000,
      fetchImpl: options.fetchImpl ?? fetch,
      now: options.now ?? (() => Date.now()),
    });

  const checks: ProbeCheck[] = [];
  let sha: string | null = null;

  const record = (
    name: string,
    path: string,
    fetched: Fetched,
    verdict: { status: ProbeStatus; detail?: string },
  ) => {
    checks.push({
      name,
      path,
      http_status: fetched.status,
      duration_ms: fetched.durationMs,
      status: verdict.status,
      ...(verdict.detail ? { detail: verdict.detail } : {}),
    });
  };

  // 1. Liveness. A failure here means the process itself is gone.
  const health = await get("/healthz");
  if (health.status === 200) {
    const body = health.body as { sha?: string | null } | null;
    sha = body?.sha ?? null;
    record("liveness", "/healthz", health, {
      // Without a sha every alert is anonymous: you cannot tell whether the
      // fix you shipped is the code that is failing. That is worth a warning.
      status: sha ? "pass" : "warn",
      ...(sha
        ? {}
        : {
            detail:
              "/healthz reports no sha — this build predates the automatic " +
              "RAILWAY_GIT_COMMIT_SHA fallback, or GIT_SHA is set to an empty value",
          }),
    });
  } else {
    record("liveness", "/healthz", health, {
      status: "fail",
      detail: health.error ?? `expected 200, got ${health.status}`,
    });
  }

  // 2. Readiness. This is the check that would have caught 2026-09 at minute
  //    one: it walks DATABASE_URL → connection → schema → catalog.
  const ready = await get("/readyz");
  const readyBody = ready.body as
    | {
        ok?: boolean;
        checks?: Array<{ name: string; status: string; detail?: string }>;
        catalog?: { servable_products?: number } | null;
      }
    | null;
  if (ready.status === 404) {
    record("readiness", "/readyz", ready, {
      status: "fail",
      detail:
        "/readyz is missing — this deployment predates the readiness endpoint, so it cannot report a data-layer outage",
    });
  } else if (ready.status !== 200 || readyBody?.ok !== true) {
    const broken = (readyBody?.checks ?? [])
      .filter((c) => c.status === "fail")
      .map((c) => `${c.name}: ${c.detail ?? "fail"}`);
    record("readiness", "/readyz", ready, {
      status: "fail",
      detail:
        broken.length > 0
          ? broken.join("; ")
          : (ready.error ?? `expected 200 ok:true, got ${ready.status}`),
    });
  } else {
    const warned = (readyBody.checks ?? []).filter((c) => c.status === "warn");
    record("readiness", "/readyz", ready, {
      status: warned.length > 0 ? "warn" : "pass",
      ...(warned.length > 0
        ? { detail: warned.map((c) => `${c.name}: ${c.detail ?? "warn"}`).join("; ") }
        : {}),
    });
  }

  // 3-4. The two routes that were 500ing, probed directly rather than trusted
  //      via /readyz — readiness models the dependency chain, these are the
  //      actual contract the shop consumes.
  for (const [name, path, key] of [
    ["events", "/storefront/events", "events"],
    ["region_stats", "/storefront/region-stats", "stats"],
  ] as const) {
    const res = await get(path);
    const rows = rowsOf(res.body, key);
    record(name, path, res, {
      status: res.status === 200 && rows !== null ? "pass" : "fail",
      ...(res.status === 200 && rows !== null
        ? {}
        : {
            detail:
              res.error ??
              (res.status === 200
                ? `200 but the body has no \`${key}\` array`
                : `expected 200, got ${res.status}`),
          }),
    });
  }

  // 5. A real catalog read for a destination the shop sells. An empty result
  //    is the signature of a silently broken catalog (bad supplier sync,
  //    dropped mappings) rather than a dead database — warn, do not fail.
  const productsPath = `/storefront/products?destinations=${encodeURIComponent(destination)}`;
  const products = await get(productsPath);
  const productRows = rowsOf(products.body, "products");
  if (products.status !== 200 || productRows === null) {
    record("catalog", productsPath, products, {
      status: "fail",
      detail:
        products.error ??
        (products.status === 200
          ? "200 but the body has no `products` array"
          : `expected 200, got ${products.status}`),
    });
  } else {
    record("catalog", productsPath, products, {
      status: productRows.length > 0 ? "pass" : "warn",
      ...(productRows.length === 0
        ? { detail: `no products offered for ${destination} — the shop renders empty` }
        : {}),
    });
  }

  // 6. Regression canary. A paramless /products answering 200 with an empty
  //    list is precisely what made the outage look like an empty catalog; if
  //    that behaviour ever comes back, this monitor is blind again.
  const paramless = await get("/storefront/products");
  record("paramless_products_contract", "/storefront/products", paramless, {
    status: paramless.status === 400 ? "pass" : "fail",
    ...(paramless.status === 400
      ? {}
      : {
          detail:
            paramless.error ??
            `expected 400 for a request without \`destinations\`, got ${paramless.status} — a broken data layer can hide behind this response again`,
        }),
  });

  const failed = checks.some((c) => c.status === "fail");
  return {
    ok: !failed,
    degraded: !failed && checks.some((c) => c.status === "warn"),
    base_url: base,
    checked_at: new Date().toISOString(),
    sha,
    checks,
  };
}

/** One-line human summary for an alert title. */
export function summarize(report: ProbeReport): string {
  const bad = report.checks.filter((c) => c.status !== "pass");
  if (bad.length === 0) return "all storefront checks pass";
  return bad.map((c) => `${c.name}=${c.status}`).join(", ");
}
