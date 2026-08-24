/**
 * Unit tests for apps/web.
 *
 * The app had no unit runner before R-301 — `verify:ci` ran the api and catalog
 * suites only, so every acceptance criterion about apps/web logic had nowhere to live
 * and the two the spec writes as `test:` would have been unrunnable. This adds the
 * runner; `pnpm --filter @roam/web test` is wired into verify:ci in the same change.
 *
 * Node environment on purpose: the two suites here assert pure contracts (the D-2
 * depth map, dictionary parity). Neither renders, so a jsdom dependency would buy
 * nothing and slow the inner loop.
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
