// Drizzle schema barrel. drizzle-kit reads this file's exports to compute
// the schema diff, so keep the default export shape stable.

export * from "./_schema";
export * from "./vendor";
export * from "./supplier";
export * from "./supplier-plan";
export * from "./supplier-plan-sync-log";
export * from "./product";
export * from "./product-supplier-mapping";
export * from "./audit-log";
export * from "./order";
export * from "./trip";
export * from "./trip-companion";
export * from "./traveler-collection";
export * from "./city-geocode";
export * from "./lumi-chat";
export * from "./storefront-event";

import { auditLog } from "./audit-log";
import { cityGeocode } from "./city-geocode";
import { lumiConversation, lumiMessage } from "./lumi-chat";
import { orderItem, orderRecord } from "./order";
import { product } from "./product";
import { productSupplierMapping } from "./product-supplier-mapping";
import { storefrontEvent } from "./storefront-event";
import { supplier } from "./supplier";
import { supplierPlan } from "./supplier-plan";
import { supplierPlanSyncLog } from "./supplier-plan-sync-log";
import { trip, tripChecklistItem, tripDay, tripDayStop } from "./trip";
import { tripCompanion } from "./trip-companion";
import {
  travelerAchievement,
  travelerPhoto,
  travelerPlace,
  travelerProfile,
} from "./traveler-collection";
import { vendor } from "./vendor";

export const schema = {
  vendor,
  supplier,
  supplierPlan,
  supplierPlanSyncLog,
  product,
  productSupplierMapping,
  auditLog,
  orderRecord,
  orderItem,
  trip,
  tripDay,
  tripDayStop,
  tripChecklistItem,
  tripCompanion,
  travelerProfile,
  travelerPlace,
  travelerPhoto,
  travelerAchievement,
  cityGeocode,
  lumiConversation,
  lumiMessage,
  storefrontEvent,
} as const;

export default schema;
