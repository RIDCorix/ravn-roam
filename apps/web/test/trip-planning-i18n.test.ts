/**
 * c-5 — "zh-TW／en 完整，長標題與日期不造成 layout shift."
 *
 * Two halves, and only the first is honestly a unit test. Completeness is: both
 * dictionaries carry the same keys, nothing is blank, and every field the D-2 depth
 * map can render has a label. That is the failure this project actually ships — a key
 * added to en.json and forgotten in zh-TW.json renders a raw key path to the default
 * locale's users.
 *
 * The second half — layout shift under a long title — is not asserted here, because a
 * node test cannot measure a rendered box and a test that pretended to would be worse
 * than none. It is covered where it can be measured: the c-1 visual baselines, which
 * capture the fixture's real strings at all four widths. What IS enforced here is the
 * precondition that makes the visual check meaningful: the longest translation of each
 * label is bounded, so a baseline recorded today is not silently invalidated by a
 * translation three times longer landing tomorrow.
 */
import { describe, expect, it } from "vitest";

import en from "@/i18n/dictionaries/en.json";
import zhTW from "@/i18n/dictionaries/zh-TW.json";
import { COMPACT_CORE_FIELDS, FULL_VIEW_FIELDS, TRIP_ITEM_TYPES } from "@/lib/trip-planning-depth";
import { SHEET_DETENTS } from "@/lib/trip-planning-spatial";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function keyPaths(value: Json, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child as Json, prefix ? `${prefix}.${key}` : key),
  );
}

function leafStrings(value: Json, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    leafStrings(child as Json, prefix ? `${prefix}.${key}` : key),
  );
}

const EN = en as unknown as Json;
const ZH = zhTW as unknown as Json;

describe("both locales are complete", () => {
  it("has an identical key tree in en and zh-TW", () => {
    const enKeys = keyPaths(EN).sort();
    const zhKeys = keyPaths(ZH).sort();
    const missingInZh = enKeys.filter((key) => !zhKeys.includes(key));
    const missingInEn = zhKeys.filter((key) => !enKeys.includes(key));
    // Named rather than a bare length assertion: a failure should say WHICH key.
    expect({ missingInZh, missingInEn }).toEqual({ missingInZh: [], missingInEn: [] });
  });

  it("has no blank string anywhere in either locale", () => {
    for (const [name, dict] of [["en", EN], ["zh-TW", ZH]] as const) {
      const blank = leafStrings(dict)
        .filter(([, text]) => text.trim() === "")
        .map(([path]) => `${name}:${path}`);
      expect(blank).toEqual([]);
    }
  });
});

describe("the R-301 depth map is fully translated", () => {
  const allFields = new Set<string>([
    ...COMPACT_CORE_FIELDS,
    ...TRIP_ITEM_TYPES.flatMap((type) => [...FULL_VIEW_FIELDS[type]]),
  ]);

  it("labels every field the compact sheet or a full view can render", () => {
    for (const [name, dict] of [["en", EN], ["zh-TW", ZH]] as const) {
      const fields = (dict as Record<string, Json>).storefront as Record<string, Json>;
      const labels = (
        ((fields.trips as Record<string, Json>).planning_depth as Record<string, Json>)
          .fields as Record<string, string>
      );
      const missing = [...allFields].filter((field) => !labels[field]);
      expect({ locale: name, missing }).toEqual({ locale: name, missing: [] });
    }
  });

  it("labels every ticket status, item type and detent", () => {
    for (const dict of [EN, ZH]) {
      const depth = (
        (((dict as Record<string, Json>).storefront as Record<string, Json>).trips as Record<
          string,
          Json
        >).planning_depth as Record<string, Json>
      );
      const statuses = depth.ticket_status as Record<string, string>;
      const types = depth.item_type as Record<string, string>;
      const detents = depth.detent as Record<string, string>;
      expect(Object.keys(statuses).sort()).toEqual(["attached", "none", "required"]);
      for (const type of TRIP_ITEM_TYPES) expect(types[type]).toBeTruthy();
      for (const detent of SHEET_DETENTS) expect(detents[detent]).toBeTruthy();
    }
  });

  it("keeps every depth-map label short enough for the recorded baselines", () => {
    // 24 characters is the widest label the 390px compact row was laid out against.
    // Not a style rule — a longer translation reflows the row and invalidates the c-1
    // baseline, which is the layout shift this criterion is actually about.
    for (const [name, dict] of [["en", EN], ["zh-TW", ZH]] as const) {
      const depth = (
        (((dict as Record<string, Json>).storefront as Record<string, Json>).trips as Record<
          string,
          Json
        >).planning_depth as Record<string, Json>
      );
      const tooLong = leafStrings(depth)
        .filter(([, text]) => text.length > 24)
        .map(([path, text]) => `${name}:${path} (${text.length})`);
      expect(tooLong).toEqual([]);
    }
  });
});
