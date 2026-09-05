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
- `GIT_SHA` is not set on the Railway service, so `/healthz` and `/readyz`
  both report `"sha": null` and you cannot tell which build is live.

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
| `catalog` (`warn`) | Everything works, the catalog is genuinely empty | Content problem — publish SKUs. **Not** an outage |

`catalog: warn` is intentionally still `ok: true` and `200`. A Railway
healthcheck pointed at `/readyz` must not roll back a healthy deploy just
because no SKU has been published yet. Alert on the `catalog` counters from an
external monitor instead.

## 3a. The database itself is gone

If `connection` fails with *tenant/user … not found*, the pooler is refusing
the whole tenant: `DATABASE_URL` names a Supabase project that no longer
exists. Confirm in one command — a live project always resolves:

```bash
dig +short <project-ref>.supabase.co    # empty output = the project is gone
```

No code change can recover from this. It needs a database provisioned per
`agent-rules/06-shared-supabase.md`, the `roam_poc` schema and role created,
the migrations applied (§3b), and a fresh `DATABASE_URL` set on the Railway
service.

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

Point an uptime monitor at `GET $ROAM_API_URL/readyz` and alert on any
non-`200`. That alone would have caught this incident at minute one, because
`/readyz` went `503` the moment the schema check failed while `/healthz`
stayed `200`.

To catch an unexpectedly empty catalog, alert separately on
`.catalog.published_products == 0` from the same response — this is a warning,
not a 503, by design (see §2).

Set `GIT_SHA` on the Railway service (Railway exposes the commit as
`RAILWAY_GIT_COMMIT_SHA`, so `GIT_SHA=${{RAILWAY_GIT_COMMIT_SHA}}` is enough).
Without it both endpoints report `"sha": null` and an alert cannot tell you
which build is live — which is exactly the position the 2026-09 triage was in.

Railway's own healthcheck should stay on `/healthz`: it gates whether a deploy
is allowed to replace the previous one, and a database problem must not block
shipping the fix for that database problem.
