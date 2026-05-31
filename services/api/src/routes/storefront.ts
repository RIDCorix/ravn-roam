// Storefront-side catalog browse. Unauthenticated read-only — the
// shop pages need to render before the user signs in.
//
//   GET /storefront/products?destinations=JP                  → all live products covering JP
//   GET /storefront/products?destinations=JP,KR&days=7        → narrow to a duration
//   GET /storefront/products?destinations=JP&include_drafts=1 → include unpublished (dev)

import { and, arrayOverlaps, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { FastmoveClient } from "../clients/fastmove/client.js";
import { signEncStr } from "../clients/fastmove/signer.js";
import { env } from "../env.js";
import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { getUser, requireAuth } from "./_auth.js";
import {
  readSupplierItems,
  readSupplierOrderId,
  readSupplierOrderMode,
} from "./supplier-metadata.js";

export const storefrontRouter = new Hono();

const checkoutCreateSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20).default(1),
  customer_email: z.string().email(),
  customer_name: z.string().trim().min(1).max(120).nullish(),
  trip_id: z.string().uuid().nullish(),
  checklist_item_id: z.string().uuid().nullish(),
});

const shareEsimsSchema = z.object({
  trip_id: z.string().uuid(),
});

function displayNameFromI18n(value: unknown): string {
  if (!value || typeof value !== "object") return "eSIM";
  const record = value as Record<string, unknown>;
  return String(record["zh-TW"] ?? record.en ?? "eSIM");
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function makeOrderNumber(): string {
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `ROAM-${Date.now()}-${suffix}`;
}

function ensureFastmoveClient(): FastmoveClient {
  const missing: string[] = [];
  if (!env.FASTMOVE_BASE_URL) missing.push("FASTMOVE_BASE_URL");
  if (!env.FASTMOVE_MERCHANT_ID) missing.push("FASTMOVE_MERCHANT_ID");
  if (!env.FASTMOVE_DEPT_ID) missing.push("FASTMOVE_DEPT_ID");
  if (!env.FASTMOVE_MERCHANT_KEY) missing.push("FASTMOVE_MERCHANT_KEY");
  if (missing.length) {
    throw new Error(`missing Fastmove env: ${missing.join(", ")}`);
  }
  return new FastmoveClient({
    baseUrl: env.FASTMOVE_BASE_URL!,
    merchantId: env.FASTMOVE_MERCHANT_ID!,
    deptId: env.FASTMOVE_DEPT_ID!,
    merchantKey: env.FASTMOVE_MERCHANT_KEY!,
  });
}

function fastmoveProdContent(
  prodList: Array<{ wmproductId: string; qty: number }>,
): string {
  return prodList.map((item) => `${item.wmproductId}${item.qty}`).join("");
}

function fastmoveRedemptionEnvelope(
  qrcodeType: number,
  prodList: Array<{ wmproductId: string; qty: number }>,
) {
  const merchantId = env.FASTMOVE_MERCHANT_ID!;
  const deptId = env.FASTMOVE_DEPT_ID!;
  return {
    merchantId,
    deptId,
    encStr: signEncStr(
      `${merchantId}${deptId}${qrcodeType}${fastmoveProdContent(prodList)}`,
      env.FASTMOVE_MERCHANT_KEY!,
    ),
  };
}

function fastmoveBuyEnvelope(
  email: string,
  prodList: Array<{ wmproductId: string; qty: number }>,
) {
  const merchantId = env.FASTMOVE_MERCHANT_ID!;
  const deptId = env.FASTMOVE_DEPT_ID!;
  return {
    merchantId,
    deptId,
    encStr: signEncStr(
      `${merchantId}${deptId}${email}${fastmoveProdContent(prodList)}`,
      env.FASTMOVE_MERCHANT_KEY!,
    ),
  };
}

function fastmoveOrderQueryEnvelope(orderId: string) {
  const merchantId = env.FASTMOVE_MERCHANT_ID!;
  return {
    merchantId,
    orderId,
    encStr: signEncStr(`${merchantId}${orderId}`, env.FASTMOVE_MERCHANT_KEY!),
  };
}

function isFastmoveAccepted(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const code = String(record.resultCode ?? record.code ?? "").trim().toLowerCase();
  return ["0", "00", "000", "0000", "success", "ok"].includes(code);
}

function storefrontOrderJson(
  order: typeof schema.orderRecord.$inferSelect,
  item: typeof schema.orderItem.$inferSelect,
  upstream: unknown,
) {
  return {
    order: {
      id: order.id,
      order_number: order.orderNumber,
      status: order.status,
      customer_email: order.customerEmail,
      total_amount: Number(order.totalAmount),
      currency: order.currency,
      created_at: order.createdAt.toISOString(),
      paid_at: order.paidAt?.toISOString() ?? null,
      fulfilled_at: order.fulfilledAt?.toISOString() ?? null,
      metadata: order.metadata,
    },
    item: {
      id: item.id,
      status: item.status,
      qty: item.qty,
      unit_price: Number(item.unitPrice),
      currency: item.currency,
      fulfilled_at: item.fulfilledAt?.toISOString() ?? null,
    },
    upstream,
  };
}

// Aggregate stats for the /shop landing — one row per ISO destination
// covering how many published products mention it + cheapest retail.
// The frontend joins these against SHOP_REGIONS so each region card
// can show "X 種方案 · 起價 NT$ NNN" without N round-trips.
storefrontRouter.get("/region-stats", async (c) => {
  const db = getDb();
  // Postgres UNNEST flattens the array column so we can group by ISO.
  const rows = await db.execute(sql`
    SELECT
      iso,
      COUNT(DISTINCT id)::int          AS plan_count,
      MIN((pricing->>'retail')::numeric) AS min_retail
    FROM (
      SELECT
        id,
        pricing,
        UNNEST(marketing_destinations) AS iso
      FROM roam_poc.product
      WHERE publication_state IN ('draft', 'published')
    ) t
    GROUP BY iso
  `);
  // Drizzle's `db.execute` returns the raw pg result — pick the rows.
  const result = rows as unknown as
    | Array<{
        iso: string;
        plan_count: number;
        min_retail: string | null;
      }>
    | {
        rows: Array<{
          iso: string;
          plan_count: number;
          min_retail: string | null;
        }>;
      };
  const tally = Array.isArray(result) ? result : result.rows;
  return c.json({
    stats: tally.map((r) => ({
      iso: r.iso,
      plan_count: r.plan_count,
      min_retail: r.min_retail ? Number(r.min_retail) : null,
    })),
  });
});

// Surface seasonal / promotional events for the /shop carousel.
//
//   GET /storefront/events                      → all active events
//   GET /storefront/events?type=festival        → tab filter
//   GET /storefront/events?region=japan         → region detail page
//   GET /storefront/events?regions=italy,france → aggregate region detail page
//   GET /storefront/events?upcoming=1           → only future/current
storefrontRouter.get("/events", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const type = url.searchParams.get("type");
  const region = url.searchParams.get("region");
  const regions = Array.from(
    new Set(
      [
        ...url.searchParams.getAll("region"),
        ...(url.searchParams.get("regions") ?? "").split(","),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  const upcoming = url.searchParams.get("upcoming") === "1";

  const conditions = [eq(schema.storefrontEvent.active, true)];
  if (type) {
    conditions.push(
      eq(schema.storefrontEvent.eventType, type as never),
    );
  }
  if (regions.length > 1) {
    conditions.push(inArray(schema.storefrontEvent.regionSlug, regions));
  } else if (regions[0] ?? region) {
    conditions.push(eq(schema.storefrontEvent.regionSlug, regions[0] ?? region!));
  }
  if (upcoming) {
    // Future explicit dates OR currently in their recurring month window.
    // We use today's month — `EXTRACT(MONTH FROM now())` — and accept
    // events whose recurring window includes it OR whose explicit end
    // date is in the future.
    conditions.push(
      sql`(
        (${schema.storefrontEvent.endDate} IS NOT NULL AND ${schema.storefrontEvent.endDate} >= CURRENT_DATE)
        OR (
          ${schema.storefrontEvent.recurringMonthStart} IS NOT NULL
          AND ${schema.storefrontEvent.recurringMonthEnd} IS NOT NULL
        )
        OR (
          ${schema.storefrontEvent.startDate} IS NULL
          AND ${schema.storefrontEvent.recurringMonthStart} IS NULL
        )
      )`,
    );
  }

  const rows = await db
    .select()
    .from(schema.storefrontEvent)
    .where(and(...conditions))
    .orderBy(asc(schema.storefrontEvent.sortOrder))
    .limit(60);

  return c.json({
    events: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title_i18n: r.titleI18n,
      subtitle_i18n: r.subtitleI18n,
      location_i18n: r.locationI18n,
      event_type: r.eventType,
      region_slug: r.regionSlug,
      suggested_days: r.suggestedDays,
      suggested_gb: r.suggestedGb ? Number(r.suggestedGb) : null,
      start_date: r.startDate,
      end_date: r.endDate,
      recurring_month_start: r.recurringMonthStart,
      recurring_month_end: r.recurringMonthEnd,
      cover_image: r.coverImage,
      tint: r.tint,
      badge_override: r.badgeOverride,
    })),
  });
});

storefrontRouter.get("/products", async (c) => {
  const db = getDb();
  const url = new URL(c.req.url);
  const destinationsRaw = url.searchParams.get("destinations") ?? "";
  const days = url.searchParams.get("days");
  const includeDrafts = url.searchParams.get("include_drafts") === "1";

  const destinations = destinationsRaw
    .split(",")
    .map((d) => d.trim().toUpperCase())
    .filter(Boolean);

  if (destinations.length === 0) {
    return c.json({ products: [] });
  }

  const conditions = [
    // Any of the requested ISO codes appears in the product's
    // marketing_destinations. Drizzle's `arrayOverlaps` emits `&&` with
    // proper text[] binding (a raw sql tag template doesn't auto-cast
    // a JS string[] to a postgres array).
    arrayOverlaps(schema.product.marketingDestinations, destinations),
    eq(schema.productSupplierMapping.enabled, true),
    eq(schema.supplierPlan.available, true),
    eq(schema.supplierPlan.adminEnabled, true),
    eq(schema.supplier.code, "fastmove"),
  ];
  // By default exclude archived; drafts are still visible during the
  // pre-launch window so ops can preview without publishing each SKU.
  if (!includeDrafts) {
    conditions.push(
      inArray(schema.product.publicationState, [
        "draft",
        "published",
      ] as never[]),
    );
  }
  if (days) {
    const n = Number(days);
    if (Number.isFinite(n)) {
      conditions.push(eq(schema.product.validityDays, Math.trunc(n)));
    }
  }

  const rows = await db
    .select({
      id: schema.product.id,
      slug: schema.product.slug,
      displayNameI18n: schema.product.displayNameI18n,
      marketingDestinations: schema.product.marketingDestinations,
      dataAmountMb: schema.product.dataAmountMb,
      validityDays: schema.product.validityDays,
      pricing: schema.product.pricing,
      tags: schema.product.tags,
    })
    .from(schema.product)
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
    )
    .where(and(...conditions))
    .orderBy(asc(schema.product.validityDays), asc(schema.product.dataAmountMb))
    .limit(500);

  return c.json({
    products: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      display_name_i18n: r.displayNameI18n,
      marketing_destinations: r.marketingDestinations,
      data_amount_mb: r.dataAmountMb,
      validity_days: r.validityDays,
      pricing: r.pricing,
      tags: r.tags,
    })),
  });
});

storefrontRouter.get("/orders", requireAuth, async (c) => {
  const user = getUser(c);
  if (!user.email) return c.json({ orders: [] });
  const db = getDb();

  const tripRows = await db
    .select({
      id: schema.trip.id,
      title: schema.trip.title,
      metadata: schema.trip.metadata,
    })
    .from(schema.trip)
    .where(eq(schema.trip.userId, user.id));

  const tripById = new Map(tripRows.map((trip) => [trip.id, trip]));
  const assignedByOrder = new Map<string, number>();
  for (const trip of tripRows) {
    const metadata =
      trip.metadata && typeof trip.metadata === "object"
        ? (trip.metadata as Record<string, unknown>)
        : {};
    const esims = Array.isArray(metadata.esims) ? metadata.esims : [];
    for (const item of esims) {
      if (!item || typeof item !== "object") continue;
      const orderId = String((item as Record<string, unknown>).order_id ?? "");
      if (!orderId) continue;
      assignedByOrder.set(orderId, (assignedByOrder.get(orderId) ?? 0) + 1);
    }
  }

  const rows = await db
    .select({
      order: schema.orderRecord,
      item: schema.orderItem,
      productNameI18n: schema.product.displayNameI18n,
    })
    .from(schema.orderRecord)
    .innerJoin(schema.orderItem, eq(schema.orderItem.orderId, schema.orderRecord.id))
    .leftJoin(schema.product, eq(schema.product.id, schema.orderItem.productId))
    .where(
      and(
        eq(schema.orderRecord.customerEmail, user.email),
        sql`${schema.orderRecord.metadata}->>'supplier' = 'fastmove'`,
      ),
    )
    .orderBy(desc(schema.orderRecord.createdAt))
    .limit(100);

  return c.json({
    trips: tripRows.map((trip) => ({ id: trip.id, title: trip.title })),
    orders: rows.map((row) => {
      const metadata =
        row.order.metadata && typeof row.order.metadata === "object"
          ? (row.order.metadata as Record<string, unknown>)
          : {};
      const tripId =
        typeof metadata.trip_id === "string" ? metadata.trip_id : null;
      const supplierItems = readSupplierItems(row.order.metadata);
      const assignedCount = assignedByOrder.get(row.order.id) ?? 0;
      const walletStatus =
        assignedCount > 0
          ? "shared"
          : supplierItems.length > 0 || row.order.status === "fulfilled"
            ? "ready"
            : "pending";
      return {
        id: row.order.id,
        order_number: row.order.orderNumber,
        status: row.order.status,
        item_status: row.item.status,
        wallet_status: walletStatus,
        product_name: displayNameFromI18n(row.productNameI18n),
        quantity: row.item.qty,
        total_amount: Number(row.order.totalAmount),
        currency: row.order.currency,
        customer_email: row.order.customerEmail,
        created_at: row.order.createdAt.toISOString(),
        trip_id: tripId,
        trip_title: tripId ? tripById.get(tripId)?.title ?? null : null,
        assigned_count: assignedCount,
        profile_count: supplierItems.length,
      };
    }),
  });
});

storefrontRouter.post("/orders", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = checkoutCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [selection] = await db
    .select({
      productId: schema.product.id,
      productSlug: schema.product.slug,
      productNameI18n: schema.product.displayNameI18n,
      ownerVendorId: schema.product.ownerVendorId,
      pricing: schema.product.pricing,
      supplierCode: schema.supplier.code,
      supplierPlanId: schema.supplierPlan.id,
      supplierPlanExternalId: schema.supplierPlan.externalId,
      supplierPlanName: schema.supplierPlan.name,
      supplierPlanCostAmount: schema.supplierPlan.costAmount,
      supplierPlanCostCurrency: schema.supplierPlan.costCurrency,
      supplierPlanRawPayload: schema.supplierPlan.rawPayload,
    })
    .from(schema.product)
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
    )
    .where(
      and(
        eq(schema.product.id, parsed.data.product_id),
        inArray(schema.product.publicationState, ["draft", "published"] as never[]),
        eq(schema.product.operationalState, "ok" as never),
        eq(schema.productSupplierMapping.enabled, true),
        eq(schema.supplierPlan.available, true),
        eq(schema.supplierPlan.adminEnabled, true),
        eq(schema.supplier.code, "fastmove"),
      ),
    )
    .orderBy(asc(schema.productSupplierMapping.priority))
    .limit(1);

  if (!selection) {
    return c.json({ error: "product_unavailable" }, 404);
  }

  const pricing = selection.pricing as
    | { retail?: unknown; currency?: unknown }
    | null;
  const unitPrice = readNumber(pricing?.retail);
  const currency = typeof pricing?.currency === "string" ? pricing.currency : "TWD";
  const unitCost = readNumber(selection.supplierPlanCostAmount);
  const totalAmount = unitPrice * parsed.data.quantity;
  const costAmount = unitCost * parsed.data.quantity;
  const orderNumber = makeOrderNumber();
  const now = new Date();

  const [orderRow] = await db
    .insert(schema.orderRecord)
    .values({
      orderNumber,
      vendorId: selection.ownerVendorId,
      customerEmail: parsed.data.customer_email,
      customerName: parsed.data.customer_name ?? null,
      status: "pending",
      totalAmount: String(totalAmount),
      costAmount: String(costAmount),
      currency,
      metadata: {
        source: "storefront_checkout",
        supplier: "fastmove",
        mapped_supplier: selection.supplierCode,
        product_slug: selection.productSlug,
        trip_id: parsed.data.trip_id ?? null,
        checklist_item_id: parsed.data.checklist_item_id ?? null,
      },
    })
    .returning();

  const [itemRow] = await db
    .insert(schema.orderItem)
    .values({
      orderId: orderRow!.id,
      productId: selection.productId,
      supplierPlanId: selection.supplierPlanId,
      qty: parsed.data.quantity,
      unitPrice: String(unitPrice),
      unitCost: String(unitCost),
      currency,
      status: "pending_fulfilment",
    })
    .returning();

  const client = ensureFastmoveClient();
  let upstream: unknown;
  try {
    const qrcodeType = 2;
    const prodList = [
      {
        wmproductId: selection.supplierPlanExternalId,
        qty: parsed.data.quantity,
      },
    ];
    const rawPayload =
      selection.supplierPlanRawPayload &&
      typeof selection.supplierPlanRawPayload === "object"
        ? (selection.supplierPlanRawPayload as Record<string, unknown>)
        : {};
    const supportsRedemption = rawPayload.leSIM !== false;
    let supplierOrderRequest: unknown;
    if (supportsRedemption) {
      const request = {
          ...fastmoveRedemptionEnvelope(qrcodeType, prodList),
          qrcodeType,
          prodList,
        };
      supplierOrderRequest = request;
      upstream = await client.mybuyesimRedemption(request);
    } else {
      const request = {
          ...fastmoveBuyEnvelope(parsed.data.customer_email, prodList),
          email: parsed.data.customer_email,
          prodList,
          systemMail: false,
        };
      supplierOrderRequest = request;
      upstream = await client.mybuyesim(request);
    }
    if (!isFastmoveAccepted(upstream)) {
      throw new Error(
        `Fastmove rejected order: ${JSON.stringify(upstream).slice(0, 500)}`,
      );
    }

    let recovery: unknown = null;
    try {
      const supplierOrderId =
        upstream && typeof upstream === "object"
          ? String((upstream as { orderId?: unknown }).orderId ?? "")
          : "";
      if (!supplierOrderId) throw new Error("missing supplier orderId");
      recovery = supportsRedemption
        ? await client.querybuyesimRedemption({
            ...fastmoveOrderQueryEnvelope(supplierOrderId),
          })
        : await client.querybuyesim({
            ...fastmoveOrderQueryEnvelope(supplierOrderId),
          });
    } catch {
      // Async fulfilment normally arrives later by callback; the local
      // order remains paid + pending_fulfilment until recovery succeeds.
    }

    const results =
      recovery && typeof recovery === "object"
        ? ((recovery as { itemList?: unknown[]; results?: unknown[] }).itemList ??
          (recovery as { results?: unknown[] }).results)
        : null;
    const fulfilled = Array.isArray(results) && results.length > 0;

    const [updatedOrder] = await db
      .update(schema.orderRecord)
      .set({
        status: fulfilled ? "fulfilled" : "paid",
        paidAt: now,
        fulfilledAt: fulfilled ? now : null,
        metadata: {
          source: "storefront_checkout",
          supplier: "fastmove",
          mapped_supplier: selection.supplierCode,
          product_slug: selection.productSlug,
          trip_id: parsed.data.trip_id ?? null,
          checklist_item_id: parsed.data.checklist_item_id ?? null,
          supplier_order_mode: supportsRedemption ? "redemption" : "standard",
          supplier_order_request: supplierOrderRequest,
          supplier_order_response: upstream,
          supplier_recovery_response: recovery,
        },
      })
      .where(eq(schema.orderRecord.id, orderRow!.id))
      .returning();

    const [updatedItem] = await db
      .update(schema.orderItem)
      .set({
        status: fulfilled ? "fulfilled" : "pending_fulfilment",
        fulfilledAt: fulfilled ? now : null,
      })
      .where(eq(schema.orderItem.id, itemRow!.id))
      .returning();

    return c.json(
      storefrontOrderJson(updatedOrder!, updatedItem!, {
        order: upstream,
        recovery,
      }),
      201,
    );
  } catch (err) {
    upstream = err instanceof Error ? err.message : String(err);
    const [failedOrder] = await db
      .update(schema.orderRecord)
      .set({
        metadata: {
          source: "storefront_checkout",
          supplier: "fastmove",
          mapped_supplier: selection.supplierCode,
          product_slug: selection.productSlug,
          trip_id: parsed.data.trip_id ?? null,
          checklist_item_id: parsed.data.checklist_item_id ?? null,
          supplier_order_error: upstream,
        },
      })
      .where(eq(schema.orderRecord.id, orderRow!.id))
      .returning();
    const [failedItem] = await db
      .update(schema.orderItem)
      .set({ status: "failed" })
      .where(eq(schema.orderItem.id, itemRow!.id))
      .returning();

    return c.json(
      {
        error: "supplier_order_failed",
        details: upstream,
        ...storefrontOrderJson(failedOrder!, failedItem!, null),
      },
      502,
    );
  }
});

storefrontRouter.post("/orders/:id/refresh", async (c) => {
  const orderId = c.req.param("id");
  if (!orderId) return c.json({ error: "missing_order_id" }, 400);

  const db = getDb();
  const [order] = await db
    .select()
    .from(schema.orderRecord)
    .where(eq(schema.orderRecord.id, orderId))
    .limit(1);
  if (!order) return c.json({ error: "order_not_found" }, 404);

  const [item] = await db
    .select()
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, order.id))
    .limit(1);
  if (!item) return c.json({ error: "order_item_not_found" }, 404);

  const metadata =
    order.metadata && typeof order.metadata === "object"
      ? (order.metadata as Record<string, unknown>)
      : {};
  if (metadata.supplier !== "fastmove") {
    return c.json({ error: "supplier_not_supported" }, 501);
  }

  const supplierOrderId = readSupplierOrderId(metadata);
  if (!supplierOrderId) return c.json({ error: "missing_supplier_order_id" }, 409);

  const client = ensureFastmoveClient();
  const mode = readSupplierOrderMode(metadata);
  const recovery =
    mode === "redemption"
      ? await client.querybuyesimRedemption({
          ...fastmoveOrderQueryEnvelope(supplierOrderId),
        })
      : await client.querybuyesim({
          ...fastmoveOrderQueryEnvelope(supplierOrderId),
        });

  const results =
    recovery && typeof recovery === "object"
      ? ((recovery as { itemList?: unknown[]; results?: unknown[] }).itemList ??
        (recovery as { results?: unknown[] }).results)
      : null;
  const fulfilled = Array.isArray(results) && results.length > 0;
  const now = new Date();
  const nextMetadata = {
    ...metadata,
    supplier_recovery_response: recovery,
    supplier_last_refreshed_at: now.toISOString(),
  };

  const [updatedOrder] = await db
    .update(schema.orderRecord)
    .set({
      status: fulfilled ? "fulfilled" : order.status,
      fulfilledAt: fulfilled ? now : order.fulfilledAt,
      metadata: nextMetadata,
    })
    .where(eq(schema.orderRecord.id, order.id))
    .returning();

  const [updatedItem] = await db
    .update(schema.orderItem)
    .set({
      status: fulfilled ? "fulfilled" : item.status,
      fulfilledAt: fulfilled ? now : item.fulfilledAt,
    })
    .where(eq(schema.orderItem.id, item.id))
    .returning();

  return c.json(
    storefrontOrderJson(updatedOrder!, updatedItem!, {
      recovery,
      fulfilled,
    }),
  );
});

storefrontRouter.post("/orders/:id/share-esims", requireAuth, async (c) => {
  const user = getUser(c);
  const orderId = c.req.param("id");
  if (!orderId) return c.json({ error: "missing_order_id" }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = shareEsimsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const db = getDb();
  const [trip] = await db
    .select()
    .from(schema.trip)
    .where(and(eq(schema.trip.id, parsed.data.trip_id), eq(schema.trip.userId, user.id)))
    .limit(1);
  if (!trip) return c.json({ error: "trip_not_found" }, 404);

  const [order] = await db
    .select()
    .from(schema.orderRecord)
    .where(eq(schema.orderRecord.id, orderId))
    .limit(1);
  if (!order) return c.json({ error: "order_not_found" }, 404);

  const orderMetadata =
    order.metadata && typeof order.metadata === "object"
      ? (order.metadata as Record<string, unknown>)
      : {};
  if (orderMetadata.trip_id && orderMetadata.trip_id !== trip.id) {
    return c.json({ error: "order_trip_mismatch" }, 409);
  }

  const supplierItems = readSupplierItems(order.metadata);
  if (supplierItems.length === 0) {
    return c.json({ error: "no_esim_profiles" }, 409);
  }

  const companionRows = await db
    .select()
    .from(schema.tripCompanion)
    .where(eq(schema.tripCompanion.tripId, trip.id))
    .orderBy(asc(schema.tripCompanion.sortOrder));

  const travelers = [
    {
      companion_id: `owner:${trip.userId}`,
      display_name: user.email?.split("@")[0] || "我",
      role: "owner",
    },
    ...companionRows.map((companion) => ({
      companion_id: companion.id,
      display_name: companion.displayName,
      role: "companion",
    })),
  ];

  const assignments = supplierItems.slice(0, travelers.length).map((item, index) => {
    const traveler = travelers[index]!;
    return {
      id: `${order.id}:${index}`,
      order_id: order.id,
      order_number: order.orderNumber,
      trip_id: trip.id,
      checklist_item_id: orderMetadata.checklist_item_id ?? null,
      companion_id: traveler.companion_id,
      companion_name: traveler.display_name,
      role: traveler.role,
      iccid: item.iccid ?? null,
      wmproduct_id: item.wmproductId ?? null,
      product_name: item.productName ?? null,
      qrcode_url: item.qrcode ?? null,
      qrcode_content: item.qrcodeContent ?? null,
      redemption_code: item.rcode ?? item.redemptionCode ?? null,
      assigned_at: new Date().toISOString(),
    };
  });

  const tripMetadata =
    trip.metadata && typeof trip.metadata === "object"
      ? (trip.metadata as Record<string, unknown>)
      : {};
  const existing = Array.isArray(tripMetadata.esims)
    ? (tripMetadata.esims as unknown[])
    : [];
  const nextMetadata = {
    ...tripMetadata,
    esims: [
      ...existing.filter(
        (item) =>
          !(
            item &&
            typeof item === "object" &&
            (item as Record<string, unknown>).order_id === order.id
          ),
      ),
      ...assignments,
    ],
  };

  await db
    .update(schema.trip)
    .set({ metadata: nextMetadata })
    .where(eq(schema.trip.id, trip.id));

  if (!orderMetadata.trip_id) {
    await db
      .update(schema.orderRecord)
      .set({
        metadata: {
          ...orderMetadata,
          trip_id: trip.id,
        },
      })
      .where(eq(schema.orderRecord.id, order.id));
  }

  return c.json({
    assignments,
    assigned_count: assignments.length,
    traveler_count: travelers.length,
  });
});
