# eSIM Platform — Program Operating Plan (v0.1 DRAFT)

> ROA-80 first deliverable. **Operating companion** to `docs/program/master-plan-v0.md` (ROA-63, PR #7).
> v0.md = WHAT the program is (phases, milestones, decisions, risks). THIS file = HOW it runs.
> Status: DRAFT — pending Ray's review on ROA-80.
> Issue: ROA-80 · Linear project: `esim-platform-master-plan`

## 0. Why this file exists, distinct from `master-plan-v0.md`

ROA-63 already produced the program master plan: phase map (1–6), milestone dates (M1–M6), cross-cutting decisions (C1–C10), risk catalog (R1–R6), and cadence skeleton (v0.md §6). ROA-80 finishes the picture by **codifying the procedures** that consume those artifacts:

- A standardized **gate review** so M1–M6 reviews don't drift in shape week-to-week.
- An explicit **single-view-of-readiness** surface so Ray can answer "are we on track?" without reading 6 phase issues.
- Governance over the **C-series decisions** (closure flow, ownership reassignment, ADR write-back).
- Governance over the **R-series risks** (escalation, mitigation triage, retirement).
- The **operating cadence** that complements v0.md §6 — what ravn-agent actually does day-to-day vs week-to-week.

If v0.md and this file disagree, v0.md wins on **content** (phases, dates, decisions, risks) and this file wins on **procedure** (how reviews run, how decisions close, how risks are triaged).

## 1. Roles

| Role | Responsibility |
|---|---|
| Ray (`@ridcorix`) | Program owner; ratifies every milestone gate; final authority on C-series decisions and R-series risk acceptance |
| ravn-agent | Maintains both docs; runs cadence; drafts gate review packs; surfaces blockers; never closes a C-decision or accepts an R-risk on Ray's behalf |
| Phase leads (currently: ravn-agent on every phase) | Run phase-internal work; produce phase freeze artifact at each Mn |
| External collaborators (planned) | Loop-in per v0.md §10 parallel tracks; currently zero |

## 2. Milestone gate review — the standard operation

All six gates (M1–M6, dated per v0.md §5) use the same operation. Per-gate variation is encoded only in §2.6 (entry conditions).

### 2.1 Lifecycle of a gate

```
Backlog
  │  (gate issue seeded at program start, blocked-by previous Mn)
  ▼
In Progress
  │  (previous gate done OR direct-start; phase work running)
  ▼
In Review                ← ravn-agent posts review pack + @-mentions Ray
  │
  ▼
Ray decides — three outcomes
  ├─ ADVANCE      → Done; next Mn unblocked; ravn-agent seeds Mn+1 review
  ├─ RE-LOOP      → back to In Progress with explicit gap list as comment
  └─ SCOPE-PIVOT  → v0.md §5 (phase map / dates) and §1 (dependencies) re-edited; gate re-issued
```

`In Progress → In Review` is fired by ravn-agent, NOT by Ray. The trigger is §2.6 entry condition fully checked off.

### 2.2 Review pack — required format

ravn-agent posts this as a Linear comment on the gate issue when entering In Review:

```markdown
# M<N> review pack — YYYY-MM-DD

## Entry condition status
- [x] <criterion 1 — link to merged PR / doc / artifact>
- [x] <criterion 2 — link to merged PR / doc / artifact>

## Frozen interfaces (handoff to next phase)
- <concrete shape>: <link>
- <concrete shape>: <link>

## C-series decisions closed in this phase
- C<n> — <one-line outcome>

## R-series risks newly raised
- R<n> — <one-line summary, severity>

## Open items deferred to next phase
- <one-liner — with rationale>

## Recommendation
ADVANCE / RE-LOOP / SCOPE-PIVOT — <one-line reason>
```

The "frozen interfaces" section IS the handoff doc referenced in v0.md §5. Co-locating it in the review pack means no second artifact to drift.

### 2.3 Decision flow

Ray reviews the pack and replies on the same comment thread with one of:

- **`ADVANCE`** (English keyword, case-insensitive; or `通過`) — gate passes. ravn-agent then:
  1. Transitions gate issue → `Done`
  2. Removes blocked-by from Mn+1 gate issue
  3. Drafts Mn+1's entry condition checklist on its description
  4. Bumps `master-plan-v0.md` §9 snapshot
- **`RE-LOOP`** with bullet list of gaps — ravn-agent transitions gate issue back to `In Progress`, copies Ray's gap list onto description as a `## Loop-back` block, resumes work.
- **`SCOPE-PIVOT`** with rationale — gate AND v0.md §5 are at stake. ravn-agent opens a separate ROA-80 child issue titled `Pivot M<N>: <one-liner>` to coordinate the re-baseline; gate issue stays `In Review` until pivot lands.

Anything else from Ray is feedback — ravn-agent reads it, responds, waits.

### 2.4 Per-gate review pack co-location

Each gate's full review pack content lives on the gate's Linear issue comment thread. The READ-ONLY mirror in this repo is `docs/program/gate-reviews/M<N>-YYYY-MM-DD.md`, written by ravn-agent at the same time as posting the Linear comment. The mirror is for diff-tracking the decision; Linear is for Ray's response loop.

### 2.5 No standing review meeting

Reviews are event-driven. v0.md §6 already states this; this section is here to make the absence explicit so we don't quietly add a recurring slot.

### 2.6 Entry conditions — per-gate concrete list

This is the working source of truth for what each Mn must prove. Drawn from v0.md §2 (master checklist) and §5 (gate condition column); flattened here so ravn-agent has a single read for the review pack.

#### M1 — Phase 1 freeze (target 2026-05-20)
- [ ] Glossary merged on `main` (ROA-41)
- [ ] Actor catalog merged on `main` (ROA-34)
- [ ] Domain model + ER merged on `main` (ROA-36) — extends ROA-20
- [ ] Lifecycle state diagrams merged on `main` (ROA-37)
- [ ] E2E sequence diagram merged on `main` (ROA-40)
- [ ] Decisions D1–D10 closed (ROA-43 tracker → 10 sub-issues each with `## Conclusion`)
- [ ] Roles + ownership matrix merged (ROA-21, PR #5)
- [ ] Business rules / open questions merged (ROA-23, PR #4)
- [ ] Assumption registry seeded (ROA-48)
- [ ] Risk catalog seeded (ROA-45)

#### M2 — Phase 2 catalog interface freeze (target 2026-05-28)
- [ ] Supplier integration contract merged (ROA-64, PR #10) `[loadbearing → Phase 4]`
- [ ] Product↔SupplierPlan mapping rule merged `[loadbearing → Phase 4]`
- [ ] Packaged product field policy merged (ROA-65)
- [ ] Publication / availability state machine merged
- [ ] Catalog admin workflows merged (ROA-66)

#### M3 — Phase 3 commercial model freeze (target 2026-06-05)
- [ ] Attribution precedence + window + immutability merged (ROA-39 engine, ROA-30 schema) `[loadbearing → Phase 6]`
- [ ] Discount engine merged (ROA-38, ROA-29)
- [ ] Pricing envelope + override hierarchy merged (ROA-35, ROA-28)
- [ ] Vendor lifecycle + cascade merged (ROA-67 PR #8, ROA-33)
- [ ] Discount cost absorption decided (C2 / ROA-26)
- [ ] Pricing cascade UX decided (C3 / ROA-25)
- [ ] Attribution window length decided (C1 / ROA-24)
- [ ] Tier-1 / tier-2 invitation flows merged (ROA-42, ROA-44)

#### M4 — Phase 4 fulfillment contract freeze (target 2026-06-13)
- [ ] Order state machine final (13 states) merged `[loadbearing → Phase 5]`
- [ ] Fulfillment payload shape merged `[loadbearing → Phase 5]`
- [ ] Supplier plan selection algorithm merged
- [ ] Failure / retry / fallback catalog merged
- [ ] Refund / replacement / cancellation flow merged `[loadbearing → Phase 6]`
- [ ] C5 (refund policy) closed — **currently MISSING OWNER per v0.md §3**
- [ ] C10 (refund → commission reversal) closed — **currently MISSING OWNER per v0.md §3**

#### M5 — Phase 5 UX freeze (target 2026-06-21)
- [ ] Storefront + PDP + checkout + order lookup merged
- [ ] Redemption flow merged
- [ ] Install guidance UX merged
- [ ] C7 (account-lite vs guest) closed — preferably before 2026-05-29 to avoid Phase 3 rework
- [ ] C9 (multi-market / multi-locale launch scope) closed
- [ ] Notification touchpoints + support entry points merged

#### M6 — Phase 6 settlement freeze (target 2026-06-29)
- [ ] C6 (commission timing) closed
- [ ] Commission base composition merged
- [ ] Ledger entry shape + reversal rules merged
- [ ] Payout calculation + reconciliation merged
- [ ] Admin + vendor reporting surface merged
- [ ] Support / override tools merged
- [ ] Launch-readiness checklist closed

## 3. Cross-cutting decisions (C-series) governance

v0.md §3 defines the C1–C10 table. This section codifies how a decision **closes**.

### 3.1 Closure protocol

A C-decision closes when ALL of the following hold:

1. **ADR or `## Conclusion` block** is merged on the tracking issue's PR — never verbal-only, never Linear-comment-only.
2. **v0.md §3 table row** is updated: `Tracked at` field reflects the closing artifact; status flips `OPEN` → `DECIDED`.
3. **Linked phase specs** that consume the decision cite the closure artifact.

### 3.2 MISSING OWNER triage

v0.md §3 flags **C5 (refund policy)** and **C10 (refund → commission reversal)** as MISSING OWNER. These are M4-blocking. Triage protocol:

1. ravn-agent surfaces in next weekly tick comment on ROA-80, with proposed owner (default: Ray; alternative: assign to specific phase issue).
2. If Ray doesn't assign by 2026-05-20 (M1 review), escalate as a §4 blocker.
3. Track in `docs/program/decision-log.md` (created in §5) with `OWNER: TBD` so it's diff-visible.

### 3.3 Re-opening a closed decision

A decision can be re-opened by Ray's explicit comment OR by ravn-agent surfacing new evidence that invalidates the closure. Re-open = status `DECIDED` → `RE-OPEN`, with the trigger evidence cited. Re-opens cascade: every spec citing the closure artifact gets a callout in the next weekly tick.

## 4. Risks (R-series) governance

v0.md §7 lists R1–R6. This section is the run-time on top.

### 4.1 Status taxonomy

`OPEN` / `MITIGATING` / `ACCEPTED` / `CLOSED`. Maintained in `docs/program/risk-register.md` (created in §5) as the authoritative table; v0.md §7 stays as the snapshot at last bump.

### 4.2 Escalation rule

A risk escalates from `OPEN` → `MITIGATING` when severity reaches `High` AND the trigger condition fires within 14 days. ravn-agent surfaces the escalation in the next weekly tick AND immediately opens a mitigation Linear issue.

R1 (schedule reality) and R2 (single-person bottleneck) are already `High` per v0.md §7. Their trigger conditions:
- **R1 trigger**: any phase Mn slips >2 days OR parallel `產品製作（後台、eSIM 功能）` (6/15) ships against an unfrozen spec.
- **R2 trigger**: any C-decision sits unanswered >5 days OR any phase has zero issues moving for 3 consecutive days.

ravn-agent checks these triggers in every weekly tick.

### 4.3 Acceptance protocol

A risk goes `ACCEPTED` only by Ray's explicit comment on the risk register issue. ravn-agent cannot accept on Ray's behalf.

## 5. Coordination artifacts to create (after Ray ratifies this plan)

The C-table (v0.md §3), R-table (v0.md §7), and decisions tracker currently live inline in v0.md. As they grow, they need to split out. Pending Ray's go, ravn-agent will create:

| Artifact | Where | When |
|---|---|---|
| `docs/program/decision-log.md` | This repo | When 5+ C-decisions are in flight simultaneously, OR M2 freeze (whichever first) |
| `docs/program/risk-register.md` | This repo | Same trigger |
| `docs/program/readiness.md` | This repo | After M1 review (so the first row has real data, not template noise) |
| `docs/program/gate-reviews/` directory | This repo | First entry at M1 review |
| Linear issue **Roam decision log** | `esim-platform-master-plan` project | Mirrors `decision-log.md`; lifecycle = long-lived |
| Linear issue **Roam risk register** | Same | Mirrors `risk-register.md`; long-lived |
| Linear view **Roam Readiness** | Workspace view | After v0.md §5 gate issues are individually created on Linear (see §6 below) |

**Not yet created** because v0.md inline tables are still fit-for-purpose and Ray hasn't ratified the split.

## 6. Single view of readiness

The Linear-native surface:

- **Linear custom view** named **Roam Readiness**
- Filter: `project:esim-platform-master-plan AND label:milestone-gate`
- Sort: ascending by target date (M1 → M6)

For this view to work, each Mn needs a dedicated Linear issue with the `milestone-gate` label. **These don't yet exist** — v0.md §5 references M1–M6 by name but they aren't materialized as individual issues yet. Action item: create M1–M6 gate issues under `esim-platform-master-plan` project (one of the coordination issues in §5).

The repo-side mirror is `docs/program/readiness.md`, regenerated by ravn-agent on demand. Format:

```markdown
| Gate | Date | Status | Entry conditions met | Outstanding |
|---|---|---|---|---|
| M1  | 2026-05-20 | In Progress | 6 / 10 | Glossary, lifecycle, e2e, D-decisions |
| M2  | 2026-05-28 | Backlog     | 0 / 5  | (M1 not yet done) |
| ... |            |             |        | |
```

Ray gets a single Linear comment on ROA-80 each week containing the regenerated table (see §7).

## 7. Operating cadence — what ravn-agent actually does

Extends v0.md §6 with the procedural details.

| Cadence | Trigger | Action |
|---|---|---|
| **Daily** | Program scan (async, no comment if nothing material) | Check: any phase issue went red? Any C-decision >24h unanswered? Any R-trigger fired? Comment on ROA-80 ONLY if yes. |
| **Mid-week (Thursday)** | Phase mid-check (v0.md §6) | For currently-active phase only: post one Linear comment — "can we Friday freeze? evidence: X / Y / Z. If no, what's missing." |
| **Weekly (Monday)** | Weekly tick | Comment on ROA-80 with: (a) readiness table delta vs last week, (b) any new R-triggers, (c) any unresolved C-decisions aging >5 days, (d) any MISSING OWNER items still missing. Skip if zero deltas across all four. |
| **Per gate review** | Entry condition fully ticked | Post §2.2 review pack to gate issue; transition to In Review; @-mention Ray. |
| **Per Ray decision on a gate** | `ADVANCE` / `RE-LOOP` / `SCOPE-PIVOT` | Execute §2.3 follow-through. |
| **Per C-decision closure** | ADR / Conclusion merged | Update v0.md §3 row; update decision-log.md if it exists; cite from consuming specs. |
| **Per R-risk transition** | Status change | Update v0.md §7 row OR risk-register.md if split out; comment on register Linear issue. |
| **Per v0.md bump** | Any gate freeze OR any C-decision closure | Bump v0.md footer version (v0 → v0.1 → v0.2 …); comment summary of diff on ROA-63 with `@ridcorix`. |

## 8. Governance of THIS file

- **Trigger to bump**: any change to §2 (review procedure), §3 (decision protocol), §4 (risk protocol), §6 (readiness surface), §7 (cadence). Editorial fixes don't bump.
- **Procedure**: PR against `main` from a branch named `ROA-80-...`; comment summary on ROA-80 with `@ridcorix` and the diff link.
- **Versioning**: footer `vN.M · YYYY-MM-DD`. Major bump only on substantive procedural change (e.g. adding a SCOPE-PIVOT outcome to §2.3).

## 9. Open items for Ray (this PR)

1. **Ratify v0.1**: does §2.6 (per-gate entry conditions) match your mental model, or do you want to add / remove any?
2. **Decision closure protocol** (§3.1): do you want C-decisions to require an ADR file (e.g. `docs/program/adr/`) or is an in-issue `## Conclusion` block sufficient?
3. **C5 / C10 ownership** (§3.2): assign now, or wait until M2/M4 approach makes it forced? My recommendation is to assign before M1 review (2026-05-20) so the M4 entry conditions don't surface as blockers later.
4. **Coordination artifact split timing** (§5): default trigger is "5+ in-flight C-decisions or M2 freeze". If you'd rather split immediately at M1, say so and I'll seed the four repo files now.
5. **Gate issue materialization** (§6): I'd like to create six Linear issues (M1–M6 gate review) under `esim-platform-master-plan` after this PR merges, each with the `milestone-gate` label. OK to proceed?
6. **Weekly tick day**: Monday. Confirm or shift.

---

*Version: v0.1 · 2026-05-13 · Author: ravn-agent (ROA-80)*
*Companion to: `docs/program/master-plan-v0.md` (ROA-63)*
