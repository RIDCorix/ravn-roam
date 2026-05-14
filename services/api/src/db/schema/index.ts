// Drizzle schema barrel. drizzle-kit reads this file's exports to compute
// the schema diff, so keep the default export shape stable.

export * from "./_schema";
export * from "./vendor";
export * from "./supplier";
export * from "./supplier-plan";
export * from "./product";
export * from "./product-supplier-mapping";

import { product } from "./product";
import { productSupplierMapping } from "./product-supplier-mapping";
import { supplier } from "./supplier";
import { supplierPlan } from "./supplier-plan";
import { vendor } from "./vendor";

export const schema = {
  vendor,
  supplier,
  supplierPlan,
  product,
  productSupplierMapping,
} as const;

export default schema;
