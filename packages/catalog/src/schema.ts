// Zod schemas for the catalog admin API request bodies. Shared between the
// Hono server (for parsing + 400-on-invalid) and the admin UI (for client-
// side form validation + type inference).

import { z } from "zod";

export const productCategorySchema = z.enum([
  "single_country",
  "regional",
  "global",
  "addon_topup",
]);

export const productPublicationStateSchema = z.enum([
  "draft",
  "in_review",
  "published",
  "archived",
]);

export const productOperationalStateSchema = z.enum([
  "ok",
  "sold_out",
  "suspended",
  "out_of_window",
]);

export const supplierPlanActivationPolicySchema = z.enum([
  "on_install",
  "on_first_use",
  "fixed_date",
]);

export const markupModeSchema = z.enum([
  "fixed_amount",
  "percentage",
  "target_margin",
  "manual",
]);

export const fxPolicySchema = z.enum([
  "snapshot_at_publish",
  "daily_refresh",
  "manual",
]);

export const i18nTextSchema = z.record(z.string(), z.string());

export const pricingSchema = z.object({
  currency: z.string().length(3, "ISO 4217 currency code (3 chars)"),
  retail: z.number().nonnegative(),
  msrp: z.number().nonnegative().optional(),
  markup_mode: markupModeSchema,
  markup_value: z.number(),
  cost_snapshot: z
    .object({
      plan_id: z.string().uuid(),
      cost: z.number(),
      currency: z.string().length(3),
      fx_rate: z.number().positive(),
      snapshot_at: z.string(),
    })
    .optional(),
  fx_policy: fxPolicySchema,
});

export const productCreateSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits, and hyphens"),
  category: productCategorySchema,
  display_name_i18n: i18nTextSchema,
  description_i18n: i18nTextSchema.default({}),
  marketing_destinations: z.array(z.string().length(2)).default([]),
  data_amount_mb: z.number().int(),
  validity_days: z.number().int().positive(),
  activation_policy_display: supplierPlanActivationPolicySchema,
  sales_window_start: z.string().nullable().optional(),
  sales_window_end: z.string().nullable().optional(),
  sales_region_allow: z.array(z.string().length(2)).default([]),
  sales_region_deny: z.array(z.string().length(2)).default([]),
  purchase_cap_per_user: z.number().int().positive().nullable().optional(),
  purchase_cap_total: z.number().int().positive().nullable().optional(),
  pricing: pricingSchema,
  media: z
    .object({
      thumbnail: z.string().optional(),
      hero: z.string().optional(),
    })
    .default({}),
  tags: z.array(z.string()).default([]),
});

export const productUpdateSchema = productCreateSchema.partial();

export const mappingUpsertSchema = z.object({
  supplier_plan_id: z.string().uuid(),
  priority: z.number().int().nonnegative(),
  enabled: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

export const mappingReorderSchema = z.object({
  // Ordered list of supplier_plan_id values; index = new priority.
  order: z.array(z.string().uuid()).min(1),
});

export const publicationActionSchema = z.object({
  action: z.enum(["submit", "approve", "reject", "publish", "archive", "unarchive"]),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type MappingUpsertInput = z.infer<typeof mappingUpsertSchema>;
export type MappingReorderInput = z.infer<typeof mappingReorderSchema>;
export type PublicationActionInput = z.infer<typeof publicationActionSchema>;
