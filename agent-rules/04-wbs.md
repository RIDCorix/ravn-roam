# Stage-04 WBS deliverable checklist

LOAD-BEARING — silent skip = bug.

Stage-04 is **not** "open Linear sub-issues for each feature". The deliverable is a six-item cascade that turns a flat feature list into a structured Linear plan. Each item below MUST end up as `done`, `skipped: <one-line reason>`, or `blocked: <what's missing>`. **Stopping after item 1 (a flat sub-issue list) is a defect** — that's exactly how the first run on ACME-4 dropped the module / project / dependency layer.

| # | Item | Where it lives | Default tooling |
|---|---|---|---|
| 1 | **Feature list** seeded into the WBS Sheet | Sheet rows under `phase = 訪談期`, one per feature (`F1`, `F2`, …) with `est_hours` and `depends_on` populated | Pull from stage-03 output / interview notes; never invent features. Empty `depends_on` is fine but must be intentional. |
| 2 | **Module breakdown** — group features into modules by **dev dependency**, not by UI surface | Sheet `module` column on every feature row | Cluster features whose `depends_on` graph forms a strongly-connected-ish chunk. Default sizing: **3–8 features per module, 0.5–2 weeks of `est_hours` each (at 6h/working-day capacity)**. If a candidate cluster blows past 8 features or 2 weeks → split it. If it's <3 features or <0.5 weeks → merge into adjacent upstream cluster. Don't ship a single mega-module just because everything "kind of depends on auth". |
| 3 | **Linear project per module** with start / target dates | One Linear project per `module` value, under the per-client team's `04-Development` umbrella | `mcp__linear__save_project`. `startDate` / `targetDate` derived from module's feature `est_hours` summed at 6h/working-day capacity, anchored to previous-module dependency's `targetDate` (or stage-04 kickoff date for first module). |
| 4 | **Module-to-module dependency** wired in Linear | Linear project relations between projects from item 3 | `mcp__linear__set_issue_relation` doesn't apply to projects — use the project-level dependency relation. The module dependency graph is the transitive closure of feature `depends_on` edges in the Sheet, collapsed by `module`. |
| 5 | **Linear issue per feature** inside its module's project, with start / due dates | One Linear issue per feature row, child of module project from item 3 | `mcp__linear__save_issue` with `projectId = <module project>`, `title = <feature name>`, `startedAt` / `dueDate` from feature's slot in module sequence. **Do NOT create flat sub-issues on the stage-04 issue itself** — that's the failure mode this checklist exists to prevent. |
| 6 | **Write back IDs** to the Sheet | Sheet `notes` column on each module-row aggregate and each feature row | Module project ID and feature issue ID, written back so next WBS pass is idempotent (re-running stage-04 must not duplicate projects / issues). Also mirror module project IDs into `.ravn/project.yaml` under `linear.modules.<module_slug>.project_id`. |

Format for the stage-04 issue's `## Conclusion`:

```
- [x] Features — done · 8 features (F1–F8) seeded into WBS Sheet
- [x] Modules — done · 3 modules: `auth` (F1, F2), `core` (F3, F4, F5), `dashboard` (F6, F7, F8)
- [x] Module projects — done · ACME-AUTH, ACME-CORE, ACME-DASH (URLs in Sheet `notes`)
- [x] Module deps — done · auth → core → dashboard (project relations on Linear)
- [x] Feature issues — done · 8 issues created under their module projects, dates set
- [x] Write-back — done · IDs written to Sheet `notes` + `.ravn/project.yaml` `linear.modules`
```

Rules of thumb:

- **A flat list of sub-issues on the stage-04 ticket is NOT item 5.** Item 5 means each feature issue lives inside its module's project. If you find yourself writing `parentId = <stage-04 issue>` on feature issues, you've skipped items 2–4.
- **Modules are dev-dependency clusters, not UI sections.** "Login page" and "Login API" belong in the same module even if they're on different surfaces. "Login API" and "Billing dashboard UI" belong in different modules even if they share a layout shell.
- **One module = one Linear project. Always.** Don't collapse two modules into one project to "keep things simple" — the project-to-project dependency is the load-bearing artifact for sequencing visibility.
- **Idempotency matters.** Item 6's write-back is what makes the stage rerunnable. If a feature already has an issue ID in Sheet `notes`, update that issue instead of creating a new one. Same for module project IDs.
- Use the Linear `wbs-bootstrap` issue template — don't free-form the description.
