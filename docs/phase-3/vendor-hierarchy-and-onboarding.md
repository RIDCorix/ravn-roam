# Phase 3 — Vendor hierarchy & onboarding spec

> **Status**: Draft v0.1 — pending review (ROA-67). Detail spec for §2–§3 of the Phase 3 commercial-model.md (ROA-16, PR #2).
> **Scope**: Vendor account model, parent-child relationship rules, full lifecycle state machine, invitation / acceptance / approval / suspension / termination / re-parenting flows, inheritance vs local-control matrix, audit-log requirements, and numbered acceptance criteria.
> **Out of scope**: Pricing math (ROA-69), discount codes & attribution (ROA-68), order fulfillment (Phase 4), storefront UX (Phase 5), commission/settlement (Phase 6).
> **Relationship to commercial-model.md v0.1**: This doc is the canonical, enforceable detail. Where v0.1 sketches a behavior in narrative form, this doc must define the explicit invariant, actor, guard, side effect, and audit field. Conflicts resolve in favor of this doc; v0.1 will be patched to cross-reference.

---

## 0. Reading guide

- Every rule that must be enforced is numbered `I-NN` (invariant), `S-NN` (state transition), or `F-NN` (flow step). Tests, DB constraints, and audit checks should cite these IDs.
- The **inheritance matrix** in §7 is the single source of truth for "what does a child get from its parent vs. what does it set itself". When v0.1 §4–§6 disagree with §7, §7 wins and v0.1 gets patched.
- The **acceptance criteria** in §9 are the contract the E1 engine (ROA-33), D1 schema (ROA-27), and F1/F2 flows (ROA-42/ROA-44) must satisfy. They map 1:1 to invariants.

---

## 1. Glossary

| Term | Definition |
|---|---|
| **Vendor account** | A row in `vendor_account`. Represents a tier-1 or tier-2 partner. Independent namespace from end-user accounts. |
| **Tier** | Integer 1 or 2 in v1. The `parent_vendor_id` field is recursive so the schema does not block a future tier-3, but tier-3 is forbidden by application invariant (see I-04). |
| **Parent** | The tier-1 vendor a tier-2 is currently bound to. Stored as `parent_vendor_id` on the tier-2 row. |
| **Reparenting** | Changing a tier-2's `parent_vendor_id` to a different active tier-1. Requires admin approval (see §5.3). |
| **Reparenting window** | The grace period (default 7 days, admin-configurable) during which an orphaned tier-2 (parent suspended/terminated) can be reparented before terminal cascade. |
| **Envelope** | Pricing constraints inherited from parent — see ROA-69. Referenced here only because §7 classifies it as inherited. |
| **Initiator** | The actor that created an invitation. Admin for tier-1 invitations; a tier-1 vendor for tier-2 invitations. |
| **Audit row** | A `vendor_state_audit` entry. Every lifecycle transition writes one. See §8. |

---

## 2. Hierarchy invariants

These are the rules the system must never violate. Each is enforced at one or more of three layers — DB constraint, application-service guard, or scheduled job. The "Where enforced" column is the implementation hint for ROA-27 (D1) and ROA-33 (E1).

| ID | Invariant | Where enforced |
|---|---|---|
| **I-01** | A vendor account's email is globally unique within the vendor-account namespace, case-insensitive. | DB `UNIQUE(LOWER(email))` on `vendor_account`. |
| **I-02** | Each tier-2 vendor has exactly zero or one `parent_vendor_id`. `NULL` is only valid transiently during reparenting (S-08, S-11). | DB `CHECK(tier = 2 → parent_vendor_id IS NOT NULL OR state IN ('invited', 'pending_reparent'))`. |
| **I-03** | A tier-1 vendor has `parent_vendor_id = NULL` always. Reclassification tier-1 ↔ tier-2 is forbidden. | DB `CHECK(tier = 1 → parent_vendor_id IS NULL)` + app guard refuses any UPDATE that changes `tier`. |
| **I-04** | `parent_vendor_id`, if set, must reference a row where `tier = 1`. (Forbids tier-3.) | DB trigger on insert/update of `vendor_account`. |
| **I-05** | A tier-2 vendor cannot self-parent or cycle. | Covered by I-04 (only tier-1 can be a parent) but explicitly tested. |
| **I-06** | The vendor-account namespace is disjoint from the end-user storefront namespace. Email collisions between the two are permitted; they reference different tables. | Schema separation (`vendor_account` vs. `customer_account`). |
| **I-07** | At most one `invitation` row is in state `invited` or `pending_admin_approval` for any given `(invitee_email)` at any time. Re-issuing supersedes (S-12). | DB partial unique index: `UNIQUE(LOWER(invitee_email)) WHERE state IN ('invited', 'pending_admin_approval')`. |
| **I-08** | A vendor's `state` transitions only via the matrix in §3.2. Direct UPDATEs that skip transitions are forbidden. | App-only path via `VendorLifecycleService`; DB trigger logs any direct UPDATE for audit and rolls back. |
| **I-09** | Every `state` change writes exactly one `vendor_state_audit` row with `(actor_type, actor_id, from_state, to_state, reason, occurred_at)`. | App guard + DB trigger backstop. |
| **I-10** | An invitation token is single-use, opaque, ≥128-bit entropy, valid for 14 days from creation. Re-issuing creates a new row and invalidates the prior (S-12). | App generation + DB `expires_at` column + state machine. |
| **I-11** | A vendor whose `tier-1` parent enters `suspended` or `terminated` enters `suspended` itself (S-09) within one scheduler tick (≤60s). | E1 listens to parent state-change events; reconciliation cron sweeps stragglers. |
| **I-12** | Past `sale_attribution` rows are never mutated by any vendor state change including reparenting. (Cross-doc invariant — owned by ROA-68; restated here because reparenting is the trigger.) | DB `sale_attribution` has UPDATE trigger that rejects. |

---

## 3. Lifecycle state machine

### 3.1 States

| State | Can authenticate? | Can sell? | Can be reparented? | Visible to parent? |
|---|---|---|---|---|
| `invited` | No — token only, no password set | No | n/a (parent already bound at invitation time) | Yes (pending list) |
| `pending_admin_approval` | No — invitee has accepted ToS + profile but awaits admin gate | No | n/a | Yes (pending list) |
| `active` | Yes (full) | Yes | Yes, with admin approval | Yes |
| `suspended` | Yes — read-only portal access | No new sales; existing orders fulfill | Yes, with admin approval | Yes |
| `pending_reparent` | Yes — read-only | No | This *is* the reparenting transitional state | Old parent: yes; new parent: yes (pending) |
| `terminated` | No | No | No | Archived in parent's history; not in active list |
| `expired` | No — invitation token aged out without acceptance | No | n/a | Yes (in expired-invitation list) |
| `revoked` | No — invitation withdrawn by initiator before acceptance | No | n/a | Yes (in revoked-invitation list) |

Note: `invited`, `pending_admin_approval`, `expired`, and `revoked` are **invitation** states stored on `vendor_invitation`, not `vendor_account`. A `vendor_account` row is created only when the invitee accepts and (if applicable) admin approves. See F-09.

### 3.2 Transition matrix

| ID | From | To | Trigger | Actor | Guard | Side effects |
|---|---|---|---|---|---|---|
| **S-01** | `(none)` | `invited` | Admin creates tier-1 invitation, or tier-1 creates tier-2 invitation | Admin or tier-1 | I-07 (no live duplicate invitation); for tier-2: parent is `active` | Generate token (I-10); send invitation email; audit |
| **S-02** | `invited` | `pending_admin_approval` | Invitee accepts ToS + completes profile; tier-2 invitation only; admin approval gate is enabled for this parent or globally | Invitee (anonymous via token) | Token valid + unused; profile complete | Notify admin queue; tier-1 sees status update |
| **S-03** | `invited` | `active` (tier-1 path) | Invitee accepts ToS + completes profile; this is a tier-1 invitation | Invitee (anonymous via token) | Token valid + unused; profile complete | Create `vendor_account` (tier=1); audit; welcome email |
| **S-04** | `invited` | `active` (tier-2 path, auto-approve) | Invitee accepts ToS + completes profile; admin approval gate disabled for this parent | Invitee (anonymous via token) | Token valid + unused; profile complete; parent still `active` | Create `vendor_account` (tier=2, parent set); audit; welcome email to invitee; notify parent |
| **S-05** | `pending_admin_approval` | `active` | Admin approves | Admin | Parent still `active` | Create `vendor_account`; audit (records admin id + reason if any); welcome email; notify parent |
| **S-06** | `pending_admin_approval` | `revoked` | Admin rejects | Admin | — | Audit (records admin id + reason); notify initiator; invalidate token |
| **S-07** | `invited` / `pending_admin_approval` | `revoked` | Initiator withdraws invitation | Admin (own) or tier-1 (own) | — | Invalidate token; audit; notify invitee |
| **S-08** | `invited` / `pending_admin_approval` | `expired` | Scheduler observes `expires_at < now()` | System (cron) | — | Invalidate token; audit; initiator sees row in expired list, can re-issue (S-12) |
| **S-09** | `active` → `suspended` (parent-cascade) | `suspended` | Parent transitioned to `suspended` or `terminated` | System (E1) | Vendor is tier-2 | Start reparenting-window timer (default 7d); audit with `reason = parent_cascade`; notify vendor + admin |
| **S-10** | `active` → `suspended` (direct) | `suspended` | Admin suspends, or parent tier-1 suspends own tier-2 | Admin or parent tier-1 (latter for own tier-2 only) | Reason field required (non-empty) | Audit; notify vendor; if vendor is tier-1, fan out S-09 to all its active tier-2 children |
| **S-11** | `active` / `suspended` → `pending_reparent` | `pending_reparent` | Admin initiates reparenting | Admin | New parent is `active` and tier-1; new parent has accepted (see F-15) | Audit; notify old parent, new parent, vendor |
| **S-12** | `expired` / `revoked` | `invited` (new row) | Initiator re-issues | Admin (own scope) or tier-1 (own scope) | I-07: no other live invitation for the same email | Create new `vendor_invitation` row with fresh token; audit links to prior row; notify invitee |
| **S-13** | `suspended` → `active` | `active` | Admin reinstates | Admin | Parent still `active` (else block with clear error) | Cancel any reparenting-window timer; audit; notify vendor + parent |
| **S-14** | `suspended` (within reparenting window) → `active` | `active` | Reparenting completes (see F-15) | Admin | New parent successfully linked | Cancel window timer; audit; notify all three parties |
| **S-15** | `suspended` (window expired, parent suspended) | remains `suspended` | Scheduler observes window expiry while parent still suspended | System (cron) | — | Audit; notify vendor + admin: "manual action required" |
| **S-16** | `suspended` (window expired, parent terminated) | `terminated` | Scheduler observes window expiry while parent terminated | System (cron) | — | Audit; notify vendor + admin |
| **S-17** | `active` / `suspended` | `terminated` | Admin terminates | Admin | Reason field required | Audit; if vendor is tier-1, fan out S-09 (or S-16 if window passes) to children; existing orders fulfill, no new sales |
| **S-18** | `pending_reparent` → `active` | `active` | Reparenting flow completes (F-15) | Admin | New parent linked, envelope re-evaluated (ROA-69) | Audit; notify all three parties |
| **S-19** | `pending_reparent` → `suspended` | `suspended` | Reparenting aborted | Admin | — | Audit; status returns to pre-reparent state (suspended), reasons preserved |

**Forbidden transitions**: any `from → to` not listed above is rejected by the service with `INVALID_STATE_TRANSITION` and audited as an attempted violation (I-08).

---

## 4. Onboarding flows

### 4.1 F1 — Tier-1 invitation (admin → tier-1)

Implements S-01 → S-03.

```
F-01  Admin opens "Invite tier-1 vendor" in admin console.
F-02  Admin submits: { vendor_name, primary_contact_email, default_supplier_plan_access?, default_pricing_envelope? }.
F-03  System validates I-01 (no existing vendor with that email) and I-07 (no live invitation for that email).
F-04  System creates vendor_invitation row { tier=1, parent_vendor_id=NULL, token, expires_at = now+14d, state='invited', initiator_admin_id }.
F-05  System sends magic-link email. Audit S-01.
F-06  Invitee opens link. System validates token (not expired, not used).
F-07  Invitee accepts ToS, completes profile (legal_name, billing_contact, payout_placeholder).
F-08  System creates vendor_account { tier=1, state='active', activated_at=now }, marks invitation row state='accepted', audits S-03.
F-09  System sends welcome email + onboarding portal link. Admin sees row move from "pending invitations" → "active tier-1".
```

**Error paths**:

- F-06 token expired → render expired page; offer "request re-issue"; backend creates an `expired` audit entry but does not auto-reissue (S-12 is initiator-driven).
- F-06 token already used → render generic "this link has been used" page (do not leak account existence).
- F-07 profile invalid (e.g., missing legal_name) → re-render form with field errors; invitation stays `invited` until completion or expiry.
- I-01 collision discovered between F-04 and F-08 (race; another admin invited same email concurrently): F-08 fails with `EMAIL_TAKEN`, invitation moves to `revoked`, admin notified.

### 4.2 F2 — Tier-2 invitation (tier-1 → tier-2)

Implements S-01 → S-04 (auto-approve path) or S-01 → S-02 → S-05/S-06 (manual-approve path).

```
F-10  Tier-1 opens "Invite tier-2" in vendor portal.
F-11  Tier-1 submits: { vendor_name, primary_contact_email, optional starting tier-2 envelope override }.
F-12  System validates I-01, I-07; verifies tier-1 itself is 'active'; verifies tier-2-envelope (if supplied) is within tier-1's permitted envelope (ROA-69).
F-13  System creates vendor_invitation { tier=2, parent_vendor_id=<tier-1>, token, expires_at=now+14d, state='invited', initiator_vendor_id=<tier-1> }.
F-14  Determine approval gate:
        - If admin global gate = manual, OR per-parent override = manual → invitation goes into pending_admin_approval after invitee accepts (S-02).
        - Else (default = auto) → S-04 on acceptance.
F-15  System sends magic-link email. Audit S-01.
F-16  Invitee opens link, accepts ToS, completes profile.
F-17  Auto-approve path: system creates vendor_account { tier=2, parent_vendor_id, state='active', activated_at=now }, audits S-04, notifies parent.
F-18  Manual-approve path: invitation moves to pending_admin_approval (S-02). Admin sees row in admin review queue. Admin approves (S-05) or rejects (S-06).
F-19  Welcome email on activation. Parent sees new active child in their portal.
```

**Error paths**:

- F-12 tier-1 itself transitioned away from `active` between F-10 and F-13: reject with `PARENT_NOT_ACTIVE`.
- F-17/F-18 parent transitioned away from `active` between F-16 and account creation: invitation moves to `pending_admin_approval` regardless of gate setting — admin must decide whether to reparent or revoke.
- Race: two parents invite the same email concurrently — first commit wins on I-07 partial unique index, second receives `INVITATION_ALREADY_PENDING` (matches v0.1 §9.7).

### 4.3 F3 — Admin manual-approval review

Implements S-05 / S-06.

```
F-20  Admin opens "Pending tier-2 approvals" queue in admin console.
F-21  Each row shows: invitee name + email, proposed parent tier-1, requested envelope (if any), invitation age, parent's standing summary (children count, suspension history).
F-22  Admin selects "Approve" or "Reject". A reason field is required on reject; optional on approve.
F-23  Approve → S-05; reject → S-06. Notifications fire per matrix.
F-24  All admin decisions write an audit row with admin_id + reason (I-09).
```

### 4.4 F4 — Re-issue / revoke invitation

```
F-25  Initiator (admin for tier-1 invitations, tier-1 for their tier-2 invitations) opens the invitation row.
F-26  If state ∈ {invited, pending_admin_approval}: "Revoke" available → S-07.
      If state ∈ {expired, revoked}: "Re-issue" available → S-12. System enforces I-07 before issuing a new row.
F-27  Re-issued invitation is a new row with a new token; the prior row stays for audit history.
```

---

## 5. Suspension, termination & reparenting

### 5.1 F5 — Admin suspend / reinstate

```
F-28  Admin opens vendor detail page.
F-29  Selects "Suspend". Reason required. Triggers S-10.
F-30  If vendor is tier-1: E1 fans out S-09 to every tier-2 child (within one scheduler tick, I-11).
F-31  Each cascaded suspension starts a reparenting-window timer (default 7d, admin-configurable global setting).
F-32  Admin can "Reinstate" → S-13 anytime while suspended. Cascaded children are NOT auto-reinstated; admin must reinstate them individually (children may have been reparented in the interim).
```

### 5.2 F6 — Tier-1 suspends own tier-2

```
F-33  Tier-1 opens own tier-2 detail page in vendor portal.
F-34  Selects "Suspend". Reason required (visible to admin, not invitee). Triggers S-10.
F-35  Tier-1 can "Reinstate" → S-13.
F-36  Tier-1 cannot terminate their own tier-2 — termination is admin-only (see §7 control matrix). Tier-1 wishing to permanently sever uses "Suspend + flag for admin termination".
```

### 5.3 F7 — Admin termination

```
F-37  Admin opens vendor detail page.
F-38  Selects "Terminate". Reason required. Triggers S-17.
F-39  Existing orders for the terminated vendor continue to fulfillment (Phase 4 handles); no new orders accepted.
F-40  If tier-1: every active tier-2 child enters S-09 (cascade-suspend) with reparenting window. At window expiry, unrescued tier-2s enter S-16 (terminate).
F-41  Termination is reversible only by admin manual recovery within 30 days (a `recovered` flag on the audit row); beyond that the row is archived and a re-onboarding requires a fresh invitation.
```

### 5.4 F8 — Reparenting (admin-driven)

```
F-42  Admin opens tier-2 detail page → "Reparent".
F-43  Admin selects new tier-1 parent. UI shows: new parent's envelope, tier-2's current pricing vs. new envelope (delta highlighted; ROA-69 enforces clamping).
F-44  Admin confirms. Tier-2 enters pending_reparent (S-11). Old parent, new parent, and tier-2 all notified.
F-45  New parent has a portal "Pending children" view and must "Accept" or "Reject". Accept → S-18 (or S-14 if currently suspended); Reject → S-19.
F-46  Admin can override-accept on behalf of new parent (e.g., parent unresponsive). This requires an explicit override-reason field.
F-47  On S-18 / S-14, envelopes re-evaluate per ROA-69; orders already created remain bound to original attribution and pricing (I-12).
```

### 5.5 F9 — Voluntary parent switch (tier-2 initiates)

Optional in v1 — gated by open question Q5 (see §10). If enabled:

```
F-48  Tier-2 opens "Change parent" in own portal.
F-49  Tier-2 selects desired new parent (system shows only active tier-1s flagged "accepts referrals").
F-50  Request created. Old parent and admin both notified. Both must approve before S-11 fires.
F-51  Once approved, flow continues per F-42 onward.
```

If Q5 = defer, F9 is removed from v1 and the "Change parent" UI is hidden.

---

## 6. Parent-child relationship rules — detailed

### 6.1 Structural rules

- **R-01** A tier-2's `parent_vendor_id` is mandatory while state ∈ {`active`, `suspended`, `pending_reparent`}; nullable only while in invitation states or during the brief window of S-11 commit. Implemented by I-02.
- **R-02** Re-classification tier-1 ↔ tier-2 is forbidden. Migrating a tier-2 to "go independent" means terminating the tier-2 account and onboarding it fresh as a tier-1 (no attribution carries over, per I-12).
- **R-03** A tier-1 cannot become a tier-2 of another tier-1. Equivalent to R-02 but explicit because product/discount/attribution invariants depend on tier-1 = root.
- **R-04** Reparenting target must be a tier-1 in `active` state. Suspended or terminated tier-1s cannot receive reparented children.
- **R-05** A tier-2's invitation history (the prior invitations + audit rows) remains attached to the original parent. The new parent sees only the reparent transition + forward-going activity.

### 6.2 Cascade rules

- **R-06** Parent → child cascade is **one-way**: tier-1 state changes propagate down. Tier-2 state changes never affect parent.
- **R-07** Cascade is **state-only**, not data: child's products, prices, discount codes, and customer history remain owned by the child even while suspended.
- **R-08** Cascade timer (reparenting window) is **per child, not per cascade event**: if a tier-1 is suspended, then reinstated, then suspended again, each child gets a fresh window each time.
- **R-09** Children whose parent is terminated and who are not reparented before window expiry transition to terminated (S-16), not to detached active state. Orphan tier-2s are not permitted (R-01).

### 6.3 Visibility & action rules

- **R-10** A tier-1 can see all of their tier-2 children (active + suspended + terminated). Tier-1s cannot see other tier-1s' children, even cross-tier-1 in the same admin.
- **R-11** A tier-1 can suspend, reinstate, and request termination (admin-actioned) on their own tier-2s. They cannot reparent their own tier-2s — only admin can move children between tier-1s.
- **R-12** A tier-2 can see and edit their own profile, pricing (within envelope; ROA-69), discount codes (within scope; ROA-68), and sales reports. They cannot see their parent's other tier-2 siblings.
- **R-13** Admin can do anything in the matrix in §7.

---

## 7. Inheritance vs local-control matrix

This is the canonical answer to "what does a tier-2 inherit from its tier-1 vs. set locally". When ROA-69 (pricing) and ROA-68 (discount) detail specs are written, they MUST cite the row in this table they govern.

Legend:
- **Inherited (read-only)** — child reads parent's value; cannot override.
- **Bounded (set locally within parent's envelope)** — child sets its own value but parent constrains the range.
- **Local** — child controls entirely; parent has no say.
- **Forbidden** — not available to that tier.
- **Snapshot-at-create** — value captured when child account is created and frozen on the child; not re-read from parent if parent changes later.

| Setting | Tier-1 controls | Tier-2 controls | Notes |
|---|---|---|---|
| Legal entity name | Local | Local | Each tier independent. |
| Primary contact email | Local | Local | I-01 enforces global uniqueness. |
| Payout details | Local | Local | Each settles independently; Phase 6 owns the payout-routing logic. |
| Supplier plan access | Inherited (from admin's grant) | Inherited (transitively via parent) | Tier-2 sees the intersection of (parent's grant) ∩ (parent's published products). Parent cannot grant access tier-2 it doesn't itself have. |
| Product catalog visibility | Local — parent chooses which of its packaged products are resellable | Bounded — tier-2 can only sell what parent marks resellable | "Lock product as non-resellable" by parent removes it from tier-2's offer. |
| Pricing envelope (markup bounds) | Inherited from admin envelope | Bounded by parent's envelope | Cross-doc: ROA-69 is canonical. |
| Effective sale price | Local (within admin envelope) | Local (within parent's envelope) | Override hierarchy per v0.1 §4.4. |
| Currency | Inherited (USD in v1 per v0.1 §4.5) | Inherited | Multi-currency deferred — open Q7. |
| Discount code creation — scope | Local (own products) | Local (own attributed sales) | ROA-68 canonical. |
| Discount cost absorption default | Local (defaults to "owner-vendor") | Local (defaults to "owner-vendor") | Admin can override per-code (matrix in v0.1 §5.2). |
| Sales attribution rules | Inherited (platform-wide policy) | Inherited | Cannot be overridden at any vendor tier; ROA-68 canonical. |
| Tier-2 invitation approval gate | Bounded — admin sets global default; admin can override per-parent | Forbidden | Tier-2 cannot invite further sub-vendors (no tier-3). |
| Reparenting window length | Inherited (admin global setting) | Inherited | Could become parent-overrideable in a future revision; v1 = admin-only. |
| Suspension reason visibility | Local — parent sees own reason | Inherited — admin's parent-cascade reason is shown to child | Tier-1 reasons for own children's suspension are visible to that child + admin. |
| Audit log | Inherited (own + own children for tier-1) | Inherited (own only for tier-2) | R-10, R-12. |
| Branding (storefront subdomain, logo, etc.) | Local | Local | Phase 5 covers; included here so the answer is on file. |

---

## 8. Audit log requirements

Required because invariant I-09 mandates an audit row for every state change. Phase 6 reconciliation depends on this trail being lossless.

### 8.1 Schema (cross-references ROA-27 D1)

```
vendor_state_audit
  id, vendor_account_id (nullable for pre-account invitation events),
  invitation_id (nullable for post-account state changes),
  actor_type ('admin' | 'tier1_vendor' | 'invitee' | 'system'),
  actor_id (admin uuid | tier1 vendor uuid | NULL for invitee/system),
  from_state, to_state,
  transition_id (S-NN reference, string),
  reason (text, nullable; required for S-06, S-10, S-17 per state matrix),
  context (jsonb, optional — e.g. for reparent: { old_parent_id, new_parent_id, envelope_delta }),
  occurred_at (timestamptz, default now()),
  recovered (bool, default false)  -- used by F-41 termination-recovery
```

### 8.2 Retention & immutability

- **R-14** Audit rows are append-only. The only mutation permitted is setting `recovered = true` on a termination row within the 30-day recovery window (F-41). DB trigger rejects all other UPDATEs.
- **R-15** Audit rows are retained for the life of the platform. Phase 6 settlement disputes can cite them years later.
- **R-16** Personally identifying information in `reason` and `context` is in scope for GDPR / equivalent erasure requests — implementations should design schemas so reason text can be redacted without losing the transition record. Replace with `[REDACTED on YYYY-MM-DD]`; keep the structural fields.

### 8.3 Reads

- Admin: all rows.
- Tier-1: rows where `vendor_account_id IN (self, self's children)`.
- Tier-2: rows where `vendor_account_id = self`.

---

## 9. Acceptance criteria

These are the testable contracts ROA-31 (Q1 — Phase 3 edge case acceptance suite) must cover for hierarchy/onboarding. Each maps to one or more invariants.

| AC | Statement | Maps to |
|---|---|---|
| **AC-01** | Inviting an email that already has an active vendor account returns `EMAIL_TAKEN`; no row created. | I-01, F-12 |
| **AC-02** | Two concurrent invitations to the same email: exactly one succeeds; the other returns `INVITATION_ALREADY_PENDING`. | I-07, v0.1 §9.7 |
| **AC-03** | Token expires at exactly `expires_at + 0s`; an accept request at `expires_at - 1s` succeeds; at `expires_at + 1s` returns `TOKEN_EXPIRED`. | I-10, S-08 |
| **AC-04** | Re-issuing an expired invitation produces a new token; the old token, if presented, returns `TOKEN_EXPIRED` (not `TOKEN_USED`). | S-12 |
| **AC-05** | Suspending a tier-1 cascades to every active tier-2 child within 60s (one scheduler tick). | I-11, S-09 |
| **AC-06** | A cascaded tier-2's reparenting window starts at the moment of suspension cascade and lasts exactly the admin-configured duration (default 7d). | R-08 |
| **AC-07** | Reparenting a tier-2 to a new tier-1: `vendor_account.parent_vendor_id` updates; `sale_attribution` rows for orders prior to the transition retain `parent_vendor_id_at_sale` pointing at the old parent. | I-12, R-05, F-47 |
| **AC-08** | Terminating a tier-1 whose tier-2 children are not reparented within the window: those children transition to `terminated` exactly when the window expires (no later than 60s after). | S-16, R-09 |
| **AC-09** | A direct DB `UPDATE vendor_account SET state = ...` outside `VendorLifecycleService` is logged as a violation and rolled back. | I-08 |
| **AC-10** | No transition occurs without writing a `vendor_state_audit` row; every audit row has a non-null `transition_id`. | I-09 |
| **AC-11** | A tier-1 attempting to reparent their own tier-2 receives `FORBIDDEN`. Only admin can call the reparent endpoint. | R-11 |
| **AC-12** | A tier-1 attempting to terminate their own tier-2 receives `FORBIDDEN`. The portal shows a "request admin termination" affordance instead. | F-36 |
| **AC-13** | Attempting to create a vendor with `tier = 1, parent_vendor_id = <something>` is rejected by DB. Same for `tier = 2, parent_vendor_id = NULL` (outside transitional invitation states). | I-02, I-03 |
| **AC-14** | Attempting to create a vendor with `parent_vendor_id` pointing at a tier-2 row is rejected by DB. | I-04 |
| **AC-15** | A tier-2's portal does not surface their parent's other tier-2 children, even via direct API id-guessing. | R-12 |
| **AC-16** | An audit row's `reason` field, when redacted under GDPR, retains `from_state`, `to_state`, and `occurred_at`. | R-16 |

---

## 10. Open questions — locked-in scope vs deferred

This spec assumes the v0.1 defaults for the following. When Ray decides differently, the listed sections must be revised before D1/E1/F1/F2 implementation can ship.

| Ref to v0.1 §10 | Question | Default this spec assumes | Sections that lock when answered |
|---|---|---|---|
| **Q1** | Tier-3 ever? | No, permanently capped at 2 | I-04 stays (DB CHECK); could change to "advisory only" if Q1 = yes-someday. |
| **Q5** | Reparenting in v1? | Yes, admin-approval-gated | §5.4 F8, §5.5 F9, S-11 / S-18 / S-19. If Q5 = defer, remove F8/F9 from this spec and add R-04-defer note. |
| **Q6** | Tier-2 invitation default approval gate | Auto-approve, admin-toggleable | §4.2 F2 step F-14, S-02. If Q6 = manual-default, swap which path is the default branch. |
| **Q8** | Vendor-account vs end-user namespace | Separate | I-06. If Q8 = unified, I-06 inverts and a `role` column on a unified `account` table replaces vendor-only tables. |

No other Phase 3 open questions (Q2, Q3, Q4, Q7) affect this spec — they live in ROA-68/ROA-69 territory.

---

## 11. Follow-up issues created by ROA-67

This spec is the upstream input. Detail-level UX and admin-review specs are split off:

| # | Title | Why split | Blocks |
|---|---|---|---|
| **UX-1** | Onboarding UX spec — public accept page, profile form, welcome flow | Wireframes + copy live separately from logic spec so design iteration doesn't churn the logic doc | ROA-42 (F1 implementation), ROA-44 (F2 implementation) |
| **UX-2** | Admin review flow spec — manual approval queue, suspend/terminate dialogs, reparent confirmation, audit-log viewer | Same separation reason; admin UX has heavier copy + error-state design | ROA-46 (F3 admin console implementation) |

Existing parent issues (ROA-42 / ROA-44 / ROA-46 / ROA-49) remain owners of the implementation; the new UX issues are *spec deliverables* whose output the F-series consumes. Both UX issues are created under the Phase 3 project with `parent = ROA-67`.

---

## 12. Changelog

- **v0.1 — 2026-05-13** (ROA-67): initial detail spec for vendor hierarchy + onboarding. Derived from commercial-model.md v0.1 (ROA-16) §1–§3, §7 (admin/vendor subset), §8 (vendor tables), §9.1–§9.2 (cascade + reparenting edge cases). Adds: numbered invariants, full state-machine transition table, inheritance matrix, audit-log schema, 16 acceptance criteria.
