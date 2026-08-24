/**
 * Visual gate — what the page LOOKS like, which nothing else here checks.
 *
 * typecheck says the code is well-formed. The route smoke says the page returns
 * bytes. Neither notices a layout that collapsed, a font that failed to load, or a
 * section that renders on top of another one — the failures a consumer UI actually
 * ships with.
 *
 * Baselines live in scripts/oracle/visual/ and are committed. A diff is a FAILURE,
 * not a warning: an intentional redesign updates the baseline in the same commit that
 * changes the design, so the diff in review shows the before and after.
 *
 *   pnpm --filter @roam/web exec playwright test -c ../../scripts/oracle/visual.config.ts
 *   ... --update-snapshots     after a deliberate design change
 */
import { test, expect } from "@playwright/test";
import routes from "./routes.json";

type Route = { path: string; needs_api?: boolean; pending_issue?: string; states?: string };

const API_UP = Boolean(process.env.ROAM_API_URL);
const APPS: Array<{ app: "landing" | "web"; base: string | undefined }> = [
  { app: "landing", base: process.env.LANDING_URL },
  { app: "web", base: process.env.WEB_URL },
];

for (const { app, base } of APPS) {
  const list = (routes as Record<string, Route[]>)[app] ?? [];

  test.describe(app, () => {
    for (const route of list) {
      const name = `${app}${route.path}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

      test(`${route.path} looks right`, async ({ page }) => {
        // Inside the test body on purpose: test.skip() called in the describe body
        // applies to every test in it, so one API-backed route would silently skip the
        // whole app. A skipped check that prints nothing reads exactly like a pass.
        test.skip(
          Boolean(route.needs_api) && !API_UP,
          `${route.path} needs a live API; set ROAM_API_URL to include it`,
        );
        // A route the product does not serve yet has nothing to screenshot. The smoke
        // gate owns noticing when it starts answering.
        test.skip(
          Boolean(route.pending_issue),
          `${route.path} is not served yet — owed by ${route.pending_issue}`,
        );
        // A natural screenshot of a route whose content comes from an API captures
        // whatever that API happened to answer — including its failure. Where the
        // contract names the states, a state spec drives them deterministically and
        // owns the baselines instead.
        test.skip(
          Boolean(route.states),
          `${route.path} is covered state-by-state in ${route.states}`,
        );
        expect(base, `${app} was not booted — no base URL`).toBeTruthy();
        // "load", not "networkidle": a page with a map, a poller or a live connection
        // never goes idle, and /explore times out on it. Settling is handled explicitly
        // below, where it is visible.
        const response = await page.goto(`${base}${route.path}`, { waitUntil: "load" });
        expect(response?.status(), `${route.path} did not return 200`).toBe(200);

        // Animations and lazily-loaded imagery make a screenshot compare against itself
        // and lose, so hold them still rather than raising the diff threshold until
        // real regressions fit under it.
        await page.addStyleTag({
          content: `*, *::before, *::after {
            animation-duration: 0s !important; animation-delay: 0s !important;
            transition-duration: 0s !important; transition-delay: 0s !important;
            caret-color: transparent !important;
          }`,
        });
        // Scroll to the bottom and back so anything lazy-loaded is in the shot, then
        // let layout settle before capturing.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(600);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(600);

        await expect(page).toHaveScreenshot(`${name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
          animations: "disabled",
        });
      });
    }
  });
}
