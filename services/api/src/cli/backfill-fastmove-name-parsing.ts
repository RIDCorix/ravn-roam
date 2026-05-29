/**
 * One-off backfill: re-parse `productName` on every fastmove supplier_plan
 * row whose validity_days or data_amount_mb landed as 0 because the
 * adapter's old field-name guesses missed the v2 payload shape.
 *
 * The adapter has been fixed prospectively (mapping.ts:parseProductName);
 * this script repairs the rows that were already synced. Idempotent —
 * blank-card rows (productType=1) intentionally stay at 0/0.
 *
 *   pnpm --filter @roam/api tsx src/cli/backfill-fastmove-name-parsing.ts [--dry-run]
 */
import { eq, sql as drizzleSql } from "drizzle-orm";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { mapFastmoveQuoteToRawPlan } from "../suppliers/fastmove/mapping.js";
import type { QuoteMgQuoteItem } from "../clients/fastmove/types.js";

interface Args {
  dryRun: boolean;
}
function parseArgs(argv: string[]): Args {
  const out: Args = { dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function main() {
  const { dryRun } = parseArgs(process.argv);
  console.log(`[backfill] dry-run=${dryRun}`);

  const db = getDb();
  const [fmSupplier] = await db
    .select()
    .from(schema.supplier)
    .where(eq(schema.supplier.code, "fastmove"))
    .limit(1);
  if (!fmSupplier) {
    console.log("[backfill] no fastmove supplier row — nothing to do");
    return;
  }

  // Pull only the rows where parsing earlier failed (days OR mb is 0).
  // Doing this in batches keeps memory predictable on Supabase pooler.
  const rows = await db
    .select({
      id: schema.supplierPlan.id,
      externalId: schema.supplierPlan.externalId,
      validityDays: schema.supplierPlan.validityDays,
      dataAmountMb: schema.supplierPlan.dataAmountMb,
      rawPayload: schema.supplierPlan.rawPayload,
    })
    .from(schema.supplierPlan)
    .where(eq(schema.supplierPlan.supplierId, fmSupplier.id));
  console.log(`[backfill] scanning ${rows.length} fastmove rows…`);

  let updated = 0;
  let skipped_unchanged = 0;
  let skipped_blank_card = 0;

  for (const row of rows) {
    // Re-run the (fixed) mapper against the stored raw_payload, then
    // only touch the columns it now derives differently.
    const remap = mapFastmoveQuoteToRawPlan(
      row.rawPayload as unknown as QuoteMgQuoteItem,
    );
    if (
      remap.validityDays === row.validityDays &&
      remap.dataAmountMb === row.dataAmountMb
    ) {
      skipped_unchanged++;
      continue;
    }
    // productType=1 blank cards stay at 0/0 by design — the new parser
    // also leaves them at 0, so they fall through `skipped_unchanged`.
    if (remap.validityDays === 0 && remap.dataAmountMb === 0) {
      skipped_blank_card++;
      continue;
    }
    if (dryRun) {
      updated++;
      if (updated <= 5) {
        console.log(
          `  [${row.externalId}] (${row.validityDays}d/${row.dataAmountMb}MB) → (${remap.validityDays}d/${remap.dataAmountMb}MB)`,
        );
      }
      continue;
    }
    await db
      .update(schema.supplierPlan)
      .set({
        validityDays: remap.validityDays,
        dataAmountMb: remap.dataAmountMb,
        updatedAt: drizzleSql`now()`,
      })
      .where(eq(schema.supplierPlan.id, row.id));
    updated++;
  }

  console.log(
    `[backfill] done: updated=${updated} unchanged=${skipped_unchanged} blank_card=${skipped_blank_card}`,
  );
}

main().catch((err) => {
  console.error("[backfill] FAILED:", err);
  process.exit(1);
});
