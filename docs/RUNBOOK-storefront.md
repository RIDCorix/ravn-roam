# Runbook — storefront returns 500 / the shop looks empty

Written after the 2026-09-05 incident, where the production API answered
`/healthz` 200 for the entire outage while every storefront data route was
failing.

**What 2026-09-05 actually was**, for the record: `DATABASE_URL` was set and
well-formed, but pointed at Supabase project `tthcypfhjipwtmumvsqs`, which no
longer existed — `dig` returned nothing for its hostname. Supavisor answered
every connection with `FATAL XX000 (ENOTFOUND) tenant/user postgres.<ref> not
found`, so all three storefront routes died at the connection, not at the
query. Two things kept that invisible: `/healthz` never opens a connection,
and the runtime log carried a bare stack with no route attached. Both are
addressed below.

Two other findings from the same investigation, neither of them the cause but
both worth fixing:

- The running deployment dated from **2026-07-22**; every deployment after it
  is `SKIPPED`, so the service had not shipped code in six weeks.
- `GIT_SHA` was not set on the Railway service, so `/healthz` and `/readyz`
  both reported `"sha": null` and you could not tell which build was live.
  Fixed in code — see §6.

## 1. Read the symptom correctly

The symptom that started the 2026-09 incident:

| Endpoint | Observed |
| --- | --- |
| `/healthz` | 200 |
| `/storefront/events` | 500 |
| `/storefront/region-stats` | 500 |
| `/storefront/products` (no query) | 200 `{"products":[]}` |

That last row was misleading and cost triage time. `/storefront/products`
requires a `destinations` parameter, and the paramless form used to return an
empty list **before opening a database connection** — so it reported success
during a total data-layer outage. It now answers `400`, and the readiness
endpoint below is the thing to probe instead.

`/healthz` is liveness only. It deliberately touches nothing, because
`services/api` must boot without credentials. It can never tell you whether
the service can serve data.

## 2. Ask `/readyz`

```bash
curl -s "$ROAM_API_URL/readyz" | jq
```

`/readyz` walks the same dependency chain the storefront routes walk and stops
at the first broken link. It returns `200` when the service can serve and
`503` when it cannot.

```json
{
  "ok": false,
  "sha": "<deployed commit>",
  "checks": [
    { "name": "database_url", "status": "pass" },
    { "name": "connection",   "status": "pass" },
    { "name": "schema", "status": "fail",
      "detail": "roam_poc is missing (or the role cannot read) product, storefront_event — apply the pending drizzle migrations to this database" },
    { "name": "catalog", "status": "skip" }
  ],
  "catalog": null
}
```

Read the first non-`pass` check:

| Failing check | Meaning | Action |
| --- | --- | --- |
| `database_url` | `DATABASE_URL` is not set on the deployment | Set it from the hub (`supabase.shared.poc_roles.roam_poc.connection_url`) and redeploy |
| `connection` | Set, but the database refuses or is unreachable | Rotated password, revoked role, dead project, or blocked egress. Check the detail string |
| `connection` — *"pooler does not recognise this tenant"* | The Supabase project in `DATABASE_URL` is gone or paused | Provision a database and issue a new `DATABASE_URL` (§3a) |
| `schema` | Connected, but `roam_poc` relations are missing or unreadable | Apply pending migrations (§3), or re-grant the role |
| `catalog` (`fail`) | Relations exist but the inventory query failed | Read the runtime log line for the SQLSTATE |
| `catalog` (`warn`) with `published_products: 0` | The catalog is genuinely empty | Content problem — publish SKUs. **Not** an outage |
| `catalog` (`warn`) with `published_products > 0` | Products exist but **none is servable** | The supplier chain is broken — see §2a |

`catalog: warn` is intentionally still `ok: true` and `200`. A Railway
healthcheck pointed at `/readyz` must not roll back a healthy deploy just
because no SKU has been published yet. The standing monitor (§5) is what
alerts on it.

A failing check's `detail` is only ever one of our own curated hints or a
pointer to the log — `/readyz` is unauthenticated, so raw driver messages
(which carry the host, the role and fragments of the failing statement) go to
the log instead, as `msg=readiness_check_failed`. If a detail reads
*"see this deployment's log for msg=readiness_check_failed"*, that log line has
the SQLSTATE and the stack.

## 2a. `servable_products` vs `published_products`

`servable_products` is the number that decides whether the shop renders
anything, and `/readyz` computes it with the *same* predicate
`GET /storefront/products` uses (both build it from
`services/api/src/routes/storefront-catalog.ts`). A product only counts when
all of this holds:

- publication state is `draft` or `published` (both are visible pre-launch),
- it has at least one entry in `marketing_destinations`,
- it has an **enabled** `product_supplier_mapping`,
- pointing at a supplier plan that is **`available`** and **`admin_enabled`**,
- belonging to supplier `fastmove`.

So `published_products: 24, servable_products: 0` is not a content problem —
it means a supplier sync dropped the mappings or marked every plan
unavailable, and every `/storefront/products` request is returning `[]` while
the database itself is perfectly healthy. Check, in order:

```sql
-- which of the five conditions is killing it?
SELECT count(*) FILTER (WHERE m.id IS NULL)               AS no_mapping,
       count(*) FILTER (WHERE m.enabled IS FALSE)         AS mapping_disabled,
       count(*) FILTER (WHERE p.available IS FALSE)       AS plan_unavailable,
       count(*) FILTER (WHERE p.admin_enabled IS FALSE)   AS plan_admin_disabled,
       count(*) FILTER (WHERE cardinality(pr.marketing_destinations) = 0) AS no_destinations
FROM roam_poc.product pr
LEFT JOIN roam_poc.product_supplier_mapping m ON m.product_id = pr.id
LEFT JOIN roam_poc.supplier_plan p            ON p.id = m.supplier_plan_id
WHERE pr.publication_state IN ('draft', 'published');
```

## 3a. The database itself is gone

If `connection` fails with *tenant/user … not found*, the pooler is refusing
the whole tenant: `DATABASE_URL` names a Supabase project that no longer
exists. Confirm in one command — a live project always resolves:

```bash
dig +short <project-ref>.supabase.co    # empty output = the project is gone
```

No code change can recover from this. It needs a database provisioned, the
migrations applied (§3b), and a fresh `DATABASE_URL` set on the Railway
service.

**What was actually done on 2026-09-05.** The Supabase project was
unrecoverable (deleted, not paused — no DNS at all, so no data to export), so
production moved to a Railway-managed Postgres in the same project rather
than waiting on a new Supabase project. The catalog was recreated empty; the
old rows are gone.

| | |
|---|---|
| Railway project | `roam-api` — `1fdb4724-ce23-4fca-b15b-5140748ba8f6` |
| Environment | `production` — `5ac4517d-93d4-4ab5-a43e-bb02deb0352b` |
| API service | `roam-api` — `db3e9109-8def-4b81-a948-618b8566572f` |
| Database service | `Postgres` — `557bc61e-1df7-472f-8fde-9dddf8049901` |

`DATABASE_URL` on the API service is a cross-service reference, so a
credential rotation on the database propagates on the next deploy instead of
silently breaking the API:

```
postgresql://${{Postgres.PGUSER}}:${{Postgres.POSTGRES_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.PGDATABASE}}?sslmode=disable&options=--search_path%3Droam_poc%2Cpublic
```

`sslmode=disable` is correct *only* because `RAILWAY_PRIVATE_DOMAIN` is the
project's private network, which never leaves Railway. Anything reaching the
database over the public TCP proxy must use TLS.

To run migrations or psql against it from a laptop you need the public TCP
proxy (`altaria.proxy.rlwy.net`, port `12670`) rather than the private
domain; `railway variables --service Postgres` has the credentials.

Two consequences of no longer being on the shared Supabase project, both
harmless today but worth knowing before someone re-reads
`agent-rules/06-shared-supabase.md` and gets confused:

- There is no `roam_poc_user` / `service_role` / `anon` role. The RLS
  migration (`0001_catalog_rls.sql`) is written with role-existence guards,
  so it applies cleanly and simply creates fewer policies. The API connects
  as `postgres`, which owns the tables and is therefore exempt from RLS.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` on the API service still point at the
  dead project. They are only used to verify JWTs on `/trips/*`, so the
  storefront is unaffected — but consumer trip auth is broken independently
  of this incident and needs its own fix.

## 3b. Apply pending migrations

`schema: fail` means the migrations never ran against this database. The
Railway start command (`services/api/Procfile`) only runs
`node dist/index.js` — **nothing in the deploy applies migrations.** They are
applied deliberately, by a human with the production connection string:

```bash
cd services/api
DATABASE_URL='<roam_poc_user connection url from the hub>' pnpm db:migrate
```

Then re-probe `/readyz` and confirm every check is `pass` (or `catalog: warn`
if the catalog is genuinely empty).

> Migrations are verified to apply cleanly onto a fresh Postgres from
> `0000` through the latest tag — that path is exercised locally, so a failure
> here is about the target database, not about the migration files.

## 4. Read the runtime log

Every unhandled route error now emits exactly one JSON line, which is
greppable in the Railway log viewer:

```json
{
  "level": "error",
  "msg": "unhandled_request_error",
  "request_id": "f7fb4b32-…",
  "method": "GET",
  "path": "/storefront/events",
  "name": "PostgresError",
  "message": "relation \"roam_poc.storefront_event\" does not exist",
  "code": "42P01",
  "hint": "relation does not exist — the roam_poc migrations are probably not applied to this database"
}
```

`code` is the Postgres SQLSTATE (or the Node syscall code); `hint` translates
the ones we recognise. The 500 returned to the caller carries only
`request_id` — these routes are unauthenticated, so the diagnosis stays in the
log. Grep the log for that id to join the two.

If a caller sends `x-request-id`, it is reused, so an id set at the Vercel
proxy hop follows the request into the API log.

## 5. Standing monitoring

Monitoring is committed, not aspirational:
`.github/workflows/storefront-monitor.yml` runs
`pnpm --filter @roam/api monitor:storefront` every 15 minutes against the
production origin and files a GitHub issue labelled `storefront-outage` when
the storefront stops serving. A subsequent green run closes that issue.

Repeat non-green runs never open a second issue, and they only comment when
the *state changes* — the alert body carries a hidden
`<!-- storefront-monitor-state: ... -->` marker and the next run compares
against it. This matters because a storefront can sit in one non-green state
for days: after the 2026-09-05 rebuild the catalog was empty, which is a real
`DEGRADED` worth an open issue but not worth 96 comments a day. You get one
comment when it starts, one when it changes, one when it recovers.

The probe checks, in order (`services/api/src/monitor/storefront-probe.ts`):

| Check | Passes when | Why it is in the set |
| --- | --- | --- |
| `liveness` | `/healthz` is 200 **and** reports a `sha` | `sha: null` means an alert cannot say which build is live |
| `readiness` | `/readyz` is 200 with `ok: true` | The dependency chain — this is the check that catches a 2026-09 |
| `events` | `/storefront/events` is 200 with an `events` array | One of the routes that was 500ing |
| `region_stats` | `/storefront/region-stats` is 200 with a `stats` array | The other one |
| `catalog` | `/storefront/products?destinations=JP` returns ≥1 product | A `200 []` is the silent-empty-catalog failure (§2a) |
| `paramless_products_contract` | `/storefront/products` (no query) is **400** | If the old `200 {"products":[]}` ever returns, the monitor goes blind again |

Exit codes are the alerting contract: `0` serving, `1` hard failure (an
endpoint is down or 5xx), `2` degraded (serving, but a warning needs a human —
empty catalog, or a build that cannot name its commit), `3` no base URL
configured.

Note that an empty catalog holds the monitor at `2`, so the alert issue stays
open until products are published. That is deliberate: an empty shop is a
customer-facing problem even though every endpoint answers 200.

Run it by hand during an incident — it needs nothing but network access:

```bash
pnpm --filter @roam/api monitor:storefront -- \
  --base-url "$ROAM_API_URL" --destination JP --out report.json
```

**Configuration this needs:**

- The workflow defaults to the production Railway origin. To probe somewhere
  else, set the repository variable `ROAM_API_URL` (Settings → Secrets and
  variables → Actions → Variables), or use `workflow_dispatch` with a
  `base_url` input.
- Nothing. The deployment sha resolves itself on Railway (§6). `liveness`
  reports `warn` only if a build somehow answers `/healthz` without a sha,
  which is deliberate: an anonymous build is exactly the position the 2026-09
  triage was in.
- GitHub issue alerting needs no secret beyond the built-in `GITHUB_TOKEN`. If
  you want to be paged rather than emailed, subscribe a pager to the
  `storefront-outage` label; the issue body carries the full probe report.

Scheduled GitHub Actions runs are delayed under load, so treat this as
detection within the hour, not a second-by-second SLA. If that is not good
enough, point an external uptime monitor at `GET $ROAM_API_URL/readyz` and
alert on any non-`200` — the endpoint is designed for exactly that, and the two
mechanisms do not conflict.

Railway's own healthcheck should stay on `/healthz`: it gates whether a deploy
is allowed to replace the previous one, and a database problem must not block
shipping the fix for that database problem.

## 6. Which build is live

`/healthz` and `/readyz` both report `sha`. It resolves, in order:

1. `GIT_SHA`, if set to a non-blank value — for hosts that are not Railway.
2. `RAILWAY_GIT_COMMIT_SHA`, which Railway injects into the container of every
   git-sourced deployment.

Nothing needs to be configured on Railway. **Do not** set
`GIT_SHA=${{RAILWAY_GIT_COMMIT_SHA}}`: Railway renders deployment-scoped git
variables to an empty string inside a variable reference, so that setting
reports `sha: ""` — which looks configured, identifies nothing, and shadows
the value that does work. This was tried on 2026-09-05 and is why the
fallback is in code:

```
$ railway ssh --service roam-api "printenv | grep -E '^(GIT_SHA|RAILWAY_GIT_COMMIT_SHA)'"
RAILWAY_GIT_COMMIT_SHA=2c46c487d4b6aa30fa0b728a8c846cbece89cad3
GIT_SHA=
```

`sha: null` means the build genuinely cannot identify itself; the monitor
reports `liveness: warn` for it.
