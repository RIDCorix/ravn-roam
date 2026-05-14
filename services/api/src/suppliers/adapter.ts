/**
 * SupplierAdapter SPI — Phase 2 §9.1 (Catalog Architecture).
 *
 * One adapter per upstream eSIM supplier. Adapters are looked up at runtime
 * via {@link AdapterRegistry} keyed by `supplier.code` (the DB column).
 *
 * Scope of this file:
 *   - Phase 2: `listPlans` + `getPlan` produce `RawPlan` rows that map 1:1 to
 *     the `supplier_plan` table (see services/api/src/db/schema/supplier-plan.ts).
 *   - Phase 4: `createOrder` / `cancelOrder` / `getOrderStatus` will be filled
 *     in by ordering work — declared here so the SPI is stable up-front.
 */

import { supplierPlanActivationPolicy, supplierPlanDeliveryModel } from "../db/schema/_schema.js";

// Narrow string unions derived from the pg enums. Drizzle's `pgEnum` carries
// `.enumValues` at runtime, so we mirror them here as types to keep the
// adapter layer in lock-step with the schema without re-listing the values.
export type ActivationPolicy = (typeof supplierPlanActivationPolicy.enumValues)[number];
export type DeliveryModel = (typeof supplierPlanDeliveryModel.enumValues)[number];

/**
 * Adapter-emitted shape of an upstream plan. Mirrors the writable fields of
 * `supplier_plan` (db-managed columns — `id`, `supplier_id`, timestamps —
 * are filled in by the sync job, not the adapter).
 *
 * `costAmount` is `string` because Postgres `numeric` round-trips through
 * `drizzle-orm/postgres-js` as string; keeping it as string here avoids a
 * silent precision loss when sync code writes it back.
 */
export interface RawPlan {
  externalId: string;
  name: string;
  /** ISO 3166-1 alpha-2 codes. Regional plans carry many. */
  destinations: string[];
  /** Optional per-country MNO hints. Pass-through to jsonb column. */
  networkOperators: Record<string, unknown>;
  /** `-1` means unlimited per `supplier_plan` schema convention. */
  dataAmountMb: number;
  validityDays: number;
  activationPolicy: ActivationPolicy;
  deliveryModel: DeliveryModel;
  costAmount: string;
  /** ISO 4217. Most upstreams quote a single currency; Fastmove is TWD. */
  costCurrency: string;
  available: boolean;
  inventoryHint: number | null;
  /** Verbatim upstream payload — survives field renames upstream. */
  rawPayload: Record<string, unknown>;
}

// --- Phase 4 ordering surface (declared, not implemented) -------------------

export interface OrderContext {
  /** Our internal order id — passed through to the upstream as `orderId`. */
  orderId: string;
  qty: number;
  /** Adapter-specific extras (e.g. shipping address for physical SIM). */
  meta?: Record<string, unknown>;
}

export interface OrderResult {
  externalOrderId: string;
}

export interface OrderStatus {
  state: "pending" | "completed" | "failed" | "unknown";
  detail?: string;
}

// --- The interface ---------------------------------------------------------

export interface SupplierAdapter {
  /** Matches `supplier.code` in the DB; used as registry key. */
  readonly code: string;

  /**
   * Stream every plan in the upstream catalogue. Implementations MAY page
   * internally; callers should treat the iterator as authoritative for "what
   * is buyable today". Throws on upstream rate-limit / 5xx.
   */
  listPlans(): AsyncIterable<RawPlan>;

  /**
   * Look up a single plan by its upstream id. Returns `null` if the plan
   * does not exist or has been retired upstream.
   */
  getPlan(externalId: string): Promise<RawPlan | null>;

  // Optional Phase-4 ordering surface. Adapters that have not yet been wired
  // for ordering simply leave these undefined; the ordering service checks
  // their presence at runtime rather than blanket-implementing throw-stubs.
  createOrder?(planId: string, ctx: OrderContext): Promise<OrderResult>;
  cancelOrder?(orderId: string): Promise<void>;
  getOrderStatus?(orderId: string): Promise<OrderStatus>;
}

// --- Registry --------------------------------------------------------------

/**
 * Lookup-by-`supplier.code`. Registration is single-shot per code to surface
 * duplicate-registration mistakes immediately rather than silently routing
 * orders to the wrong upstream.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, SupplierAdapter>();

  register(adapter: SupplierAdapter): void {
    if (this.adapters.has(adapter.code)) {
      throw new Error(
        `SupplierAdapter already registered for code "${adapter.code}"`,
      );
    }
    this.adapters.set(adapter.code, adapter);
  }

  get(code: string): SupplierAdapter | undefined {
    return this.adapters.get(code);
  }

  require(code: string): SupplierAdapter {
    const adapter = this.get(code);
    if (!adapter) {
      throw new Error(`no SupplierAdapter registered for code "${code}"`);
    }
    return adapter;
  }

  codes(): string[] {
    return [...this.adapters.keys()];
  }
}
