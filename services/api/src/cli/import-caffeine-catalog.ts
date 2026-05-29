/**
 * One-off importer for the Line OA 旅行咖啡因 商品目錄 Excel.
 *
 * Reads the two cleaned CSVs produced by /tmp/roam-catalog-clean/clean.py:
 *   - supplier_plans.csv  (1,442 procurement units → supplier_plan)
 *   - products.csv        (7,247 retail SKUs       → product + mapping)
 *
 * Margin policy (decided with Ray): the stored cost is the verified
 * number from the Excel; the retail price ditto. The deprecated 利潤
 * column is ignored at import time — pricing math uses the recomputed
 * (price − cost) / price downstream. The 1,107 mismatched rows are not
 * filtered out; they're imported as-is so ops can decide per-row whether
 * to fix cost or price.
 *
 * Idempotent: every upsert keys on the natural key
 * (supplier_id, external_id) for supplier_plan, slug for product. Re-running
 * the script after editing the CSVs only updates what changed.
 *
 *   pnpm --filter @roam/api tsx src/cli/import-caffeine-catalog.ts \
 *     [--csv-dir=/tmp/roam-catalog-clean] [--dry-run]
 */

import { eq, and } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";

const SUPPLIER_CODE = "caffeine";
const SUPPLIER_NAME = "旅行咖啡因";
const PLATFORM_VENDOR_CODE = "platform";

// ─── Region → ISO 3166-1 alpha-2 destinations ─────────────────────────
// Coarse mapping good enough to seed marketing_destinations / supplier
// destinations. Ops can narrow per-product later via the admin UI.
const REGION_DESTINATIONS: Record<string, string[]> = {
  japan: ["JP"],
  korea: ["KR"],
  usa: ["US"],
  "greater-china": ["CN", "HK", "MO"],
  china: ["CN"],
  "hong-kong": ["HK"],
  macau: ["MO"],
  "singapore-malaysia": ["SG", "MY"],
  indonesia: ["ID"],
  thailand: ["TH"],
  vietnam: ["VN"],
  anz: ["AU", "NZ"],
  "saipan-guam": ["MP", "GU"],
  europe: [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE", "GB", "NO", "CH", "IS", "LI",
  ],
  "western-northern-europe": [
    "FR", "DE", "NL", "BE", "LU", "GB", "IE", "DK", "SE", "NO", "FI", "IS",
    "CH", "AT",
  ],
  "central-eastern-europe-balkans": [
    "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "RS", "BA", "ME", "MK",
    "AL", "GR", "EE", "LV", "LT",
  ],
  "south-america": [
    "AR", "BO", "BR", "CL", "CO", "EC", "GY", "PY", "PE", "SR", "UY", "VE",
  ],
  "north-america": ["US", "CA", "MX"],
  "spain-camino": ["ES"],
  africa: [
    "ZA", "EG", "KE", "MA", "TZ", "GH", "NG", "ET", "UG", "RW", "TN", "ZW",
    "BW", "NA", "SN", "CI",
  ],
  turkey: ["TR"],
  india: ["IN"],
};

// Category derivation rule: 1 destination → single_country, multiple → regional.
function pickCategory(destinations: string[]): "single_country" | "regional" | "global" | "addon_topup" {
  if (destinations.length === 0) return "regional";
  if (destinations.length === 1) return "single_country";
  if (destinations.length > 25) return "global";
  return "regional";
}

// ─── CSV reader ──────────────────────────────────────────────────────
// Minimal RFC 4180-ish parser. Our cleaner emits well-formed quoted
// strings only when needed, and never embedded CR — so quote/escape
// handling is enough; we don't need a full CSV lib.

interface CsvRow {
  [key: string]: string;
}

function parseCsv(text: string): CsvRow[] {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i]!;
    if (inQuotes) {
      if (c === '"' && stripped[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else { field += c; }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length === header.length).map((r) => {
    const obj: CsvRow = {};
    header.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
}

// ─── value parsers ────────────────────────────────────────────────────

function toInt(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function toBool(v: string): boolean {
  return v === "true" || v === "TRUE" || v === "1";
}
function dataAmountForDb(amountMb: number | null, unlimited: boolean): number {
  // supplier_plan.data_amount_mb uses -1 to mean unlimited (regulation doc §2.2).
  if (unlimited) return -1;
  return amountMb ?? 0;
}

// ─── main ─────────────────────────────────────────────────────────────

interface Args {
  csvDir: string;
  dryRun: boolean;
}
function parseArgs(argv: string[]): Args {
  const out: Args = { csvDir: "/tmp/roam-catalog-clean", dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--csv-dir=")) out.csvDir = a.slice("--csv-dir=".length);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`[import] csv-dir=${args.csvDir} dry-run=${args.dryRun}`);

  const [plansCsv, productsCsv] = await Promise.all([
    readFile(path.join(args.csvDir, "supplier_plans.csv"), "utf8"),
    readFile(path.join(args.csvDir, "products.csv"), "utf8"),
  ]);
  const supplierPlanRows = parseCsv(plansCsv);
  const productRows = parseCsv(productsCsv);
  console.log(
    `[import] read ${supplierPlanRows.length} supplier_plans, ${productRows.length} products`,
  );

  const db = getDb();

  // ── 1. Ensure supplier row exists ────────────────────────────────
  const [existingSupplier] = await db
    .select()
    .from(schema.supplier)
    .where(eq(schema.supplier.code, SUPPLIER_CODE))
    .limit(1);
  let supplierId: string;
  if (existingSupplier) {
    supplierId = existingSupplier.id;
    console.log(`[import] supplier "${SUPPLIER_CODE}" exists (id=${supplierId})`);
  } else {
    if (args.dryRun) {
      console.log(`[import] (dry-run) would create supplier "${SUPPLIER_CODE}"`);
      supplierId = "00000000-0000-0000-0000-000000000000";
    } else {
      const [created] = await db
        .insert(schema.supplier)
        .values({
          code: SUPPLIER_CODE,
          displayName: SUPPLIER_NAME,
          status: "active",
          integrationType: "manual_csv",
          defaultCurrency: "TWD",
        })
        .returning();
      supplierId = created!.id;
      console.log(`[import] created supplier "${SUPPLIER_CODE}" (id=${supplierId})`);
    }
  }

  // ── 2. Resolve platform vendor (product owner) ───────────────────
  const [vendor] = await db
    .select()
    .from(schema.vendor)
    .where(eq(schema.vendor.code, PLATFORM_VENDOR_CODE))
    .limit(1);
  if (!vendor) {
    throw new Error(
      `no vendor row for code "${PLATFORM_VENDOR_CODE}" — seed it before running this import`,
    );
  }
  const ownerVendorId = vendor.id;

  // ── 3. Upsert supplier_plan rows ─────────────────────────────────
  console.log(`[import] upserting ${supplierPlanRows.length} supplier_plans…`);
  // Cache external_id → supplier_plan.id so we can wire mappings.
  const supplierPlanIdByCode = new Map<string, string>();

  for (const row of supplierPlanRows) {
    const code = row.supplier_plan_code!;
    const region = row.region_canonical!;
    const destinations = REGION_DESTINATIONS[region] ?? [];
    const dataAmountMb = dataAmountForDb(
      toInt(row.data_amount_mb!),
      toBool(row.data_unlimited!),
    );
    const validityDays = toInt(row.raw_validity_days!) ?? 0;
    const costAmount = row.cost_twd ? Number(row.cost_twd).toFixed(4) : "0.0000";
    const carrierLabel = row.carrier ? row.carrier : null;

    // We synthesise a human name when the upstream is just a code.
    const namePieces = [
      region,
      carrierLabel ?? null,
      validityDays ? `${validityDays}d` : null,
      dataAmountMb === -1 ? "unlimited" : `${row.data_amount_mb || "?"}MB`,
    ].filter(Boolean);
    const name = `${SUPPLIER_NAME} · ${namePieces.join(" · ")}`;

    const values = {
      supplierId,
      externalId: code,
      name,
      destinations,
      networkOperators: carrierLabel ? { primary: carrierLabel } : {},
      dataAmountMb,
      validityDays,
      activationPolicy: "on_install" as const,
      deliveryModel: "lpa_direct" as const,
      costAmount,
      costCurrency: "TWD",
      available: true,
      adminEnabled: true,
      rawPayload: {
        source: "caffeine_excel",
        billed_days_range: row.billed_days_range,
        data_tier: row.data_tier,
        product_count: Number(row.product_count),
      },
      lastSyncedAt: new Date(),
    };

    if (args.dryRun) {
      // Fake id for dry-run mapping pass
      supplierPlanIdByCode.set(code, `dry-${code}`);
      continue;
    }
    const [res] = await db
      .insert(schema.supplierPlan)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.supplierPlan.supplierId, schema.supplierPlan.externalId],
        set: {
          name: values.name,
          destinations: values.destinations,
          networkOperators: values.networkOperators,
          dataAmountMb: values.dataAmountMb,
          validityDays: values.validityDays,
          activationPolicy: values.activationPolicy,
          deliveryModel: values.deliveryModel,
          costAmount: values.costAmount,
          costCurrency: values.costCurrency,
          available: values.available,
          adminEnabled: values.adminEnabled,
          rawPayload: values.rawPayload,
          lastSyncedAt: values.lastSyncedAt,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.supplierPlan.id });
    supplierPlanIdByCode.set(code, res!.id);
  }
  console.log(
    `[import] supplier_plans done (${supplierPlanIdByCode.size} keyed)`,
  );

  // ── 4. Upsert product rows + mappings ────────────────────────────
  console.log(`[import] upserting ${productRows.length} products + mappings…`);
  let importedProducts = 0;
  let skippedProducts = 0;

  for (const row of productRows) {
    const slug = row.plan_code!;
    if (!slug) {
      skippedProducts++;
      continue;
    }
    const supplierPlanCode = row.supplier_plan_code!;
    const supplierPlanId = supplierPlanIdByCode.get(supplierPlanCode);
    if (!supplierPlanId) {
      console.warn(
        `[import] product ${slug} references unknown supplier_plan ${supplierPlanCode} — skipping`,
      );
      skippedProducts++;
      continue;
    }

    const region = row.region_canonical!;
    const marketingDestinations = REGION_DESTINATIONS[region] ?? [];
    const dataAmountMb = dataAmountForDb(
      toInt(row.data_amount_mb!),
      toBool(row.data_unlimited!),
    );
    const validityDays = toInt(row.billed_days!) ?? 0;

    const costTwd = row.cost_twd ? Number(row.cost_twd) : 0;
    const priceTwd = row.price_twd ? Number(row.price_twd) : 0;

    const pricing = {
      currency: "TWD",
      retail: priceTwd.toFixed(2),
      msrp: null,
      // The Excel uses an explicit retail price (not a derived markup), so
      // we record markup_mode="manual". markup_value is null because the
      // operator did not state one — the live margin = (retail-cost)/retail
      // is derivable at read time.
      markup_mode: "manual",
      markup_value: null,
      cost_snapshot: {
        amount: costTwd.toFixed(4),
        currency: "TWD",
        // Annotated source — lets us trace where the cost came from when
        // the next sync overwrites it.
        source: "caffeine_excel",
        captured_at: new Date().toISOString(),
      },
      fx_policy: "snapshot_at_publish",
    };

    const productValues = {
      slug,
      ownerVendorId,
      category: pickCategory(marketingDestinations),
      displayNameI18n: { "zh-TW": row.product_name_raw },
      descriptionI18n: {},
      marketingDestinations,
      dataAmountMb,
      validityDays,
      activationPolicyDisplay: "on_install" as const,
      publicationState: "draft" as const,
      operationalState: "ok" as const,
      pricing,
      media: {},
      tags: [
        "source:caffeine_excel",
        ...(row.carrier ? [`carrier:${row.carrier}`] : []),
        ...(row.data_tier ? [`tier:${row.data_tier}`] : []),
        ...(toBool(row.throttled!) ? ["throttled"] : []),
        ...(toBool(row.is_native!) ? ["native_sim"] : []),
      ],
    };

    if (args.dryRun) {
      importedProducts++;
      continue;
    }

    const [productRes] = await db
      .insert(schema.product)
      .values(productValues)
      .onConflictDoUpdate({
        target: schema.product.slug,
        set: {
          ownerVendorId: productValues.ownerVendorId,
          category: productValues.category,
          displayNameI18n: productValues.displayNameI18n,
          marketingDestinations: productValues.marketingDestinations,
          dataAmountMb: productValues.dataAmountMb,
          validityDays: productValues.validityDays,
          activationPolicyDisplay: productValues.activationPolicyDisplay,
          pricing: productValues.pricing,
          tags: productValues.tags,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.product.id });
    const productId = productRes!.id;

    // Wire the mapping. Each product has exactly one primary supplier
    // plan (priority=0) for now.
    const [existingMapping] = await db
      .select()
      .from(schema.productSupplierMapping)
      .where(
        and(
          eq(schema.productSupplierMapping.productId, productId),
          eq(schema.productSupplierMapping.supplierPlanId, supplierPlanId),
        ),
      )
      .limit(1);
    if (!existingMapping) {
      await db.insert(schema.productSupplierMapping).values({
        productId,
        supplierPlanId,
        priority: 0,
        enabled: true,
      });
    }
    importedProducts++;
  }

  console.log(
    `[import] products done: imported=${importedProducts} skipped=${skippedProducts}`,
  );
  console.log("[import] OK");
}

main().catch((err) => {
  console.error("[import] FAILED:", err);
  process.exit(1);
});
