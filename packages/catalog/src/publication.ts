// Publication-state machine from the Phase 2 Catalog regulation doc §4.
//
//   draft  ──submit──▶  in_review  ──approve──▶  published  ──archive──▶  archived
//     │                     │                       │  ▲
//     │                     └───reject──────────────┘  │
//     │                                                │
//     └───skip-review (admin 自營) ────────────────────┘
//
// Phase 2's open question #7 leaves `in_review` optional for platform-owned
// products. `skipReview` collapses the path to draft → published.

import type { Product, ProductPublicationState } from "./types";

export type PublicationTransition =
  | "submit"
  | "approve"
  | "reject"
  | "publish"
  | "archive"
  | "unarchive";

// Map of (state) → (transition) → next state. `null` means the transition is
// not allowed from this state.
type TransitionTable = Record<
  ProductPublicationState,
  Partial<Record<PublicationTransition, ProductPublicationState>>
>;

const TABLE: TransitionTable = {
  draft: {
    submit: "in_review",
    publish: "published",
  },
  in_review: {
    approve: "published",
    reject: "draft",
  },
  published: {
    archive: "archived",
  },
  archived: {
    unarchive: "draft",
  },
};

export interface TransitionResult {
  ok: boolean;
  from: ProductPublicationState;
  to?: ProductPublicationState;
  reason?: string;
}

export function tryTransition(
  from: ProductPublicationState,
  action: PublicationTransition,
): TransitionResult {
  const next = TABLE[from][action];
  if (!next) {
    return {
      ok: false,
      from,
      reason: `Cannot ${action} from ${from}`,
    };
  }
  return { ok: true, from, to: next };
}

export function allowedTransitions(
  from: ProductPublicationState,
): PublicationTransition[] {
  return Object.keys(TABLE[from]) as PublicationTransition[];
}

// "What can a user edit on a published product?" — regulation doc §4 末段.
//
// Published products freeze most fields to protect price / fulfilment
// promises; the customer's mental model of "this is the product I'm buying"
// must not silently change. The allow-list below is the only mutation path.
//
// `lockField(state, field)` returns `true` when the field is read-only in
// the admin UI. The API enforces the same predicate before writing.
const PUBLISHED_EDITABLE: ReadonlySet<keyof Product> = new Set([
  "display_name_i18n",
  "description_i18n",
  "media",
  "tags",
  "sales_window_end",
  "purchase_cap_per_user",
  "purchase_cap_total",
  // operational_state is mutable too but admins flip it through dedicated
  // suspend / resume actions, not the generic edit form.
  "operational_state",
]);

export function isFieldLocked(
  state: ProductPublicationState,
  field: keyof Product,
): boolean {
  if (state !== "published") return false;
  return !PUBLISHED_EDITABLE.has(field);
}

// "Can the user even attempt a PATCH on this product?" — true for every
// state except archived (archived is terminal; admin must unarchive first).
export function isProductEditable(state: ProductPublicationState): boolean {
  return state !== "archived";
}

// Mappings: §4 末段 "published 之後不允許改 mapping primary、cost-affecting
// 欄位". We freeze ALL mapping mutations on published products — even
// fallback edits — because reordering changes which plan fulfils which
// order, which is itself a cost change. Phase 3 may relax this for tier-1
// vendors who can hot-swap fallbacks.
export function areMappingsLocked(state: ProductPublicationState): boolean {
  return state === "published" || state === "archived";
}

// Pricing freeze — same logic as mappings, since `pricing.cost_snapshot`
// pins to the primary plan at publish time.
export function isPricingLocked(state: ProductPublicationState): boolean {
  return state === "published" || state === "archived";
}
