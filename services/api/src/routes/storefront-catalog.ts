// One definition of "this product can actually be sold on the storefront".
//
// `GET /storefront/products` only ever returns a product that survives three
// inner joins (mapping → supplier plan → supplier) plus a set of enabled /
// available flags. `/readyz` originally answered a *different* question —
// `count(*) FROM product WHERE publication_state = 'published'` — so a catalog
// whose products had all lost their supplier mapping, or whose plans were all
// marked unavailable by a bad sync, reported `catalog: pass` while every
// storefront request came back empty. That is the same class of blind spot the
// 2026-09 outage was made of, one layer down.
//
// Both call sites now build their FROM and WHERE from this module, so the
// readiness answer cannot drift away from what the route actually serves.

import { and, arrayOverlaps, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";

import type { Db } from "../db/client.js";
import schema from "../db/schema/index.js";

/** The only supplier the storefront fulfils through today. */
export const STOREFRONT_SUPPLIER_CODE = "fastmove";

export interface ServableProductFilter {
  /**
   * ISO codes the caller asked for. Omitted means "servable for *some*
   * destination", which is the readiness question rather than the browse one.
   */
  destinations?: string[];
  /** Dev preview: skip the publication-state filter entirely. */
  includeDrafts?: boolean;
  /** Raw `days` query parameter; non-numeric values are ignored. */
  days?: string | number | null;
}

/**
 * Attach the supplier chain a storefront product is only real with.
 *
 * Requires a `$dynamic()` select rooted at `roam_poc.product`. The cast is
 * drizzle's documented cost of a reusable query fragment: `innerJoin` widens
 * the builder's type parameters, and the caller only ever reads the explicit
 * column selection it passed in, which the joins do not change.
 */
export function joinSupplyChain<T extends PgSelect>(qb: T): T {
  return qb
    .innerJoin(
      schema.productSupplierMapping,
      eq(schema.productSupplierMapping.productId, schema.product.id),
    )
    .innerJoin(
      schema.supplierPlan,
      eq(schema.supplierPlan.id, schema.productSupplierMapping.supplierPlanId),
    )
    .innerJoin(
      schema.supplier,
      eq(schema.supplier.id, schema.supplierPlan.supplierId),
    ) as unknown as T;
}

/** The WHERE clause that decides whether a product is offerable at all. */
export function servableProductConditions(
  filter: ServableProductFilter = {},
): SQL[] {
  const destinations = filter.destinations ?? [];
  const conditions: SQL[] = [
    destinations.length > 0
      ? // Any requested ISO appears in the product's marketing_destinations.
        // Drizzle's `arrayOverlaps` emits `&&` with proper text[] binding (a
        // raw sql tag doesn't auto-cast a JS string[] to a postgres array).
        arrayOverlaps(schema.product.marketingDestinations, destinations)
      : // No destination asked for: the product must still be reachable by
        // *some* request. An empty marketing_destinations array can never
        // overlap anything, so such a product is not part of a live catalog.
        sql`cardinality(${schema.product.marketingDestinations}) > 0`,
    eq(schema.productSupplierMapping.enabled, true),
    eq(schema.supplierPlan.available, true),
    eq(schema.supplierPlan.adminEnabled, true),
    eq(schema.supplier.code, STOREFRONT_SUPPLIER_CODE),
  ];

  // By default exclude archived; drafts stay visible during the pre-launch
  // window so ops can preview without publishing each SKU.
  if (!filter.includeDrafts) {
    conditions.push(
      inArray(schema.product.publicationState, ["draft", "published"] as never[]),
    );
  }

  if (filter.days !== undefined && filter.days !== null && filter.days !== "") {
    const n = Number(filter.days);
    if (Number.isFinite(n)) {
      conditions.push(eq(schema.product.validityDays, Math.trunc(n)));
    }
  }

  return conditions;
}

/** The readiness count, unexecuted — exported so a test can read its SQL. */
export function servableProductCountQuery(db: Db) {
  return joinSupplyChain(
    db
      .select({ n: sql<number>`count(DISTINCT ${schema.product.id})::int` })
      .from(schema.product)
      .$dynamic(),
  ).where(and(...servableProductConditions()));
}

/**
 * How many distinct products the storefront could serve right now, using the
 * exact predicate `/storefront/products` uses. `/readyz` reports this.
 */
export async function countServableProducts(db: Db): Promise<number> {
  const rows = await servableProductCountQuery(db);
  return Number(rows[0]?.n ?? 0);
}
