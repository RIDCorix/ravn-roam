/**
 * Playwright config for @roam/web E2E.
 *
 * The trip planner and trips-editorial specs drive `/[lang]/dev/*` fixtures
 * and need nothing but the web app. `supplier-admin.spec.ts` additionally
 * needs:
 *   1. `pnpm --filter @roam/api dev`   (services/api on :3001 with a real DB)
 *   2. The roam_poc schema migrated; the spec seeds its own supplier row
 *      via the admin API so no fixtures are required.
 *
 * The web app starts on demand here. Point at an already-running instance
 * with `ROAM_WEB_URL` to skip that.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.WEB_PORT ?? "3010";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.ROAM_WEB_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Visual baselines are per platform: a macOS baseline is not a Linux one.
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFileName}/{arg}-{platform}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  webServer: process.env.ROAM_WEB_URL
    ? undefined
    : {
        // `ROAM_WEB_MODE=prod` (pnpm e2e:prod) runs the acceptance suite
        // against a real production build. That matters: R-301's first UAT
        // round was blocked because the fixture built fine in `next dev` and
        // could not be reached at all in production. Only the planner spec
        // survives there — the other `/dev` fixtures 404 in production by
        // design, which is why the default stays `next dev`.
        command:
          process.env.ROAM_WEB_MODE === "prod"
            ? `pnpm exec next build && pnpm exec next start --port ${PORT}`
            : `pnpm exec next dev --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
