/**
 * CLI: print the first N plans from the Fastmove sandbox catalogue.
 *
 * ROA-56 acceptance: "Adapter 可從 cli script 呼叫，印出前 5 筆 plan."
 *
 * Usage:
 *   pnpm --filter @roam/api list-plans            # 5 rows, fastmove
 *   pnpm --filter @roam/api list-plans -- --limit=10 --code=fastmove
 *
 * Reads creds from env (services/api/.env.example). Per ROA-86 the supplier
 * recommends a WEEKLY cadence on `myQueryAll`; do not loop this in CI.
 */

import { env } from "../env.js";
import {
  AdapterRegistry,
  FASTMOVE_CODE,
  FastmoveAdapter,
  type SupplierAdapter,
} from "../suppliers/index.js";

interface CliArgs {
  code: string;
  limit: number;
}

function parseArgs(argv: string[]): CliArgs {
  let code = FASTMOVE_CODE;
  let limit = 5;
  for (const raw of argv.slice(2)) {
    const [key, value] = raw.split("=", 2);
    if (key === "--code" && value) code = value;
    else if (key === "--limit" && value) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { code, limit };
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
      `[list-plans] missing Fastmove env vars: ${missing.join(", ")}. ` +
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

  console.log(
    `[list-plans] supplier=${adapter.code} limit=${args.limit}`,
  );

  let printed = 0;
  for await (const plan of adapter.listPlans()) {
    console.log(
      JSON.stringify(
        {
          externalId: plan.externalId,
          name: plan.name,
          destinations: plan.destinations,
          dataAmountMb: plan.dataAmountMb,
          validityDays: plan.validityDays,
          costAmount: plan.costAmount,
          costCurrency: plan.costCurrency,
          deliveryModel: plan.deliveryModel,
          available: plan.available,
        },
        null,
        2,
      ),
    );
    printed += 1;
    if (printed >= args.limit) break;
  }

  if (printed === 0) {
    console.warn("[list-plans] upstream returned zero plans");
  }
}

main().catch((err: unknown) => {
  console.error("[list-plans] failed:", err);
  process.exit(1);
});
