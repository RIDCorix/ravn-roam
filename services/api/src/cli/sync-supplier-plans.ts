/**
 * CLI: run a supplier plan sync once and exit.
 *
 * Used by:
 *   - cron daily      (Railway scheduler → `pnpm --filter @roam/api sync-supplier-plans`)
 *   - dev manual      (Ray running the script locally to refresh staging)
 *
 * The admin-UI "manual trigger" button hits the HTTP route in
 * `services/api/src/index.ts`, NOT this CLI — keeping the two paths
 * separate so admin triggers do not need a fresh Node process.
 *
 * Per ROA-58 acceptance:
 *   - Prints a JSON summary on stdout (so the cron platform can capture
 *     it into the run log).
 *   - Exits non-zero on failure so cron's failure alerting fires.
 */

import { getDb } from "../db/client.js";
import { env } from "../env.js";
import {
  DrizzleSyncRepository,
  SyncRunFailedError,
  runSupplierPlanSync,
} from "../jobs/index.js";
import {
  AdapterRegistry,
  FASTMOVE_CODE,
  FastmoveAdapter,
  type SupplierAdapter,
} from "../suppliers/index.js";
import type { SyncTrigger } from "../jobs/index.js";

interface CliArgs {
  code: string;
  trigger: SyncTrigger;
  triggeredBy: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  let code = FASTMOVE_CODE;
  let trigger: SyncTrigger = "cron";
  let triggeredBy: string | null = null;
  for (const raw of argv.slice(2)) {
    const [key, value] = raw.split("=", 2);
    if (key === "--code" && value) code = value;
    else if (key === "--trigger" && value) {
      if (value === "cron" || value === "admin" || value === "system") {
        trigger = value;
      } else {
        throw new Error(
          `invalid --trigger="${value}" (must be cron|admin|system)`,
        );
      }
    } else if (key === "--triggered-by" && value) triggeredBy = value;
  }
  return { code, trigger, triggeredBy };
}

function buildRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();

  const missing: string[] = [];
  if (!env.FASTMOVE_BASE_URL) missing.push("FASTMOVE_BASE_URL");
  if (!env.FASTMOVE_MERCHANT_ID) missing.push("FASTMOVE_MERCHANT_ID");
  if (!env.FASTMOVE_DEPT_ID) missing.push("FASTMOVE_DEPT_ID");
  if (!env.FASTMOVE_MERCHANT_KEY) missing.push("FASTMOVE_MERCHANT_KEY");
  if (missing.length > 0) {
    throw new Error(
      `[sync-supplier-plans] missing Fastmove env vars: ${missing.join(", ")}. ` +
        "See services/api/.env.example.",
    );
  }

  registry.register(
    new FastmoveAdapter({
      baseUrl: env.FASTMOVE_BASE_URL!,
      merchantId: env.FASTMOVE_MERCHANT_ID!,
      deptId: env.FASTMOVE_DEPT_ID!,
      merchantKey: env.FASTMOVE_MERCHANT_KEY!,
    }),
  );

  return registry;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const registry = buildRegistry();
  const adapter: SupplierAdapter = registry.require(args.code);
  const repository = new DrizzleSyncRepository(getDb());

  console.log(
    `[sync-supplier-plans] supplier=${adapter.code} trigger=${args.trigger}`,
  );

  try {
    const result = await runSupplierPlanSync({
      supplierCode: args.code,
      adapter,
      repository,
      trigger: args.trigger,
      triggeredBy: args.triggeredBy,
    });
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (err) {
    if (err instanceof SyncRunFailedError) {
      console.error(
        JSON.stringify(
          { ok: false, error: err.message, logId: err.logId },
          null,
          2,
        ),
      );
    } else {
      console.error("[sync-supplier-plans] unexpected error:", err);
    }
    process.exit(1);
  }
}

main();
