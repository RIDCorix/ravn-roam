// Run the standing storefront probe once and exit with a meaningful code.
//
//   pnpm --filter @roam/api monitor:storefront -- --base-url https://api.example
//   ROAM_API_URL=https://api.example pnpm --filter @roam/api monitor:storefront
//
// Use `--out report.json` rather than shell redirection when the exit code
// matters: pnpm appends its own ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL trailer to
// stdout on a non-zero exit, which corrupts a redirected JSON file.
//
// Exit codes are the alerting contract used by
// .github/workflows/storefront-monitor.yml:
//   0  everything the shop needs is serving
//   1  a hard failure — an endpoint is down or 5xx
//   2  degraded — serving, but something needs a human (empty catalog, no GIT_SHA)
//   3  misconfigured — no base URL to probe

import { writeFileSync } from "node:fs";

import { probeStorefront, summarize } from "../monitor/storefront-probe.js";

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const argv = process.argv.slice(2);
  const index = argv.indexOf(flag);
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((a) => a.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

const baseUrl = arg("base-url") ?? process.env.ROAM_API_URL;
if (!baseUrl) {
  console.error(
    "[monitor] no API origin: pass --base-url or set ROAM_API_URL. " +
      "Production lives in the hub as infra.railway.roam_api.public_url.",
  );
  process.exit(3);
}

const report = await probeStorefront({
  baseUrl,
  destination: arg("destination") ?? process.env.MONITOR_DESTINATION ?? "JP",
  timeoutMs: Number(arg("timeout-ms") ?? 15_000),
});

const serialized = JSON.stringify(report, null, 2);
const out = arg("out");
if (out) writeFileSync(out, `${serialized}\n`);
// stdout carries the report too, for a human running this by hand.
console.log(serialized);
console.error(
  `[monitor] ${baseUrl} — ${report.ok ? (report.degraded ? "DEGRADED" : "OK") : "FAILING"}: ${summarize(report)}`,
);

process.exit(report.ok ? (report.degraded ? 2 : 0) : 1);
