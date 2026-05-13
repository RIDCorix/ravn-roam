# Default infrastructure stack

Every private-client project defaults to this stack. Don't ask — apply it. Override only if the client has stated existing infra.

| Layer | Provider | When |
|---|---|---|
| Frontend | **Vercel** | Always (covers preview URLs, edge, CDN; free on Ray's hobby plan) |
| Backend | **Railway** | When the project needs a real backend service. Default over Fly / Render / VPS. |
| Database | **Supabase** (shared project, `ravn-shared`) | Default — Postgres + Auth + Storage + Realtime. **From day 1, including PoC.** No SQLite hedge. **One project for ALL RAVN-managed PoCs**, isolated by Postgres schema (`<client_slug>_<env>`, e.g. `acme_poc`, `acme_dev`). See [`06-shared-supabase.md`](./06-shared-supabase.md). |
| Non-PG DB | **Railway** managed | Only when project genuinely needs Redis / Mongo / queue / etc. |
| Framework | **any** | Stack is framework-agnostic on both sides. Don't push framework choices on clients. |

Cost guidance for stage-01 / stage-02 docs: **Vercel hobby (free) + Railway (~$5/mo per service) + Supabase free tier (500MB / 50k MAU)** — most PoCs run < $10/mo all-in.

Alternative paths (Fly.io, Render, AWS, GCP, self-hosted VPS, Neon, RDS, etc.) are only proposed if the client explicitly asks. Don't preemptively offer them.
