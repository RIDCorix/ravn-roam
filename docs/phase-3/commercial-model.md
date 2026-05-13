# Phase 3 — Multi-tier commercial model

> **Status**: Draft v0.1 — pending review (ROA-16). Supersedes nothing. Frozen for implementation kickoff once Ray approves.
> **Scope**: This document is the load-bearing spec for Phase 3 (eSIM Platform — vendor hierarchy, pricing & promotions). It defines the multi-tier commercial model, the entities involved, who controls what, and the edge cases that implementation must honor.
> **Out of scope**: Order fulfillment payloads (Phase 4), customer storefront UX (Phase 5), commission & settlement math (Phase 6). This doc defines the *interfaces* Phase 4–6 will consume — not the implementations.
> **Dependencies upstream**: Phase 1 (domain model) and Phase 2 (supplier catalog & packaged products). Where Phase 1/2 outputs are not yet locked, this doc states a working assumption and flags it.

---

## 1. Actors

| Actor | Description | Scope of authority |
|---|---|---|
| **Platform admin** | RAVN-Roam staff. Operates the platform. | Suppliers, supplier plans, global guardrails, vendor onboarding, override of any vendor decision, cross-tier discount codes, attribution & commission policy. |
| **Tier-1 vendor** | Direct partner of the platform. Packages supplier plans into sellable products and either sells direct or invites tier-2 resellers. | Own product packaging & pricing (within admin envelope), own discount codes, invite/manage their tier-2 children, set the resale envelope tier-2 must price within. |
| **Tier-2 vendor** | Reseller invited by exactly one tier-1 vendor. Sells the parent's products to end users. | Own resale price (within parent envelope), own discount codes (within parent scope), own customer-facing channel. |
| **End user** | Customer who buys eSIM products through any vendor's channel or the platform's direct storefront. | Out of Phase 3 scope; included only to define attribution. |

**Working assumption (pending Phase 1)**: Two vendor tiers only. No tier-3 in v1. See §10 open question Q1.

---

## 2. Vendor hierarchy

### 2.1 Relationship constraints

- **Each tier-2 vendor has exactly one active parent tier-1** at any time. Multi-parent is explicitly disallowed in v1 — attribution becomes ambiguous and the commission math in Phase 6 cannot reconcile.
- **Tier-1 vendors are roots.** They have no parent. They cannot be re-classified as tier-2.
- **No tier-3.** Tier-2 vendors cannot invite further sub-vendors.
- **Re-parenting tier-2** (changing the parent tier-1) is allowed but requires platform admin approval and an audit trail. Past attribution does NOT migrate.
- **A vendor account is unique across both tiers** — one email = one vendor account. Vendor account namespace is separate from end-user (storefront) accounts.

### 2.2 Lifecycle states

```
invited → active → suspended → terminated
              ↑       ↓
              └───────┘  (admin or parent can suspend/reinstate)
```

| State | Can log in? | Can sell? | Can be re-parented? | Cascade behavior |
|---|---|---|---|---|
| `invited` | No (token-only) | No | — | — |
| `active` | Yes | Yes | Yes (with admin approval) | — |
| `suspended` | Yes (read-only) | No | Yes (admin approval) | If tier-1 → all tier-2 children auto-suspend with reparenting window (see §9.1) |
| `terminated` | No | No | No | Tier-2 children auto-suspend permanently if not re-parented within window |

State transitions are admin-overrideable. All transitions are logged with actor, timestamp, and reason.

---

## 3. Invitation flows

### 3.1 Tier-1 invitation (admin-initiated)

1. **Admin** creates invitation: `{vendor_name, primary_contact_email, default_pricing_envelope?, default_supplier_plan_access?}`.
2. System generates `vendor_invitation` row with one-time token, expiry = 14 days, status = `invited`.
3. System emails contact with a magic link.
4. **Tier-1 prospect** opens link → accepts ToS → completes profile (legal entity name, billing contact, payout details placeholder) → vendor transitions to `active`.
5. On activation, default permissions apply: package products from admin-granted supplier plan subset, set markup within admin envelope, invite tier-2.

### 3.2 Tier-2 invitation (tier-1-initiated)

1. **Tier-1 vendor** creates invitation: `{vendor_name, primary_contact_email, optional starting tier-2 envelope}`.
2. System creates `vendor_invitation` with `parent_vendor_id = <tier-1>`, status = `invited`, expiry = 14 days.
3. **Admin approval gate** (configurable, default = auto-approve):
   - Global policy: admin can require manual approval per tier-1 vendor OR globally.
   - When manual, invitation sits in `pending_admin_approval` until admin acts. Tier-1 sees the pending state.
4. **Tier-2 prospect** opens link → accepts ToS → completes profile → activates as `active` under that parent.
5. Default permissions: see §4 (pricing) and §5 (discount codes).

### 3.3 Invitation invariants

- One email = one vendor account. If an email already has an active vendor record, invitation is rejected with a clear error.
- Email collisions with end-user storefront accounts do NOT block invitation (separate namespace).
- Tokens are single-use. Re-inviting invalidates the prior token.
- If an invitation expires unactivated, the originator can re-issue (counted as a new invitation row, separate audit entry).

---

## 4. Pricing controls

### 4.1 Pricing layers (3-layer model)

```
Supplier cost (set by platform from Phase 2 supplier catalog)
   │
   ▼
Tier-1 packaged price  ← constrained by ADMIN envelope (min markup %, max markup %, optional hard ceiling)
   │
   ▼
Tier-2 resale price    ← constrained by TIER-1 envelope (min markup %, max markup %, optional hard floor/ceiling)
   │
   ▼
End-user sell price (= tier-2 resale price, or tier-1 packaged price if sold direct, or platform direct price)
```

### 4.2 Pricing envelope semantics

An **envelope** is `{min_markup_pct, max_markup_pct, hard_floor?, hard_ceiling?}` over the layer below.

- Envelopes are inclusive at min, inclusive at max.
- Hard floor / ceiling override percentage-based bounds (e.g. "tier-2 cannot sell below USD 5 even if markup math allows").
- Envelopes can be set per-product OR as a vendor-level default (per-product wins).
- Setting an envelope that contradicts a higher-tier envelope (e.g. tier-1 ceiling below tier-1's own floor) is rejected with a clear error.

### 4.3 Who can do what

| Action | Platform admin | Tier-1 | Tier-2 |
|---|---|---|---|
| Set supplier cost | ✓ | — | — |
| Set admin envelope (tier-1 markup bounds) | ✓ | — | — |
| Set tier-1 packaged product price | ✓ (override) | ✓ within envelope | — |
| Set tier-1 envelope (tier-2 markup bounds) | ✓ (default per tier-1) | ✓ override own | — |
| Set tier-2 resale price | ✓ (override) | ✓ (hard set, within envelope) | ✓ within envelope |
| Lock product as non-resellable to tier-2 | ✓ | ✓ (own products) | — |
| Hard ceiling / floor override | ✓ | ✓ within admin bounds | — |
| Bulk pricing update | ✓ | ✓ own scope | ✓ own scope |
| View competitor (sibling) pricing | ✓ all | — | — |

### 4.4 Override hierarchy

When computing the effective sell price, override precedence (high → low):
1. Admin hard-set price (rare, for incident response).
2. Vendor's per-product hard-set price (within applicable envelope).
3. Vendor's category/group-level price rule.
4. Vendor's default markup % applied to layer below.

### 4.5 Currency

Phase 3 assumes a **single base currency (USD)** for all pricing math. Multi-currency display is Phase 5 (storefront). FX-driven repricing is out of scope and flagged as a research issue.

---

## 5. Discount codes

### 5.1 Capabilities

| Axis | v1 supported values |
|---|---|
| **Type** | percent off, fixed amount off |
| **Scope** | all products, specific products, specific destination/region, specific supplier-plan group |
| **Eligibility** | any customer, first-time customer, email-domain allowlist, region |
| **Stacking** | non-stackable (default), stackable with explicit policy, max depth = 2 |
| **Limits** | total uses, per-customer uses, valid date range, valid time-of-day window (optional) |
| **Ownership** | platform admin / tier-1 / tier-2 |

Excluded from v1 (defer to later phase, flagged as follow-up): buy-X-get-Y, tiered discount (volume-based), free-shipping-equivalent (n/a for digital eSIM), gift card.

### 5.2 Ownership & scope rules

- **Platform admin codes** can apply globally or to any product / vendor subset. Cost absorption is **per-code configurable**, defaulting to **platform-absorbed** (see §10 open Q2).
- **Tier-1 vendor codes** can apply only to their own packaged products. Cost is borne by tier-1 by default. Tier-1 cannot create codes affecting another tier-1's products.
- **Tier-2 vendor codes** can apply only to sales attributed to them. Cost is borne by tier-2 by default.
- Tier-1 codes apply **regardless of which tier-2 made the sale**. Tier-2 codes apply only when sale is attributed to that tier-2.

### 5.3 Validation rules

- Code applied at checkout. Order persists the redemption with `(code_id, scope_at_redemption, cost_attributed_to_vendor_id, discount_amount)`.
- **Floor protection**: A discount code cannot reduce the realized sale price below the selling vendor's pricing floor (supplier cost + minimum applicable markup). System blocks the redemption with a clear error rather than silently absorbing the loss.
- **Stacking validation**: If user enters multiple codes, system checks pairwise stackability. Order in which codes apply is deterministic: percent-off → fixed-amount-off (else fixed code becomes worthless).
- **Limit enforcement**: Atomic decrement on the usage counter at order creation. Refund (Phase 4) returns the use to the pool IFF cancelled before fulfillment; else the use is consumed.
- **Tier code authority**: Tier-2 cannot create codes that exceed their own pricing margin — i.e. tier-2's max discount is bounded by `(tier-2 resale price - tier-2 floor)`.

### 5.4 Discount cost attribution → commission

Each `discount_redemption` row records `cost_attributed_to_vendor_id`. Phase 6 commission base is:

```
commission_base = realized_sale_price - sum(discount_redemption.amount where cost_attributed_to_vendor_id = selling_vendor_id)
```

i.e. discounts borne by platform do NOT erode the selling vendor's commission base; discounts borne by selling vendor itself do. This is the **load-bearing interface to Phase 6** — Phase 6 implementation MUST read this field.

---

## 6. Sales attribution

### 6.1 Attribution precedence (high → low)

1. **Active vendor-storefront session** — customer is browsing on `tier2.roam.example` or `tier1.roam.example`, attribution = that vendor.
2. **Vendor referral link** (e.g. `roam.example/?ref=<vendor_code>`) — sets a session cookie. Window: **7 days** (working default — see Q4).
3. **Explicit vendor-issued discount code** at checkout (when no session/referral) — attribution = code issuer.
4. **Platform direct** (no signal) — attribution = platform.

If multiple signals conflict, **highest-precedence wins** AND the others are recorded as `attribution_signals[]` for debugging / analytics but do not change the attributed vendor.

### 6.2 Immutability

Attribution is captured at **order creation** and is **immutable post-sale**. Subsequent changes to vendor hierarchy (re-parenting, suspension, termination) do NOT mutate past attribution.

This is the **load-bearing interface for Phase 6 commission integrity** — historical commissions cannot be retroactively reassigned by re-parenting.

### 6.3 Discount + attribution interactions

- Customer arrives via tier-2 referral, applies tier-1 vendor code: sale attributed to **tier-2** (link wins); discount cost borne by **tier-1**.
- Customer arrives via tier-2 referral, applies platform code: sale attributed to **tier-2**; discount cost borne by **platform**.
- Customer no referral, applies tier-2 code: sale attributed to **tier-2** (code = explicit signal).
- Customer no referral, applies tier-1 code: sale attributed to **tier-1**.

### 6.4 Reporting visibility

| Role | Can see |
|---|---|
| Platform admin | All sales, all attribution, all discount cost attribution |
| Tier-1 | Own direct sales + aggregated + per-child sales of all tier-2 they parent |
| Tier-2 | Own attributed sales only |

---

## 7. Platform admin vs vendor controls — consolidated matrix

| Control | Admin | Tier-1 | Tier-2 |
|---|---|---|---|
| Onboard tier-1 vendor | ✓ | — | — |
| Approve / reject tier-2 invitation (if gate enabled) | ✓ | — | — |
| Suspend / terminate any vendor | ✓ | own tier-2 only | — |
| Re-parent tier-2 | ✓ (audit) | — | — |
| Invite tier-2 | ✓ override | ✓ | — |
| Set supplier plan availability per vendor | ✓ | — | — |
| Set packaged product price (own scope) | ✓ override | ✓ within envelope | — |
| Set product price (other tier-1's product) | ✓ | — | — |
| Set tier-2 resale price | ✓ override | ✓ | ✓ within envelope |
| Lock product as non-resellable to tier-2 | ✓ | ✓ own | — |
| Issue discount code in own scope | ✓ | ✓ | ✓ |
| Issue cross-vendor / platform-wide code | ✓ | — | — |
| Override discount stackability policy globally | ✓ | within own scope | — |
| Choose discount cost absorption (platform vs vendor) | ✓ per code | default vendor, no override | default vendor, no override |
| View own sales | ✓ all | ✓ direct + own tier-2 | ✓ direct only |
| View commission rules | ✓ edit | ✓ read | ✓ read |
| Audit log access | ✓ all | ✓ own + own tier-2 | ✓ own |

---

## 8. Data model interfaces (Phase 4–6 consumers)

> These are interface shapes, not table DDL. Phase 4 (ordering), Phase 5 (storefront), and Phase 6 (commissions) consume these. The implementation issues in §11 will refine them.

```
vendor_account
  id, tier (1|2), parent_vendor_id (nullable, FK self), email, legal_name,
  state (invited|active|suspended|terminated), created_at, activated_at, suspended_at, terminated_at

vendor_invitation
  id, parent_vendor_id (nullable), invitee_email, token, expires_at,
  state (invited|pending_admin_approval|accepted|expired|revoked),
  initiator_vendor_id (nullable — null when admin-initiated), created_at

pricing_envelope
  id, scope (vendor_id | product_id | vendor_id+product_id | global),
  layer (admin→tier1 | tier1→tier2),
  min_markup_pct, max_markup_pct, hard_floor?, hard_ceiling?, currency,
  effective_from, effective_until

product_price_override
  id, vendor_id, product_id, layer, override_price, currency, reason, set_by, effective_from

discount_code
  id, code, owner_vendor_id (nullable = platform), type (pct|fixed), value,
  scope (json: products[], destinations[], supplier_plan_groups[]),
  eligibility (json), stacking_policy, max_total_uses, max_per_customer, valid_from, valid_until,
  cost_absorption (platform|owner_vendor)

discount_redemption
  id, code_id, order_id, customer_id, applied_amount, applied_at,
  cost_attributed_to_vendor_id  -- nullable = platform-absorbed

sale_attribution
  id, order_id, attributed_vendor_id (nullable = platform), tier_at_sale, parent_vendor_id_at_sale,
  attribution_source (storefront|referral_link|discount_code|direct),
  attribution_signals (json: array of weaker signals seen),
  captured_at  -- immutable

attribution_session
  id, customer_token (cookie/local), referral_vendor_id, set_at, expires_at
```

---

## 9. Edge cases

### 9.1 Parent suspension/termination cascade

- Tier-1 suspended → all tier-2 children **auto-suspended** with a **7-day reparenting window** (admin-configurable).
  - During the window, the admin can re-parent any tier-2 to another tier-1, preserving the tier-2's customer base and history.
  - After window expires unresolved, tier-2s remain suspended until admin acts.
- Tier-1 terminated → identical cascade, but at end of window unresolved tier-2s also terminate (orders honored to fulfillment, no new sales).

### 9.2 Re-parenting tier-2

- Requires: old parent's release (or admin-forced release if old parent suspended/terminated) **and** new parent's accept **and** admin approval.
- New parent's envelope replaces old envelope effective forward. Existing open orders honored at the original price; new orders use new envelope.
- **Past attribution remains with old parent.** Phase 6 commission for past sales is unaffected.

### 9.3 Pricing cascade — tier-1 lowers price below tier-2 floor

- Tier-2 notified at the moment the change is staged.
- **Default behavior**: tier-2 has a **24-hour window** to adjust their resale price. After window, system clamps tier-2's resale price to new ceiling, sending a final notification.
- Working default — see Q3 (could alternatively soft-warn-only-no-clamp). Validate via research issue.

### 9.4 Tier-2 selling below new effective floor

- If tier-2's current resale price drops below the new floor (because parent raised price or admin tightened envelope), **new sales are blocked** until tier-2 adjusts.
- Existing pending orders honored at original price.

### 9.5 Tier-2 wants to switch parent (voluntary)

- Tier-2 initiates request → old parent + admin notified → both must accept → switch executes per §9.2.

### 9.6 Discount + refund interaction (Phase 4 territory, but interface here)

- Refund before fulfillment: discount code redemption returned to pool (use count decremented).
- Refund after fulfillment: redemption consumed; refund amount = realized sale price (post-discount).

### 9.7 Invitation token race conditions

- Re-inviting before accept invalidates prior token (atomic). Last-issued token wins.
- Two parents trying to invite the same email simultaneously: first-write wins; second receives "already invited" error.

### 9.8 Concurrent pricing edits

- Last-write-wins with optimistic version field on `product_price_override` and `pricing_envelope`. UI surfaces a conflict warning ("price changed since you opened this view, refresh") before overwriting.

### 9.9 Tier-2 promotes a code that becomes ineligible mid-checkout

- Code expiry / limit-hit check happens **at order creation, not at code entry**. UI shows the discounted price during cart, but the final amount is the price at order creation. If invalid at creation, user sees the un-discounted price and is asked to confirm before proceeding.

### 9.10 Commission base when discount partially platform-absorbed

- Defined in §5.4. Phase 6 must read `discount_redemption.cost_attributed_to_vendor_id` to compute the per-vendor commission base correctly. **Not Phase 3's job to compute commission**; Phase 3's job is to guarantee the field is populated and immutable.

---

## 10. Open questions — Ray to weigh in

| # | Question | Spec default | Why it matters |
|---|---|---|---|
| Q1 | **Tier-3 ever?** Cap at 2 tiers permanent in v1? | Cap at 2 | If tier-3 is on the roadmap, data model needs `parent_vendor_id` as recursive ref now to avoid migration later. Current spec leaves it recursive — costs nothing extra. |
| Q2 | **Discount cost absorption default** when admin issues a global code: platform-absorbed or vendor-absorbed? | Platform-absorbed | Affects vendor margin guarantees + how aggressive platform marketing campaigns can be. |
| Q3 | **Pricing cascade behavior** when tier-1 lowers price below tier-2 floor: auto-clamp tier-2 (current default), or notify-only? | Auto-clamp after 24h | Notify-only is safer for tier-2 trust; auto-clamp is safer for catalog integrity. Validate with target tier-1 partners. |
| Q4 | **Referral attribution window** length? | 7 days | Industry norm 7-30. Affects tier-2 incentive to drive top-of-funnel marketing. |
| Q5 | **Re-parenting in v1?** Allow or defer entirely to Phase 6? | Allow with admin approval | Adds complexity to data model + UI now. Could defer the UI and keep only the field. |
| Q6 | **Tier-2 invitation approval gate** default: auto-approve or admin-manual? | Auto-approve, admin-toggleable | Auto-approve is faster onboarding; manual is safer for brand control. |
| Q7 | **FX / multi-currency display** in storefront — Phase 3 implication? | Out of scope; flagged | If yes, pricing math needs currency dimension throughout. |
| Q8 | **Vendor-account-vs-end-user-account namespace** — confirmed separate? | Separate | Affects auth design (Phase 1) and prevents email collisions. |

---

## 11. Follow-up issue plan

Phase 3 work breakdown — to be created as separate Linear issues under the Phase 3 project, with dependencies as shown. Research issues do not block implementation but should resolve before the dependent implementation issue is closed.

### Research issues (3)

| # | Title | Resolves |
|---|---|---|
| R1 | Attribution windowing: industry benchmarks & UX validation | Q4 |
| R2 | Pricing-cascade UX (tier-1 price drop reaction) — interview 2-3 tier-1 candidates | Q3 |
| R3 | Discount cost-absorption defaults — competitive scan + brief legal/compliance review | Q2 + verify no RPM issues |

### Data model issues (4)

| # | Title | Blocks | Blocked by |
|---|---|---|---|
| D1 | Schema: `vendor_account`, `vendor_invitation`, `vendor_relationship` | E1, F1, F2 | — |
| D2 | Schema: `pricing_envelope`, `product_price_override` | E2, F3, F4 | — |
| D3 | Schema: `discount_code`, `discount_redemption` | E3 | — |
| D4 | Schema: `sale_attribution`, `attribution_session` | E4 | — |

### Engine / business-logic issues (4)

| # | Title | Blocks | Blocked by |
|---|---|---|---|
| E1 | Vendor lifecycle state machine + cascade behavior | F3, F4 | D1 |
| E2 | Pricing engine (envelope enforcement, override hierarchy, validation) | F3, F4 | D2 |
| E3 | Discount engine (validation, stacking, scope, eligibility, floor protection) | F3, F4 | D3 |
| E4 | Attribution engine (precedence, immutability, cookie session) | F4 | D4 |

### Flow / UI issues (4)

| # | Title | Blocked by |
|---|---|---|
| F1 | Tier-1 invitation flow (admin → tier-1) | D1, E1 |
| F2 | Tier-2 invitation flow (tier-1 → tier-2, optional admin gate) | D1, E1 |
| F3 | Admin console: vendor management + global override controls | D1, D2, D3, E1, E2, E3 |
| F4 | Vendor portal: pricing config, discount code creation, sales report | D1-D4, E1-E4 |

### Acceptance test issue (1)

| # | Title | Blocked by |
|---|---|---|
| Q1 | Edge case acceptance test suite (parent suspension cascade, price floor breach, refund attribution, etc.) | F1, F2, F3, F4 |

Total: **16 follow-up issues** under the Phase 3 project.

---

## 12. Changelog

- **v0.1 — 2026-05-13** — Initial draft per ROA-16. Ray review pending.
