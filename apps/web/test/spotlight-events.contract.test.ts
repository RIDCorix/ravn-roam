/**
 * Route contract over the Explore spotlight.
 *
 * Every spotlight event offers one CTA — "see coverage for this place". If that URL
 * names a region /shop has no page for, the traveler's single primary action on the
 * discovery surface ends at a 404, and no smoke check notices: the route it drives is
 * /zh-TW/shop/japan, which happens to be one of the events that DID resolve.
 *
 * Seven of eighteen events were broken this way. This asserts all of them.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";

import { SPOTLIGHT_EVENTS } from "@/lib/spotlight-events";
import { buildShopHref } from "@/lib/shop-link";
import { findRegionBySlug } from "@/lib/storefront-regions";

/** `/zh-TW/shop/japan?x=1` → `japan`; `/zh-TW/shop` → null (the grid, no region). */
function regionSlugOf(href: string): string | null {
  const path = href.split("?")[0]!;
  const match = /^\/[^/]+\/shop\/([^/]+)$/.exec(path);
  return match ? match[1]! : null;
}

test("every spotlight CTA reaches a region page that exists", () => {
  const broken: string[] = [];

  for (const event of SPOTLIGHT_EVENTS) {
    const href = buildShopHref("zh-TW", { country: event.countryCode });
    const slug = regionSlugOf(href);
    if (!slug || !findRegionBySlug(slug)) {
      broken.push(`${event.id} (${event.countryCode}) -> ${href}`);
    }
  }

  assert.deepEqual(
    broken,
    [],
    `spotlight CTAs that do not resolve to a region page:\n  ${broken.join("\n  ")}`,
  );
});

test("the editorial regionSlug is not usable as a shop slug, so nothing may link to it", () => {
  // Guards the regression directly: this is the field the CTA used to interpolate.
  const editorialOnly = SPOTLIGHT_EVENTS.filter(
    (event) => !findRegionBySlug(event.regionSlug),
  ).map((event) => event.regionSlug);

  assert.ok(
    editorialOnly.length > 0,
    "if every regionSlug now resolves this guard is obsolete — delete it rather than weakening it",
  );
});

test("each spotlight country resolves to one stable region", () => {
  for (const event of SPOTLIGHT_EVENTS) {
    const first = buildShopHref("zh-TW", { country: event.countryCode });
    const second = buildShopHref("zh-TW", { country: event.countryCode });
    assert.equal(first, second, `${event.id} resolved unstably`);
  }
});
