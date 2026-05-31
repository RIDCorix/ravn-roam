# Agent Rules

These files are shared RAVN operating rules. They are conditional policy, not
all globally applicable to Roam.

For this repository, `AGENTS.md` and `docs/INFRA.md` are the source of truth
when they differ from older scaffold guidance:

- Roam is main-only. The older `ravn/integration` overlay does not apply.
- Railway is deferred unless a backend service or worker genuinely needs it.
- Production deploy branch is `main`.
- Supabase uses the shared `ravn-shared` project with the `roam_poc` schema.

When following one of the numbered rules, first check whether `AGENTS.md` or
`docs/INFRA.md` explicitly overrides it for Roam.
