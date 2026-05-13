# Phase 3 — Pricing controls & resale constraints

> **Status**: Draft v0.1 — ROA-69. Companion deep-dive to `commercial-model.md` §4, §7, §9. Once Ray approves, this doc is the implementation-ready behavior spec for the pricing engine (E2 / ROA-35), pricing schema (D2 / ROA-28), and the related admin + vendor UIs (F3 / ROA-46, F4 / ROA-49).
> **Relation to umbrella**: `commercial-model.md` is the system-level overview of the multi-tier commercial model. This doc takes the pricing/resale slice and makes it implementation-ready: edge cases enumerated, validation rules pinned down, data-model deltas listed, and acceptance criteria spelled out. Where this doc and the umbrella disagree, **this doc wins for pricing/resale; umbrella wins for everything else**.
> **Out of scope**: discount-code semantics (see ROA-68 + umbrella §5), sales attribution (see umbrella §6), commission math (Phase 6).

---

## 1. Goals

A tier-1 or tier-2 vendor opening a product detail page should be able to answer four questions without ambiguity:

1. **Can I sell this product at all?** (product access)
2. **What is the lowest price I can sell it for?** (floor)
3. **What is the highest price I can sell it for?** (ceiling)
4. **If my parent or admin changes their settings, what happens to my catalog and my live prices?** (cascade)

Likewise, a platform admin should be able to express:

1. Per-tier-1 envelopes and supplier-plan access.
2. Per-product hard overrides for incident response.
3. Contract-specific exceptions for individual vendors without violating the global envelope model.

If implementation cannot answer all of the above from the schema and the engine alone, the spec is incomplete — re-open this doc.

---

## 2. Pricing freedom by tier

### 2.1 Platform admin

- Sets supplier cost (Phase 2 catalog; immutable from Phase 3's perspective per-purchase).
- Sets the **admin → tier-1 envelope** per tier-1 vendor (or globally as a default).
- May hard-set any vendor's price (admin override, audited).
- May grant or revoke a tier-1's access to specific supplier plans (see §5.1).
- May issue platform-wide discount codes (out of scope for this doc; see ROA-68).
- May define **contract-specific exceptions** (see §6.2).

### 2.2 Tier-1 vendor

- Within the admin envelope: sets the **packaged product price** per product (or per category default).
- Sets the **tier-1 → tier-2 envelope** per product (or per-tier-2 default) constraining its children's resale price.
- Marks a packaged product as **non-resellable to tier-2** (see §5.2).
- Cannot price below admin floor; cannot price above admin ceiling.
- Cannot grant a tier-2 access to a product the tier-1 itself does not have access to.
- Cannot edit another tier-1's prices, envelopes, or products.

### 2.3 Tier-2 vendor

- Within the tier-1 envelope: sets the **resale price** per product (or per-category default).
- Cannot bypass the envelope. Cannot mark products non-resellable (no further sub-tier in v1).
- Cannot create a private "sub-envelope" tighter than the tier-1's envelope just to game later changes (envelope is set by the parent, not the child).
- Tier-2's "viewable products" set equals tier-1's "resellable-to-tier-2" set (see §5.2).

---

## 3. Envelope model

### 3.1 Shape

```
envelope := {
  min_markup_pct: decimal | null,
  max_markup_pct: decimal | null,
  hard_floor:     money    | null,
  hard_ceiling:   money    | null,
  currency:       iso_code,                 -- always USD in v1, see umbrella §4.5
  effective_from: timestamp,
  effective_until:timestamp | null,
}
```

- Percentage bounds apply to the **layer immediately below**: admin→tier-1 envelope is over supplier cost; tier-1→tier-2 envelope is over tier-1 packaged price.
- Either pct bound or absolute bound may be omitted; at least one of `(min_markup_pct, hard_floor)` and one of `(max_markup_pct, hard_ceiling)` must be set, otherwise the envelope is rejected.
- `effective_until = null` means open-ended.

### 3.2 Resolution to a concrete `(floor, ceiling)`

```
floor   = max( layer_below_price * (1 + min_markup_pct), hard_floor   ?? 0       )
ceiling = min( layer_below_price * (1 + max_markup_pct), hard_ceiling ?? +∞      )
```

- If `floor > ceiling` after substitution → envelope is **invalid for that product**; UI must surface to the envelope owner, and any pricing call from the vendor below is **blocked** until envelope is fixed. Block, not auto-relax — silent relaxation is how margin-protection becomes a footgun.

### 3.3 Scope precedence

An envelope can be set at any of these scopes; the **most specific applicable wins**:

1. `(vendor_id, product_id, contract_id)` — contract-specific (see §6.2).
2. `(vendor_id, product_id)` — per-product per-vendor.
3. `(vendor_id, product_category_id)` — per-category per-vendor.
4. `(vendor_id)` — vendor default.
5. `(product_id)` — global per-product (admin only).
6. `()` — global default (admin only).

### 3.4 Validation invariants

- Tier-1 envelope (admin→tier-1) **cannot have a ceiling below tier-1's already-set price**; admin must lower tier-1's price first or use admin override. Force-tighten requires explicit `--force` flag in admin tool + audit reason.
- Tier-2 envelope (tier-1→tier-2) similarly cannot have a ceiling below tier-2's already-set resale price. Default behavior follows the cascade rules in §8.
- Optimistic concurrency: every envelope row has a `version`; UI must echo the version on save (see umbrella §9.8).

---

## 4. Margin protection

### 4.1 Effective floor

For any sale, the **effective floor** is the floor of the **selling vendor's envelope** at the moment of order creation. The discount engine (ROA-38) MUST consult this floor before applying any code (umbrella §5.3 already covers this; reaffirmed here so it doesn't get lost when discount engine refactors).

### 4.2 Hard floor vs soft markup floor

- **Hard floor** is absolute money. Cannot be undercut for any reason except admin override.
- **Soft markup floor** is `layer_below_price × (1 + min_markup_pct)`. Dynamic — if the layer below moves, the soft floor moves.
- When admin issues a platform-absorbed discount (umbrella §5.2), the realized sale price may legitimately fall below the soft floor **only if** `cost_absorption = platform`. In that case the selling vendor's reported margin is still computed against their pre-discount price (umbrella §5.4). Floor protection still rejects the order if it would drop below the **hard floor** even with platform absorption — that's a separate hard guarantee.

### 4.3 Floor breach blocks new sales

- New orders are blocked at order creation if the cart's realized vendor price < selling vendor's hard floor. UI surfaces a "this discount cannot be applied to this product at the current vendor price" error.
- Existing pending orders are honored at their captured price (already in umbrella §9.4; restated for completeness).

---

## 5. Product access rules for child vendors

This section is the **new load-bearing content** that the umbrella spec only hinted at.

### 5.1 Supplier plan access (admin → tier-1)

- Platform admin grants each tier-1 access to a **subset of supplier plans** (Phase 2 catalog). Default for a new tier-1 is **empty** — admin must explicitly grant. Empty access ≠ disabled vendor; it just means the tier-1 has no inventory to package yet.
- Granting is at supplier-plan granularity. A tier-1 cannot package a plan it does not have access to. Catalog UI hides ungranted plans from the tier-1's view (no leakage).
- Revocation: existing packaged products built from the revoked plan are flagged `inventory_unavailable` and removed from storefront, but **existing orders for that product still fulfill** (Phase 4 fulfillment honors the order). Tier-1 sees a clear "your access to plan X was revoked on YYYY-MM-DD, depack or replace upstream within 30 days" notice.
- This is stored as `vendor_supplier_plan_access` (see §10).

### 5.2 Resellability (tier-1 → tier-2)

- Each tier-1 packaged product has a boolean `resellable_to_tier_2` (default **true**). If false, the product is invisible to all of that tier-1's tier-2 children. Tier-2 cannot create resale prices, see the product in their catalog, or refer customers to it.
- Tier-1 may flip a product from `true` to `false` at any time. Effect on already-priced tier-2 resale rows: rows are marked `dormant` (not deleted); if flipped back to `true`, the dormant row is reactivated unchanged.
- Existing tier-2 orders for the product continue to fulfill (Phase 4).
- Tier-1 may set the flag per-tier-2 (whitelist or blacklist mode, mutually exclusive per product) for finer control. Default mode is "all-children" (single boolean as above). Per-tier-2 mode requires an explicit toggle and is logged in audit. See §10 schema.

### 5.3 Inheritance & defaults

- A new tier-2 inherits **the full set** of its parent's `resellable_to_tier_2 = true` products. No opt-in step; if tier-1 doesn't want a new tier-2 to access a product, it flips the flag first.
- A new tier-2 has **no resale prices set** initially; sales are blocked until tier-2 sets a resale price for each product they want to sell. (Inheriting prices automatically risks margin leakage — explicit set is safer.)

### 5.4 Catalog visibility cascade

```
admin sees:    every supplier plan, every packaged product
tier-1 sees:   supplier plans where vendor_supplier_plan_access exists
                + own packaged products
                + (no visibility into other tier-1's products)
tier-2 sees:   parent tier-1's packaged products where resellable_to_tier_2 = true
                AND (mode = all-children OR tier-2 is in whitelist OR not in blacklist)
                + own resale rows
```

Tier-2 storefront customers see whatever tier-2 has priced and published — independent of the access rules above.

---

## 6. Override hierarchy

Restates umbrella §4.4 with implementation-level precision.

### 6.1 Effective sell price computation

When the pricing engine (ROA-35 / E2) is asked for the effective sell price of `(vendor, product, layer)` at a moment in time, it walks the override stack high → low:

1. **Admin emergency override** — `product_price_override` row with `layer = 'admin_emergency'`. Used for incident response (e.g. supplier mis-priced an inventory drop, must freeze sales for 12 hours). Bypasses envelope checks. Heavily audited. Requires admin role + reason string + explicit expiry timestamp.
2. **Contract-specific override** — `product_price_override` row with non-null `contract_id` matching an active contract on the vendor (see §6.2). Must satisfy the envelope unless the contract carries an `envelope_exempt = true` clause (legal flag, see ROA-26 / R3).
3. **Vendor per-product hard set** — `product_price_override` with `layer = 'tier_1_packaged' | 'tier_2_resale'` and matching vendor + product. Must satisfy the envelope.
4. **Vendor category-level rule** — markup rule scoped to a category. Must satisfy the envelope.
5. **Vendor default markup** — `default_markup_pct` on the vendor account applied to the layer below. Must satisfy the envelope.

If layers 2–5 produce a price outside the envelope, the engine **does not silently clamp**. It rejects writes at the time the vendor saves them, and rejects reads at order creation if the layer below has moved (see §8.2 cascade).

### 6.2 Contract-specific overrides

Some tier-1 vendors will sign side-contracts with the platform: e.g. "for the first 90 days, RAVN guarantees a minimum 40% markup floor on plan X regardless of admin envelope." These need to be expressible **without** mutating the global envelope.

Data model: a `vendor_contract` row carries `(vendor_id, contract_id, effective_from, effective_until, terms)`, where `terms` is a structured JSON describing the deviation. The pricing engine reads any active contract at compute time and applies it as a layer-2 override.

Allowed contract terms in v1:

| Term | Meaning |
|---|---|
| `envelope_floor_override: {product_id, hard_floor}` | Replace the soft+hard floor with this value for the duration. |
| `envelope_ceiling_override: {product_id, hard_ceiling}` | Same, for ceiling. |
| `markup_pct_guarantee: {product_id, min_markup_pct}` | Guarantee the vendor at least this markup over supplier cost. |
| `envelope_exempt: true` | Skip envelope checks entirely. **Requires legal/compliance sign-off** (R3 / ROA-26). |
| `expires_at_strict: true` | After `effective_until`, sales auto-revert to global envelope. Vendor notified 7 days in advance. |

Contracts cannot be created by vendors — only admin, with a stored PDF link to the signed agreement and a reason. Audit entry per write.

### 6.3 Admin emergency override

Hard cap on duration: max 7 days, then it auto-expires. Re-issuable. Logged. Blocks normal writes from the affected vendor during the override window (the vendor sees a banner explaining the freeze).

---

## 7. Resale constraints summary

A compressed reference for the implementation team:

| Constraint | Where enforced | Failure mode |
|---|---|---|
| Tier-2 can only see products with `resellable_to_tier_2 = true` (with per-tier-2 mode overrides) | Catalog query layer (PostgREST / API gateway) | Product invisible; order request 404. |
| Tier-1 can only package supplier plans in `vendor_supplier_plan_access` | Catalog admin layer | "Plan not available" error on package create. |
| Resale price must satisfy parent tier-1 envelope | `EnvelopeValidator.canSet` (ROA-35) | Write rejected with `envelope_violation` error. |
| Discount cannot drop realized vendor price below hard floor | `DiscountService.validate` (ROA-38) | Order creation rejected with `floor_breach` error. |
| Admin override bypasses envelope but logs reason | Pricing engine path | Audit row required; writes without reason rejected. |
| Past attribution unaffected by product becoming non-resellable | `sale_attribution` immutability | Re-parenting/flag changes are forward-only (umbrella §6.2 + §9.2). |
| New tier-2 has zero resale prices until explicit set | Default behavior in vendor onboarding | Sales blocked for unpriced products; banner explains. |

---

## 8. Pricing cascade & change propagation

### 8.1 Tier-1 raises its packaged price

- Tier-2 resale envelope is **floor-anchored to tier-1 price** (via min_markup_pct or hard_floor relative to tier-1 price). If tier-2's set resale price now falls below the new floor → tier-2's resale is **clamped to the new floor automatically**, tier-2 notified. (Different from §8.2 — raising the bottom of the envelope is non-controversial.)
- Tier-2 ceiling moves up but tier-2's resale price doesn't unless tier-2 acts.
- Existing open orders unaffected (price captured at order creation).

### 8.2 Tier-1 lowers its packaged price below tier-2's floor

This is the case umbrella §9.3 + R2 (ROA-25) covers. Two candidate behaviors:

- **Auto-clamp** (working default): Tier-2 notified at staging. 24-hour window to react. After window, system clamps tier-2's resale price to the new ceiling.
- **Notify-only**: Tier-2 notified, no auto-clamp. Tier-2's resale price stays where it is, which may now exceed the tier-1 ceiling, blocking new sales (§9.4 behavior).

**Decision pending R2 (ROA-25).** Spec freezes at auto-clamp unless R2 produces evidence to the contrary. Either way, the pricing engine must support both modes by config (`pricing_cascade_mode: 'auto_clamp' | 'notify_only'`). Per-tier-1 override on the mode is allowed.

### 8.3 Admin envelope tightening on a tier-1

- Same logic as §8.2 one level up. If admin tightens admin→tier-1 envelope such that tier-1's price now violates the new envelope, tier-1 is notified with a 24-hour adjustment window (same config knob).
- During the window, tier-1's price is **still valid for new sales**, to avoid a tier-1 having their storefront silently broken by an admin-side change they didn't initiate. After the window, auto-clamp applies (or notify-only per config).

### 8.4 Notification & UX

- Notification channel: vendor-portal in-app notification + email. (No SMS in v1.)
- Notification carries: change summary, prior value, new value, deadline, action button. Action button takes vendor to the affected products with an inline "accept clamp / set new price / appeal" UI. "Appeal" opens a Linear-ish ticket to admin; in v1 this is just a mailto link to ops.
- Notification is generated at envelope/price **write** time, not at the moment of clamp. Clamping fires only if vendor hasn't acted by the deadline.

### 8.5 Resellability flag changes (mid-life product → tier-2 lockout)

- Tier-1 flips `resellable_to_tier_2: true → false` for product P.
- All tier-2 resale rows for P become `dormant` (not deleted, see §5.2).
- Tier-2's published storefront listings for P are unpublished within 60 seconds (eventually consistent — async catalog cache invalidation; acceptable because storefront customers who add P to cart during the gap will hit a "product unavailable" check at checkout).
- In-flight tier-2 carts containing P at the moment of flip are invalidated at checkout, not at flip time — UX is "product no longer available, removed from cart" rather than disappearing silently.

---

## 9. Pricing-specific edge cases

> Umbrella §9 already lists 10 edge cases. The ones below are either pricing-specific refinements or **net-new** cases this deep-dive surfaces. New ones are tagged **NEW**.

### 9.1 Concurrent envelope edits — admin and tier-1 simultaneously

- Both writes carry a `version`. Whichever lands first wins; the second receives `409 conflict` with the current state. UI prompts re-merge. (umbrella §9.8 generalized)

### 9.2 Currency mixing **NEW**

- Pricing math in v1 assumes a single base currency (USD; umbrella §4.5). If a supplier plan is stored in a non-USD currency in the Phase 2 catalog, ingestion converts to USD using the FX snapshot at ingestion time. Phase 3 does **not** revalue. FX is Phase 5 storefront-display concern (umbrella Q7). The pricing engine MUST refuse to operate on rows with non-USD currency in v1, with a clear error.

### 9.3 Existing-order honoring during price change (clarification)

- Order's effective price is captured to `order.unit_price` at order creation. Pricing engine is **never re-consulted post-creation** for an existing order. Refunds (Phase 4) use the captured price, not the current price.

### 9.4 Vendor suspended mid-cart **NEW**

- A tier-2 vendor enters `suspended` while a customer has an active cart attributed to them.
- Behavior: existing cart items remain valid; checkout completes; sale is still attributed to the (now-suspended) tier-2. Tier-2 cannot fulfill new business but the in-flight order is honored. (Aligns with umbrella §9.1's "orders honored to fulfillment" cascade behavior.)

### 9.5 Product made non-resellable mid-window (cascade with §5.2)

- See §8.5. Specifically: if a tier-2 has set `resale_price` for the product and the flag flips, the resale row is marked `dormant` rather than deleted. Phase 4 fulfillment of already-placed orders unaffected.

### 9.6 Tier-2 attempts to set resale below their own admin-emergency-overridden price **NEW**

- Edge case: admin has placed an emergency override on the tier-1 packaged price (layer 1 of override stack, see §6.3). Tier-2's existing resale row may now violate the envelope (because the floor moved when admin override fired).
- Behavior: tier-2's resale stays as captured, but is **blocked for new sales** until admin override expires OR tier-2 adjusts. UI shows a banner with the cause.

### 9.7 Contract expiry **NEW**

- A `vendor_contract` with `effective_until` in the past auto-deactivates at the timestamp.
- 7 days before expiry: vendor notified.
- At expiry: pricing engine no longer reads the contract; effective price recomputes from global envelope. If recompute would invalidate existing pricing, behave per §8.2 / §8.3 (24-hour window).

### 9.8 Bulk price update partial failure **NEW**

- Vendor uploads a CSV of 1,000 product price updates. 950 are valid; 50 violate envelope.
- Behavior: **all-or-nothing transaction**. Reject the entire upload with a row-by-row error report. Rationale: partial successes leave the catalog in a state the vendor didn't intend; debugging "which 50 didn't go in" is worse than rejecting the upload.
- Vendor portal (F4) renders the error report inline. Vendor can download fixed CSV and re-upload.

---

## 10. Data model deltas

> Additions/clarifications to umbrella §8. Read alongside the umbrella table.

### 10.1 New: `vendor_supplier_plan_access`

```
vendor_supplier_plan_access
  id, vendor_id (FK vendor_account), supplier_plan_id (FK Phase 2 catalog),
  granted_at, granted_by (admin_user_id), revoked_at (nullable),
  unique (vendor_id, supplier_plan_id)
```

- Granted/revoked rows kept for audit; "active" = `revoked_at IS NULL`.

### 10.2 Delta on packaged product (Phase 2 owns the table; this is the column contract)

```
packaged_product (excerpt — Phase 2 spec owns full)
  ...
  resellable_to_tier_2          boolean default true,
  resellable_mode               enum('all_children','whitelist','blacklist') default 'all_children',
  ...
```

Plus a join table:

```
packaged_product_tier_2_access
  id, product_id (FK packaged_product), tier_2_vendor_id (FK vendor_account),
  mode_at_write enum('whitelisted','blacklisted'),
  set_by_vendor_id (FK vendor_account, must be the parent tier-1), set_at,
  unique (product_id, tier_2_vendor_id)
```

When `resellable_mode = 'whitelist'`, only `tier_2_vendor_id` rows with `mode_at_write = 'whitelisted'` see the product. Similarly for `'blacklist'`.

### 10.3 New: `vendor_contract`

```
vendor_contract
  id, vendor_id (FK vendor_account), contract_ref text,           -- internal label e.g. "RAVN-TIER1-001"
  signed_pdf_url text,                                            -- link to Drive/storage
  effective_from timestamp, effective_until timestamp,
  terms jsonb,                                                    -- structured per §6.2
  created_by_admin_id, created_at, deactivated_at (nullable)
```

### 10.4 Delta on `pricing_envelope`

Add:

```
pricing_envelope (delta to umbrella §8 spec)
  ...
  contract_id (FK vendor_contract, nullable),    -- non-null = contract-scope envelope
  ...
```

### 10.5 Delta on `product_price_override`

Add:

```
product_price_override (delta to umbrella §8 spec)
  ...
  layer enum('admin_emergency','contract','vendor_hard_set','category_rule'),
  contract_id (FK vendor_contract, nullable, required when layer='contract'),
  expires_at timestamp (nullable, required when layer='admin_emergency', max effective_from + 7 days),
  ...
```

---

## 11. Acceptance criteria

These are the behaviors that the Q1 / ROA-31 edge case test suite must cover for the pricing slice. Reference IDs map to test cases in that suite.

| # | Behavior | Reference |
|---|---|---|
| AC-P-01 | Tier-1 cannot set price outside admin envelope; engine rejects with `envelope_violation`. | §3.4, §6.1 |
| AC-P-02 | Tier-2 cannot set resale price outside tier-1 envelope; engine rejects. | §3.4, §6.1 |
| AC-P-03 | Tier-1 cannot package a supplier plan they don't have access to. | §5.1 |
| AC-P-04 | Tier-2 cannot see / order a product flagged `resellable_to_tier_2 = false`. | §5.2 |
| AC-P-05 | Tier-1 lowers price → tier-2 resale auto-clamps after 24h (per config); no in-flight orders disturbed. | §8.2 |
| AC-P-06 | Tier-1 raises price → tier-2 below new floor is auto-clamped immediately. | §8.1 |
| AC-P-07 | Admin emergency override freezes sales for 7 days, then auto-expires; vendor notified. | §6.3, §9.7 |
| AC-P-08 | Contract override with `envelope_exempt=true` requires admin role + reason + PDF link. | §6.2 |
| AC-P-09 | Discount cannot drive realized vendor price below hard floor; new sale blocked. | §4.3 |
| AC-P-10 | Bulk CSV upload with 1 invalid row rejects entire upload; renders row-by-row error. | §9.8 |
| AC-P-11 | Concurrent envelope edit returns 409 with current version; UI prompts re-merge. | §9.1 |
| AC-P-12 | Resellability flag flip → dormant tier-2 rows, in-flight orders honored, storefront delisted ≤60s. | §5.2, §8.5 |
| AC-P-13 | Vendor suspended mid-cart → existing cart completes, attribution preserved, no new orders. | §9.4 |
| AC-P-14 | Non-USD pricing rows rejected with clear error in v1. | §9.2 |
| AC-P-15 | Tier-2 inherits parent's resellable products by default but starts with **no resale prices**. | §5.3 |

---

## 12. Open questions (pricing-specific)

Carries the relevant umbrella opens and adds pricing-deep-dive ones. Marked **NEW** if not in umbrella §10.

| # | Question | Spec default | Resolves via |
|---|---|---|---|
| P1 | Cascade mode for §8.2 (tier-1 drops price below tier-2 floor): auto-clamp vs notify-only — global or per-tier-1 toggle? | Auto-clamp, global default with per-tier-1 override allowed | R2 / ROA-25 |
| P2 | Contract-specific `envelope_exempt = true` — legally allowable in TW/JP/HK/SG/EU? Specifically the resale-price-maintenance angle. | Allowed with admin + legal sign-off | R3 / ROA-26 |
| P3 | **NEW** Default `resellable_to_tier_2`: `true` (open by default, tier-1 opts products out) or `false` (closed by default, tier-1 opts in)? | `true` (opens by default) | Tier-1 partner interview during R2 — fold into ROA-25 |
| P4 | **NEW** Should admin emergency override duration cap be 7 days, 30 days, or per-incident discretion? | 7 days hard cap, re-issuable | Defer to first ops incident retro |
| P5 | **NEW** Bulk update semantics: hard all-or-nothing (§9.8), or row-level skip-with-report? | All-or-nothing | Validate with tier-1 partner who runs bulk pricing |
| P6 | **NEW** Per-tier-2 whitelist/blacklist mode for `resellable_to_tier_2` — actually needed in v1, or YAGNI? | Ship the schema, leave UI behind a feature flag | Spec freeze decision by Ray |
| P7 | umbrella Q1 (tier-3 ever?) — affects whether envelope `layer` enum stays at 2 layers or generalizes. | Stay at 2 layers; recursive `parent_vendor_id` covers future migration | Spec freeze (Ray) |
| P8 | umbrella Q7 (multi-currency) — confirms `currency` column stays USD-only in v1. | USD-only | Spec freeze (Ray) |

---

## 13. Follow-up issue plan

ROA-69's job is to make sure pricing is implementable. Most of the work is already issued under ROA-16; this section maps where pricing behavior gets implemented and identifies the gaps that need **new issues**.

### 13.1 Already-existing issues that cover this spec

| Spec section | Implementation issue | Notes |
|---|---|---|
| §3 envelope schema, §10.4 delta | **D2 — ROA-28** (pricing_envelope / product_price_override) | Extend with `contract_id` and `layer` enum per §10.4–10.5. |
| §6 override hierarchy, §8 cascade, §4 floor protection | **E2 — ROA-35** (Pricing engine) | Add cascade modes (auto-clamp vs notify-only), bulk update all-or-nothing semantics, contract override resolution. |
| §6.2 / §6.3 admin overrides UI | **F3 — ROA-46** (Admin console) | Add contract management UI (upload PDF, set terms, expire). |
| §2.3 / §5 tier-2 pricing UI, §9.8 bulk upload, §8.4 notifications | **F4 — ROA-49** (Vendor portal) | Add bulk CSV upload with row-error report, cascade notification banners. |
| §8.2 cascade UX decision | **R2 — ROA-25** | Validates P1 default. |
| §6.2 envelope_exempt legal | **R3 — ROA-26** | Validates P2. |
| §11 acceptance criteria | **Q1 — ROA-31** | Add AC-P-01..15 as test cases. |

### 13.2 New issues to open under Phase 3 (this spec surfaces them)

| Proposed | Title | Why new (not covered by existing) |
|---|---|---|
| **D5** | Schema — `vendor_supplier_plan_access`, `packaged_product_tier_2_access`, packaged_product resellability columns | New cross-cutting tables/columns; spans Phase 2 catalog table (resellable flag) and Phase 3 access tables. Needs its own migration issue. |
| **D6** | Schema — `vendor_contract` | New table for contract-specific overrides, not in umbrella §8. Includes signed-PDF link, terms JSON shape, admin-only writes. |
| **E5** | Engine — Product access entitlement check (in catalog query + cart) | Enforces §5.1/5.2/5.4. Pricing engine alone doesn't do it; the catalog read path and cart validation need explicit entitlement checks. |
| **F5** | UI — Admin grant/revoke supplier plan access to tier-1 (extend F3 or standalone) | §5.1 admin workflow. Could be a sub-task of ROA-46; standalone if scope grows. |
| **F6** | UI — Tier-1 control: per-product resellability + per-tier-2 whitelist/blacklist | §5.2. Sub-task of ROA-49 or standalone depending on P6 outcome. |

ROA-69 deliverable will create D5, D6, E5, F5, F6 as Linear issues under the Phase 3 project, all with `parent = ROA-16` and the appropriate `blocks/blockedBy` wiring.

---

## 14. Changelog

- **v0.1 — 2026-05-13** — Initial draft per ROA-69. Companion to commercial-model.md v0.1. Ray review pending.
