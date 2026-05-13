# eSIM Platform — Program Master Plan (v0)

> ROA-63 first deliverable. Owns the cross-phase view that no individual phase project carries.
> Source of truth for sequencing, dependencies, cross-cutting decisions, blockers, milestones, and cadence.
> Update this file every time a phase freezes or a cross-cutting decision lands; bump the version footer.

## 0. Scope confirmation

This plan covers the six `eSIM Platform — Phase N` projects under the *eSIM Platform Buildout* initiative on Linear workspace `ravn-roam`:

| Phase | Linear project | Window | Status |
|---|---|---|---|
| 1 | Product spec & domain model | 2026-05-13 → 2026-05-20 | In Progress — 4 spec drafts on PRs, 9 follow-ups in backlog |
| 2 | Supplier catalog & packaged products | 2026-05-21 → 2026-05-28 | In Progress — 3 spec issues started, 9 follow-ups designed |
| 3 | Vendor hierarchy, pricing & promotions | 2026-05-29 → 2026-06-05 | In Progress — spec v0.1 drafted, 16 follow-ups laid out |
| 4 | Ordering, fulfillment & inventory | 2026-06-06 → 2026-06-13 | Kickoff doc drafted, spec **cannot finalize** until Phase 2 |
| 5 | Customer storefront & redemption | 2026-06-14 → 2026-06-21 | Kickoff scope draft only, blocked by Phase 3 + Phase 4 |
| 6 | Commissions, settlement & operations | 2026-06-22 → 2026-06-29 | Kickoff only, blocked by Phase 3 + Phase 4 |

Out of scope for this plan, but tracked separately (see §10 Parallel tracks):
品牌建立 · 官方帳號 · 產品製作（landing page / 後台、eSIM 功能 / Line 串接）· 網紅合作.

## 1. Cross-phase dependency map

```
Phase 1 (foundations: domain, actors, lifecycle, e2e flow, glossary, decisions)
   ├─→ Phase 2  (entities + glossary)
   ├─→ Phase 3  (actors + permissions)
   ├─→ Phase 4  (lifecycle states)
   ├─→ Phase 5  (e2e flow)
   └─→ Phase 6  (e2e flow + roles)

Phase 2 (supplier integration + product packaging + Product↔SupplierPlan mapping)
   ├─→ Phase 3  (vendors package products)
   ├─→ Phase 4  (auto-order: order → supplier plan selection)     ← HARD: Phase 4 spec freeze blocked here
   └─→ Phase 5  (PDP + catalog rendering)

Phase 3 (attribution + pricing envelope + discount cost absorption + vendor cascade)
   ├─→ Phase 4  (price stamp + discount usage at order create)
   ├─→ Phase 5  (price display, discount UX, referral surface)
   └─→ Phase 6  (commission base = attribution + cost absorption stamps)  ← HARD

Phase 4 (order state machine + fulfillment payload + refund/replace flow + manual ops)
   ├─→ Phase 5  (order confirmation, redemption, support entry, install guidance)  ← HARD
   └─→ Phase 6  (commission reversal on refund / replacement)               ← HARD

Phase 5 (customer-facing UX)          — sink, no downstream phase
Phase 6 (settlement + ops + launch)   — sink, no downstream phase
```

The hard arrows are the load-bearing handoff contracts. A miss there cascades; a miss on a soft arrow can usually be backfilled.

## 2. Master checklist — what must be defined before any implementation starts

A spec is not "done" until everything in its column is signed off. Items marked `[loadbearing]` block more than one downstream phase.

### Phase 1
- [ ] Glossary `docs/glossary.md` (ROA-41) `[loadbearing]`
- [ ] Actor catalog `docs/spec/actors.md` (ROA-34) `[loadbearing]`
- [ ] Domain model + ER `docs/spec/domain-model.md` (ROA-36) `[loadbearing]`
- [ ] Lifecycle state diagrams (ROA-37) `[loadbearing]` — Product, Order, UpstreamOrder, EsimProfile, DiscountCode, Vendor
- [ ] End-to-end sequence diagram `docs/spec/e2e-flow.md` (ROA-40) `[loadbearing]`
- [ ] Open decisions D1–D10 closed (ROA-43 tracker → 10 sub-issues) `[loadbearing]`
- [ ] Assumption registry + refutation triggers (ROA-48)
- [ ] Risk catalog (ROA-45)
- [ ] Roles + ownership matrix (ROA-21 PR #5)
- [ ] Core domain entities (ROA-20 PR #6)
- [ ] E2E order/redemption lifecycle (ROA-22)
- [ ] Business rules / open questions (ROA-23 PR #4)

### Phase 2
- [ ] Supplier integration contract (ROA-64) `[loadbearing → Phase 4]`
- [ ] Product↔SupplierPlan mapping rule `[loadbearing → Phase 4]`
- [ ] Packaged product creation: editable vs locked fields (ROA-65)
- [ ] Publication / availability state machine
- [ ] Catalog admin workflows + guardrails (ROA-66)

### Phase 3
- [ ] Vendor lifecycle + cascade (ROA-67, engine ROA-33)
- [ ] Pricing envelope + override hierarchy (engine ROA-35, schema ROA-28)
- [ ] Discount validation + stacking + scope + floor protection (engine ROA-38, schema ROA-29)
- [ ] Attribution precedence + window + immutability (engine ROA-39, schema ROA-30) `[loadbearing → Phase 6]`
- [ ] Discount cost absorption default (ROA-26 research → §10 Q2) `[loadbearing → Phase 6]`
- [ ] Pricing cascade UX decision (ROA-25 research → §10 Q3)
- [ ] Attribution window length (ROA-24 research → §10 Q4)
- [ ] Tier-1 / tier-2 invitation flows (ROA-42, ROA-44)
- [ ] Vendor portal + admin console UI (ROA-49, ROA-46)
- [ ] Edge-case acceptance tests (ROA-31)

### Phase 4 *(spec only — not yet broken into follow-ups)*
- [ ] Order state machine final (13 states from kickoff doc) `[loadbearing → Phase 5]`
- [ ] Fulfillment payload shape: ICCID / QR / activation code / install instructions / delivery status `[loadbearing → Phase 5]`
- [ ] Supplier plan selection algorithm (relies on Phase 2 mapping)
- [ ] Failure / retry / fallback / manual intervention catalog
- [ ] Refund / replacement / cancellation flow `[loadbearing → Phase 6]`
- [ ] Inventory / allocation rules where supplier behavior varies

### Phase 5 *(spec only — not yet broken into follow-ups)*
- [ ] Storefront + PDP + checkout + order lookup
- [ ] Redemption flow (link / code / serial)
- [ ] Install guidance UX
- [ ] Account-lite vs guest decision (touches Phase 3 attribution — see C7)
- [ ] Notification touchpoints + locales
- [ ] Support entry points

### Phase 6 *(spec only — not yet broken into follow-ups)*
- [ ] Commission timing (sale / activation / expiry) — see C6
- [ ] Commission base composition (attribution + cost absorption stamps)
- [ ] Ledger entry shape + reversal rules
- [ ] Payout calculation + reconciliation
- [ ] Admin + vendor reporting surface
- [ ] Support / override tools
- [ ] Launch-readiness gates

### Cross-cutting (no single phase owner — easy to miss)
- [ ] Currency / FX policy
- [ ] Tax handling per supported market
- [ ] Refund policy text (legal-facing) — see C5
- [ ] Supported locales / multilingual scope — see C9
- [ ] Brand voice / tone alignment with `品牌建立` project
- [ ] SLA expectations (fulfillment latency, support response)
- [ ] Manual ops capacity assumption — affects automation depth in Phase 4

## 3. Cross-cutting critical decisions

Decisions Ray owns. Each touches ≥2 phases. The "currently tracked at" column says where a decision is actually being driven — items marked `MISSING OWNER` need to be assigned now.

| # | Decision | Touches | Tracked at |
|---|---|---|---|
| C1 | Attribution window length + decay model | 3, 5, 6 | ROA-24 (research) |
| C2 | Discount cost absorption default (platform vs seller) | 3, 6 | ROA-26 (research) |
| C3 | Tier-1 降價 cascade behavior (auto-clamp vs notify-only) | 3 | ROA-25 (research) |
| C4 | Tier-2 invitation gate default (auto vs manual approval) | 3 | Phase 1 §10 Q6 (no issue yet) |
| C5 | Refund policy (full / partial / time-bound / non-refundable) | 4, 5, 6 | **MISSING OWNER** |
| C6 | Commission timing trigger (sale / activation / expiry) | 6 | Phase 6 kickoff (ROA-19) |
| C7 | Account-lite vs guest checkout | 3, 5 | Phase 5 kickoff (ROA-18) |
| C8 | Supplier integration model (single vs multi, sync vs async) | 2, 4 | ROA-64 |
| C9 | Multi-market / multi-locale launch scope | 5 | Phase 5 kickoff (ROA-18) |
| C10 | Refund → commission reversal rule | 4, 6 | **MISSING OWNER** |

Cadence: every decision lands as a PR-merged ADR or as a `## Conclusion` block on the linked issue. No verbal-only resolutions — too many phases consume them.

## 4. Blockers affecting multiple projects

1. **Phase 1 §10 open questions still open.** 10 D-items are tracker-only (ROA-43 not yet expanded). Downstream Phase specs already cite §10.
2. **Supplier integration contract uncertain** (ROA-64 In Progress). Phase 4 kickoff doc explicitly says spec cannot finalize until this lands. Single supplier vs multi? Sync API vs async webhook vs manual import? Drives 70% of Phase 4 surface area.
3. **Refund policy has no owner** (C5). Phase 3 (discount reversal), Phase 4 (order reversal), Phase 5 (refund UX), Phase 6 (commission reversal) all consume it.
4. **Account-lite vs guest checkout** (C7). Phase 5 has it as a planning question; Phase 3 spec v0.1 has already drafted attribution around an assumed customer identity. Decision before M3 (6/5) or rework risk on Phase 3.
5. **Parallel marketing tracks not aligned with platform timeline.** `landing page` 5/31, `網紅合作` 5/31, `後台 eSIM 功能` 6/15, `Line 串接` 6/30 — none of these explicitly track which Phase spec they consume. Risk: marketing pushes traffic to surfaces that don't exist yet.
6. **`.ravn/project.yaml` `team_id` empty** (TEC-29 firewall block). Doesn't block spec work, but blocks cross-repo automation later.

## 5. Milestone reviews & handoff points

Each milestone = phase spec freeze + handoff doc + next phase kickoff issue seeded.

| Date | Milestone | Gate condition | If missed |
|---|---|---|---|
| 2026-05-20 (Wed) | **M1 — Phase 1 freeze** | glossary, actors, domain model, lifecycle, e2e flow, decisions D1–D10 merged on `main` | ≤2-day slip = absorb in Phase 2 buffer; >2 days = re-baseline whole timeline |
| 2026-05-28 (Thu) | **M2 — Phase 2 catalog interface freeze** | supplier contract + product mapping rule merged | Phase 4 spec can start, **cannot finalize**; Phase 6 commission base unblocked iff attribution stays unaffected |
| 2026-06-05 (Fri) | **M3 — Phase 3 commercial model freeze** | attribution + discount + pricing engine specs merged, C1/C2/C3 closed | Phase 6 cannot start commission base; Phase 5 price/discount UX blocked |
| 2026-06-13 (Sat) | **M4 — Phase 4 fulfillment contract freeze** | order state machine + fulfillment payload + refund/replace flow merged | Phase 5 frontend spec cannot finalize; Phase 6 reversal rules blocked |
| 2026-06-21 (Sun) | **M5 — Phase 5 UX freeze** | customer flows + locale scope defined | launch-readiness checklist starts incomplete |
| 2026-06-29 (Mon) | **M6 — Phase 6 settlement freeze** | commission + ledger + reconciliation specs merged | no go-live decision possible |

Handoff doc shape at each milestone (1 page):
- Frozen interfaces (concrete shapes the next phase consumes)
- Open items deferred to the next phase (with rationale)
- Risks newly surfaced for the next phase

## 6. Planning cadence

- **Daily, async** — ravn-agent program scan: comment on ROA-63 only if (a) any phase project is behind its weekly burn, (b) a new blocker appears, (c) an Ray-decision is waiting >24h.
- **Phase kickoff (Monday)** — read prior phase Conclusion + handoff doc + open questions; write phase plan doc; cut follow-up issues; estimate ~1 hr of Ray's attention.
- **Phase mid-check (Thursday)** — single question: "can we Friday freeze?" If no, surface now and re-baseline the next phase, not silently.
- **Phase freeze (Friday/Saturday)** — spec merged, open decisions closed, handoff doc written, next phase kickoff issue seeded.
- **Program checkpoint (every milestone)** — bump this file's version, re-confirm dependency map, re-check critical decisions table.

## 7. Risks (severity-ranked)

| # | Severity | Risk | Mitigation |
|---|---|---|---|
| R1 | **High** | **Schedule extremely aggressive.** 6 phases × 7 days = 42 days of spec work. Implementation cycle is not on the master timeline. Parallel `產品製作` tracks target 6/15 and 6/30 — implementation is happening **in parallel with** spec freeze. Any spec slip cascades to dev. | Add an explicit "implementation" overlay phase to this plan as soon as v0 lands. Re-baseline if Phase 1 slips >2 days. |
| R2 | **High** | **Single-person bottleneck.** Every phase kickoff, every decision, every PR review is Ray + ravn-agent. External collaborators planned but not onboarded. | C-series decisions get batched into a single Ray-attention block per phase. Avoid scattering decisions across daily pings. |
| R3 | **Medium** | **Phase 4 / 5 / 6 not yet broken into follow-up issues** (only kickoff). Phase 1–3 took ~9–16 issues each. 7 days is unlikely to absorb both follow-up expansion and the spec work itself. | Front-load Phase 4 kickoff: target kickoff complete + follow-ups cut by **6/8** (day 2), spec close by 6/13. |
| R4 | **Medium** | **C5 (refund policy) and C10 (refund→commission reversal) have no owner.** Will surface at M4 or M6 as a blocker if not assigned. | Assign owner this week — minimum: create a tracker issue in Phase 1 or Phase 6 project. |
| R5 | **Low** | **Parallel marketing projects not synced with platform plan.** 網紅 5/31 + landing 5/31 will push traffic before Phase 5 storefront spec is even started. | Confirm whether `產品製作（landing page）` is a static placeholder or the real storefront — if real, it consumes Phase 2 + Phase 5 specs and should be rebound. |
| R6 | **Low** | TEC-29 firewall block on filling `linear.team_id` doesn't block spec work but will block cross-repo automation when phase 4+ implementation needs it. | Track in TEC-29 thread; not in critical path for v0 master plan. |

## 8. Open questions for Ray (program-level, not phase-level)

These are the questions only the program plan can answer; phase planners can't.

1. **Does this plan assume spec-only output for 42 days, with implementation happening separately?** If yes, where is the implementation phase scheduled? If implementation is in parallel (per `產品製作 後台 eSIM` 6/15 target), how do we reconcile spec-freeze dependencies with code that ships before the spec freezes?
2. **Refund policy ownership** — assign C5 / C10 to a phase or to Ray directly.
3. **Account-lite vs guest** (C7) — please decide before 5/29 (Phase 3 kickoff) to avoid Phase 3 attribution rework.
4. **Parallel marketing projects** — are `landing page` / `網紅合作` going to land against real Phase 5 surfaces, or are they standalone? Drives whether they should be tagged into the M3/M5 milestone gates.
5. **Manual ops capacity assumption** — how many manual interventions per day can Roam absorb at launch? Drives Phase 4 automation depth and Phase 6 support-tool richness.

## 9. Snapshot — current issue burndown (2026-05-13)

| Phase | In Progress | Backlog | Done | Notes |
|---|---|---|---|---|
| 1 | 5 | 9 | 0 | Kickoff + 4 spec drafts in PR review; 9 follow-ups untouched |
| 2 | 4 | 0 (visible) | 0 | Kickoff + 3 spec issues started day-of |
| 3 | 4 | 15 | 0 | Kickoff + 3 spec issues started; D/E/F/R series queued |
| 4 | 1 | 0 | 0 | Kickoff doc on PR #3, no follow-ups cut |
| 5 | 1 | 0 | 0 | Kickoff scope draft only |
| 6 | 1 | 0 | 0 | Kickoff only |

Followups not yet cut = under-planned phases (4, 5, 6). See R3.

## 10. Parallel tracks to coordinate

These projects share the Roam team but sit outside the eSIM platform initiative. Master plan needs to know how they hook in.

| Project | Target | Coordination concern |
|---|---|---|
| 品牌建立 | — | Feeds `Brand voice / tone` cross-cutting checklist item; no platform dependency |
| 官方帳號 | — | Likely feeds Phase 5 notification touchpoints |
| 產品製作（landing page） | 2026-05-31 | **Risk** — lands before Phase 5 kickoff (6/14). Is this a placeholder marketing page or the storefront? |
| 網紅合作 | 2026-05-31 | **Risk** — promo traffic before Phase 5 storefront exists. Needs target page decision. |
| 產品製作（後台、eSIM 功能） | 2026-06-15 | **Risk** — implementation target before Phase 4 spec freeze (6/13). Tight. |
| 產品製作（Line 串接） | 2026-06-30 | After M6; presumably consumes Phase 5 redemption + Phase 4 fulfillment outputs |

## 11. How to update this plan

- **Trigger**: any phase freeze, any C-series decision closed, any new cross-phase blocker.
- **Action**: edit this file in a PR; bump the version footer; comment the diff summary on ROA-63 with `@ridcorix`.
- **Don't** maintain this in Linear comments only. Plan drift is silent unless it's diff-trackable.

---

*Version: v0 · 2026-05-13 · Author: ravn-agent (ROA-63)*
