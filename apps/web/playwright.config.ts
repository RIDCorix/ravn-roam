/**
 * Playwright config for @roam/web admin E2E.
 *
 * Prerequisites for `pnpm e2e`:
 *   1. `pnpm --filter @roam/api dev`   (services/api on :3001 with a real DB)
 *   2. `pnpm --filter @roam/web dev`   (apps/web on :3000)
 *   3. The roam_poc schema must be migrated; the test seeds its own
 *      supplier row via the admin API so no fixtures are required.
 *
 * Run a real Postgres (Supabase or local docker is fine) and point the API
 * at it before invoking this — the spec exercises actual HTTP traffic.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.WEB_PORT ?? "3000";

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
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
