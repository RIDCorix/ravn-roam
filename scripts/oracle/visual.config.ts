/**
 * Playwright config for the oracle's visual gate.
 *
 * It starts nothing: scripts/oracle/serve.sh owns booting the production builds and
 * exports LANDING_URL / WEB_URL, so the smoke gate and this one boot the apps exactly
 * one way. A webServer block here would be a second, divergent way to do it.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "visual.spec.ts",
  snapshotDir: "./visual",
  outputDir: "./visual/.artifacts",
  // Screenshots are only comparable against themselves when the machine is not also
  // rendering three other pages, so this stays serial on purpose.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "list" : "list",
  // Both segments are load-bearing.
  // {projectName}: without it desktop and mobile write the same file, the second
  //   silently overwrites the first, and the gate checks one viewport while
  //   reporting both.
  // {platform}: font rasterisation and antialiasing differ between macOS and Linux,
  //   so a baseline recorded on one fails on the other for reasons that have nothing
  //   to do with the design. Keeping them side by side lets a CI baseline be added
  //   later without disturbing the local one.
  snapshotPathTemplate: "{snapshotDir}/{platform}/{projectName}/{arg}{ext}",
  use: {
    trace: "retain-on-failure",
    deviceScaleFactor: 1,
  },
  // The viewports are not a preference — they are the screen contracts the acceptance
  // criteria were written against. R-276 names 390x844, 1280x720 and 1440x900; R-301's
  // c-1 adds 1720 for the trip planning workspace, whose desktop layout is the widest
  // surface the product has. Adding a project re-checks every route at the new width,
  // which is the point: a layout that breaks at 1720 breaks for everyone on that screen.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "wide", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "ultrawide", use: { ...devices["Desktop Chrome"], viewport: { width: 1720, height: 1000 } } },
    // The consumer journey is mobile-first, so a desktop-only baseline would miss the
    // viewport most of its users are on. Chromium rather than the iPhone device preset,
    // which is WebKit: a regression gate wants ONE engine for both sizes, and a second
    // browser download in CI buys engine fidelity this gate is not measuring.
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
