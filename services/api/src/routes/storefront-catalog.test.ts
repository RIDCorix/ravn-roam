/**
 * `/readyz` reporting `catalog: pass` while `/storefront/products` returns
 * nothing is the same bug as `/healthz` reporting 200 during a data-layer
 * outage, one layer down. These tests pin the predicate the two share.
 *
 * They compile SQL rather than run it — no database required.
 */

import { and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, test } from "vitest";

import schema from "../db/schema/index.js";
import {
  joinSupplyChain,
  servableProductConditions,
  servableProductCountQuery,
  STOREFRONT_SUPPLIER_CODE,
} from "./storefront-catalog.js";

// postgres-js is lazy: nothing connects until a query is awaited, and these
// tests only ever call `.toSQL()`.
const db = drizzle(postgres("postgres://u:p@127.0.0.1:1/none", { prepare: false }), {
  schema,
});

/** The SQL `/storefront/products` builds, using the shared pieces it imports. */
function productsSql(
  filter: Parameters<typeof servableProductConditions>[0] = {},
): string {
  return joinSupplyChain(
    db.select({ id: schema.product.id }).from(schema.product).$dynamic(),
  )
    .where(and(...servableProductConditions(filter)))
    .toSQL().sql;
}

describe("the servable-product predicate", () => {
  test("requires the whole supplier chain, not just a publication state", () => {
    const sql = productsSql({ destinations: ["JP"] });
    expect(sql).toContain('"roam_poc"."product_supplier_mapping"');
    expect(sql).toContain('"roam_poc"."supplier_plan"');
    expect(sql).toContain('"roam_poc"."supplier"');
    expect(sql.match(/inner join/gi)?.length).toBe(3);
    expect(sql).toContain('"product_supplier_mapping"."enabled"');
    expect(sql).toContain('"supplier_plan"."available"');
    expect(sql).toContain('"supplier_plan"."admin_enabled"');
    expect(sql).toContain('"supplier"."code"');
  });

  test("binds the supplier code and the requested destinations", () => {
    const query = joinSupplyChain(
      db.select({ id: schema.product.id }).from(schema.product).$dynamic(),
    )
      .where(and(...servableProductConditions({ destinations: ["JP", "KR"] })))
      .toSQL();
    expect(query.sql).toContain("&&");
    expect(query.params).toContain(STOREFRONT_SUPPLIER_CODE);
    // postgres-js serialises a text[] bind as a literal array.
    expect(query.params).toContain('{"JP","KR"}');
  });

  test("excludes archived products by default and includes them on request", () => {
    expect(productsSql({ destinations: ["JP"] })).toContain(
      '"publication_state"',
    );
    expect(productsSql({ destinations: ["JP"], includeDrafts: true })).not.toContain(
      '"publication_state"',
    );
  });

  test("applies a numeric days filter and ignores a junk one", () => {
    expect(productsSql({ destinations: ["JP"], days: "7" })).toContain(
      '"validity_days" =',
    );
    expect(productsSql({ destinations: ["JP"], days: "abc" })).not.toContain(
      '"validity_days" =',
    );
    expect(productsSql({ destinations: ["JP"], days: null })).not.toContain(
      '"validity_days" =',
    );
  });

  /**
   * With no destination asked for, a product that lists no marketing
   * destination can never overlap any request, so it is not servable — the
   * readiness count must not include it.
   */
  test("requires at least one marketing destination when none is requested", () => {
    expect(productsSql()).toContain("cardinality");
  });
});

describe("the /readyz catalog count", () => {
  const countSql = servableProductCountQuery(db).toSQL();

  test("counts distinct products through the same joins the route uses", () => {
    expect(countSql.sql).toContain("count(DISTINCT");
    expect(countSql.sql.match(/inner join/gi)?.length).toBe(3);
  });

  /**
   * The regression the review caught: the count used to be
   * `product WHERE publication_state = 'published'`, which passes while every
   * storefront request comes back empty.
   */
  test("uses every eligibility clause the browse query uses", () => {
    const browse = productsSql();
    for (const clause of [
      '"product_supplier_mapping"."enabled"',
      '"supplier_plan"."available"',
      '"supplier_plan"."admin_enabled"',
      '"supplier"."code"',
      "cardinality",
      '"publication_state"',
    ]) {
      expect(browse).toContain(clause);
      expect(countSql.sql).toContain(clause);
    }
    expect(countSql.params).toContain(STOREFRONT_SUPPLIER_CODE);
  });
});
