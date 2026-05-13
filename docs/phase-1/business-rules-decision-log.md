# Business rules — decision log

Status: draft, Phase 1 (product spec & domain model)
Owner: Ray
Scope: companion document to ROA-20 (domain), ROA-21 (roles), ROA-22 (lifecycle).
Purpose: separate what is already settled from what is still an assumption or an unanswered product question, so deeper planning (Phase 2+) starts on a known footing.

## Status legend

- ✅ **Confirmed** — explicit in the Phase 1 project scope or the parent / sibling issues. Treat as a fixture for downstream design.
- 🟡 **Assumption** — implied by the model and adopted as a working default. Reasonable, but not yet validated by Ray. Downstream design can rely on it provisionally; reversal is acceptable in Phase 1.
- ❓ **Open question** — a real product decision still owed. Must be answered before the relevant area is detailed in Phase 2.

---

## 1. Confirmed business rules

These come straight from the project description and ROA-14 / 20 / 21 / 22 scopes.

| # | Rule | Source |
|---|---|---|
| C1 | The platform has four actor classes: **platform admin**, **tier-1 vendor admin**, **tier-2 vendor admin**, **end user**. A separate **support** role exists for ops, with no commercial relationship. | Project scope, ROA-21 |
| C2 | The commercial model has five legs in order: **supplier sourcing → product packaging → downstream distribution → discount usage → commission flow**. | Project scope |
| C3 | The domain spans these canonical entities: **supplier, vendor, product, order, fulfillment, redemption, discount, commission, payout, refund**. | ROA-20 |
| C4 | Some data is **platform-owned**, some is **vendor-scoped**. Ownership boundaries must be explicit in the schema. | ROA-20, ROA-21 |
| C5 | The end-user lifetime ends in **eSIM redemption** (purchase OR code redemption are both legitimate entry paths). | Project scope, ROA-22 |
| C6 | Distribution is **two-tier**: tier-1 vendors and tier-2 vendors are distinct roles with different ownership boundaries. A flat single-tier reseller model is out of scope. | ROA-21 |
| C7 | The lifecycle has explicit states for product, order, fulfillment, eSIM delivery, redemption, refund, and payout readiness — i.e. each of these is a first-class workflow, not a flag on the order. | ROA-22 |
| C8 | Sensitive actions are auditable; some require elevated privilege. | ROA-21 |

## 2. Working assumptions (provisional defaults)

Adopt these unless / until Ray overrides. Each is the lowest-risk default that keeps the domain model coherent.

| # | Assumption | Why this default | Where it bites if wrong |
|---|---|---|---|
| A1 | **Products are platform-owned.** Vendors distribute platform-curated products, not vendor-authored ones. | Project scope says "supplier sourcing, product packaging" sits on the platform side. | If vendors can package their own products, `product.owner` is no longer a constant — schema and pricing model change. |
| A2 | **Tier-2 vendors have exactly one tier-1 parent.** Vendor hierarchy is a tree, not a graph. | Commission attribution is unambiguous; matches typical 2-tier MLM/reseller models. | If a tier-2 can have multiple tier-1 parents, commission split must be per-relationship, not per-vendor. |
| A3 | **Commissions settle as cash payouts.** Not platform credit. | The `payout` entity is named separately from `commission`. | If commissions are credit-only, the `payout` entity collapses into a wallet model. |
| A4 | **Discounts can be issued by both platform and vendors.** The fact that "discount ownership" is called out as a question implies multiple possible owners. | The issue scope explicitly singles out "discount ownership" as a policy decision. | If only the platform can issue discounts, the vendor-discount permission story disappears. |
| A5 | **Redemption is 1:1 with a fulfilled order or a redeemed code.** No partial redemption in Phase 1. | Simplifies the redemption / refund state machines. | Bulk codes or pooled allowances need a separate `redemption_unit` concept. |
| A6 | **Refunds attach to the order, not the redemption.** Post-activation refunds are a policy edge case, not the default path. | Aligns with how upstream eSIM suppliers usually behave. | Per-day pro-rated refunds need redemption-level accounting. |
| A7 | **Single settlement currency in Phase 1.** Multi-currency pricing, commission, and payout are out of scope. | Phase 1 spec is about clarity, not breadth. Currency is the cleanest seam to defer. | If international vendors ship in Phase 1, this leaks into pricing, commission, and FX. |
| A8 | **Tier-1 vendors can also sell directly to end users.** Otherwise tier-1 is a pure wholesaler with no storefront, which contradicts the "tier-1 vendor admin" role having user-facing concerns in ROA-21. | If tier-1 can never sell direct, commission attribution simplifies but role spec needs rewriting. |
| A9 | **Phase 1 does not commit to specific upstream supplier APIs.** Suppliers exist in the model but concrete integrations are deferred. | Avoids scope creep; integrations are a Phase 2+ concern. | A supplier with hard refund / activation constraints could retroactively force a redemption-state redesign. |
| A10 | **End users have accounts.** Anonymous redemption (no account) is not supported in Phase 1. | Required for refunds, support, and re-delivery of activation codes. | If guest redemption is required (e.g. gifting use case), the identity model shifts. |
| A11 | **One order ⇒ one product line.** No multi-product carts in Phase 1. | Matches the "eSIM as a unit" framing. | A real cart needs order_items, per-line discounts, and split fulfillment. |

## 3. Open product questions

Grouped by policy area, mirroring the issue scope. Each question is one product decision Ray owns. Default answers are suggested in italics where a sensible default exists; mark as 🅰 (assumed default) or 🆁 (genuinely undecided).

### 3.1 Discount ownership

| # | Question | Default |
|---|---|---|
| Q1 | Who can **create** a discount — platform admin, tier-1, tier-2, or all three? | 🅰 platform + tier-1 (tier-2 can apply, not create) |
| Q2 | When a vendor-issued discount is used, **who absorbs the cost** — issuer's margin, parent's margin, platform, or split? | 🆁 |
| Q3 | Can a **platform-issued discount stack** with a **vendor-issued discount**? If yes, application order? | 🅰 not stackable in Phase 1 |
| Q4 | What dimensions does a discount carry — **per-user cap, total cap, expiry, geography, product restriction**? | 🅰 expiry + total cap + product restriction; geography deferred |
| Q5 | Are discounts **public codes** (shareable string) or **personal grants** (bound to a user)? Both? | 🅰 both, with `discount_kind` enum |

### 3.2 Commission attribution

| # | Question | Default |
|---|---|---|
| Q6 | When a customer enters via a tier-2 storefront, is commission **tier-2 only** or **split tier-1 ⇄ tier-2**? | 🆁 leans split, but split ratio is the decision |
| Q7 | **Attribution window**: last-touch link, first-touch link, or platform-default referral? What's the cookie / token TTL? | 🆁 |
| Q8 | If a discount code owned by **tier-1** is used on a **tier-2** storefront, who is credited? | 🆁 leans tier-1 (issuer wins) but conflicts with storefront attribution |
| Q9 | Commission computed on **gross sale price** or **net of discount**? | 🅰 net of discount |
| Q10 | **Payout cadence** — monthly, on-demand above threshold, or vendor-configurable? **Minimum payout** amount? | 🆁 |
| Q11 | Are commissions **reversed on refund**? If so, within what window, and what if the payout already cleared? | 🅰 reversed within payout window; clawback as negative balance after |

### 3.3 Refunds

| # | Question | Default |
|---|---|---|
| Q12 | Can the customer **self-refund** before activation? Requires approval after activation? | 🅰 self-refund pre-activation; vendor approval post-activation |
| Q13 | Are refunds allowed **after activation**? Pro-rated by unused data/time, or voided entirely? | 🆁 |
| Q14 | **Who absorbs** the refund cost if the upstream supplier won't refund (e.g. eSIM already activated)? Platform, vendor, or split? | 🆁 |
| Q15 | Refund **method** — original payment, platform credit, or vendor's choice? **SLA** for the refund? | 🅰 original payment, SLA = 7 business days |
| Q16 | Are **partial refunds** modeled (e.g. partial data plan consumed)? | 🅰 not in Phase 1 |

### 3.4 Vendor invitations

| # | Question | Default |
|---|---|---|
| Q17 | Who can invite **tier-2 vendors** — only the parent tier-1, or also platform admin? | 🅰 both (platform-admin invitation produces a tier-2 without a tier-1 parent — see Q18) |
| Q18 | If platform admin invites a tier-2 directly (no tier-1 parent), does the **vendor tree become a forest**? Is that allowed? | 🆁 |
| Q19 | Does a tier-2 invitation require **platform-admin approval** before becoming active? | 🅰 no approval if invited by tier-1; auto-active. Approval if external/email-cold invitation. |
| Q20 | Can a tier-2 be **re-parented** to a different tier-1 post-activation? What happens to **existing commission attribution** and pending payouts? | 🆁 |
| Q21 | Can a vendor be **deactivated mid-cycle**? What happens to pending payouts, in-flight eSIMs sold under their account, and their issued discount codes? | 🆁 |
| Q22 | **KYC / KYB** requirements for vendor onboarding (esp. for payouts and tax reporting)? | 🆁 must be answered before any real-money payout ships |

### 3.5 Redemption constraints

| # | Question | Default |
|---|---|---|
| Q23 | Does a redemption code **expire**? Default TTL? Per-product or per-discount configurable? | 🅰 expires; default 12 months from issue; configurable per product |
| Q24 | Is a redemption code **single-use** or can it be redeemed N times (e.g. bulk corporate codes)? | 🅰 single-use in Phase 1; bulk = N separate codes |
| Q25 | Can a redemption code be **transferred** between users (e.g. gifted)? | 🅰 yes, pre-redemption only |
| Q26 | **Identity required for redemption** — email, phone, account? Anonymous redemption supported? | 🅰 account required (see A10) |
| Q27 | **Geographic restrictions** on redemption (e.g. EU-only plans, country blocks on supplier side)? | 🆁 |
| Q28 | What happens if the **upstream supplier fails to provision** the eSIM during redemption — auto-retry, fallback supplier, manual ops queue? | 🆁 |
| Q29 | Can the same eSIM (after activation) be **re-issued** to the same customer (lost-device case)? Policy and supplier compatibility? | 🆁 |

---

## 4. Cross-phase dependencies

Decisions in Phase 1 that constrain or unblock work in later phases. Each line is a seam that needs early alignment.

| # | Dependency | Affects |
|---|---|---|
| D1 | **Tax & invoicing** — discount and commission policy drives VAT / withholding / 1099-style reporting. | Phase 2 finance / billing scope; vendor KYB (Q22). |
| D2 | **Settlement & accounting schema** — payout cadence (Q10) and commission reversal (Q11) dictate the bookkeeping ledger model. | Phase 2 backend/data; potentially picks an existing accounting integration. |
| D3 | **Supplier API surface** — refund (Q12–14), activation failure (Q28), and re-issue (Q29) handling all depend on what each supplier supports. Phase 1 should at minimum enumerate the **supplier capability matrix** as a placeholder. | Phase 2 integrations; supplier procurement. |
| D4 | **Identity & auth** — A10 (accounts required) constrains the auth design. If anonymous redemption is added later, auth must support upgrade-on-account-creation. | Phase 2 auth design; redemption UX. |
| D5 | **Audit trail model** — C8 (auditable sensitive actions) needs a shared `audit_event` shape defined in the domain model (ROA-20), not bolted on per feature. | All Phase 2 backend work touching vendor / payout / refund. |
| D6 | **Multi-currency seam** — A7 defers it, but the price / commission / payout schemas should still leave room (e.g. amount + currency, not bare numeric). | Phase 2 internationalization, FX. |
| D7 | **Notification touchpoints** — redemption success, redemption failure, refund issued, payout sent, commission accrual, vendor invitation — each is a notification. Phase 1 spec should enumerate them so Phase 2 doesn't reinvent. | Phase 2 notification / messaging design. |
| D8 | **Attribution token format** — Q7 (last-touch vs first-touch) determines whether the link/cookie carries a vendor ID, an order intent ID, or both. Defining this loosely in Phase 1 creates rework later. | Storefront frontend; commission integrity. |

---

## 5. Follow-up actions

The unresolved items above translate cleanly into five product-decision tickets and a Phase 2 planning input. Each bundle is sized to one focused Ray review session.

| Bundle | Questions | Suggested follow-up issue |
|---|---|---|
| Discount policy | Q1 – Q5 | "Define discount policy: ownership, stacking, cost absorption, dimensions" |
| Commission attribution | Q6 – Q11 | "Define commission attribution: touch model, split rules, payout cadence, refund reversal" |
| Refund policy | Q12 – Q16 | "Define refund policy: pre/post activation, supplier cost absorption, partial refunds" |
| Vendor lifecycle | Q17 – Q22 | "Define vendor onboarding & lifecycle: invitation, approval, re-parenting, KYC" |
| Redemption code | Q23 – Q29 | "Define redemption code spec: expiry, single-use, transfer, identity, geo, failure handling" |
| Cross-phase seams | D1 – D8 | Feed into Phase 2 kickoff issue (one section per seam) |

Recommendation: **do not create these five issues yet**. They depend on Ray's first-pass answers on the genuinely undecided (🆁) items in §3, otherwise we'd be creating issues whose default answers are already mostly settled. Suggest Ray reviews the 🆁 items here first; once those are pinned, we can collapse this log into the five tickets above and close ROA-23.

---

## Appendix: relationship to sibling issues

This log is **the open-questions companion** for the other three Phase 1 specs:

- **ROA-20 (domain model)** — every entity it specifies (product, order, redemption, discount, commission, payout, refund) shows up in §1–§3 of this log. Modeling decisions called out here (A1 ownership, A2 vendor tree, A5 redemption granularity, A11 single-line orders) directly constrain ROA-20's schema proposal.
- **ROA-21 (roles & permissions)** — open questions Q17–Q22 (vendor invitation, approval, re-parenting, deactivation, KYC) are the permission-model questions ROA-21 will need to resolve. Q1 (who can create discounts) and Q12 (who can approve refunds) are also role decisions.
- **ROA-22 (lifecycle)** — Q12–Q16 (refund states), Q23–Q24 (redemption code lifecycle), Q28 (provisioning failure) are state-machine questions ROA-22 must answer.

When the sibling issues converge, this log should be re-read as a checklist: every 🆁 item must be either answered, deferred with a written rationale, or escalated to a Phase 2 decision.
