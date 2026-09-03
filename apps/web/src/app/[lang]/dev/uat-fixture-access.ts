/**
 * Access decision for the one `/dev` fixture that has to survive a production
 * build: the R-301 trip planner.
 *
 * Every other fixture under `/[lang]/dev/*` calls `notFound()` whenever
 * `NODE_ENV === "production"`, and that stays true. The planner is the
 * exception because its remaining acceptance criteria are gestures — first
 * frame on press, 1:1 tracking, mid-drag reversal, release velocity — that can
 * only be judged by a human on a real phone, against the deployed build. A
 * surface that 404s in production cannot be pressed, so the criteria were not
 * failing, they were unobservable.
 *
 * Exposing it is a deliberate, bounded call, not an oversight:
 *   - the trip comes from `fixture-trip.ts` and is built in memory; the page
 *     reads no backend, writes nothing, and no credential reaches it,
 *   - nothing in the product links to it and it is absent from the sitemap,
 *   - the route is served `noindex, nofollow`, so it cannot be found by search.
 *
 * Set `ROAM_DISABLE_UAT_FIXTURES=1` in the deployment's environment to take it
 * back down once UAT is signed off — no code change, no redeploy of the app
 * code itself.
 */

/** `robots` metadata for a UAT surface: reachable by URL, never indexed. */
export const UAT_FIXTURE_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
} as const;

/** False once the deployment sets `ROAM_DISABLE_UAT_FIXTURES` to 1/true. */
export function uatFixtureEnabled(
  flag = process.env.ROAM_DISABLE_UAT_FIXTURES,
): boolean {
  const value = flag?.trim().toLowerCase();
  return value !== "1" && value !== "true";
}
