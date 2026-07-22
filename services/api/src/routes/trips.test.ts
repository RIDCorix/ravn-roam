import { describe, expect, test } from "vitest";

import {
  normalizeTripDayCities,
  shouldSeedDefaultStops,
  stopLookupNamesForTrip,
  stopMappableNameForTrip,
} from "./trips.js";
import { normalizeTripStopAnchorMode } from "../db/schema/trip.js";

describe("normalizeTripDayCities", () => {
  test("falls back to the primary city for legacy day payloads", () => {
    expect(normalizeTripDayCities("米蘭", [])).toEqual(["米蘭"]);
  });

  test("preserves an explicitly empty overview day", () => {
    expect(normalizeTripDayCities("米蘭", [], [])).toEqual([]);
  });

  test("keeps ordered cross-city context without duplicates", () => {
    expect(normalizeTripDayCities("米蘭", ["米蘭", "巴黎", "巴黎"])).toEqual([
      "米蘭",
      "巴黎",
    ]);
  });

  test("projects editable day segments before legacy city fields", () => {
    expect(
      normalizeTripDayCities("米蘭", ["米蘭"], [
        { city: "米蘭" },
        { city: "巴黎" },
      ]),
    ).toEqual(["米蘭", "巴黎"]);
  });

  test("does not promote airport transfer anchors into overview cities", () => {
    expect(
      normalizeTripDayCities("台北", ["台北", "桃園機場", "米蘭"], [
        { city: "台北" },
        { city: "桃園機場" },
        { city: "米蘭" },
      ]),
    ).toEqual(["台北", "米蘭"]);
  });
});

describe("stopMappableNameForTrip", () => {
  test("uses the exact place anchor before the traveler-facing stop name", () => {
    expect(
      stopMappableNameForTrip({
        name: "設計選物店巡禮",
        placeName: "DaMilan Bar Boutique",
      }),
    ).toBe("DaMilan Bar Boutique");
  });

  test("falls back to the stop name when no place anchor exists", () => {
    expect(
      stopMappableNameForTrip({
        name: "Galleria Vittorio Emanuele II",
        placeName: null,
      }),
    ).toBe("Galleria Vittorio Emanuele II");
  });

  test("keeps the stop name as a geocode fallback for localized place anchors", () => {
    expect(
      stopLookupNamesForTrip({
        name: "Galleria Vittorio Emanuele II",
        placeName: "維托里奧·埃馬努埃萊二世長廊",
      }),
    ).toEqual([
      "維托里奧·埃馬努埃萊二世長廊",
      "Galleria Vittorio Emanuele II",
    ]);
  });
});

describe("normalizeTripStopAnchorMode", () => {
  test("treats legacy suggested_places anchors as regional stops", () => {
    expect(normalizeTripStopAnchorMode("suggested_places")).toBe("regional");
  });

  test("preserves exact place anchors and defaults unknown values to exact_place", () => {
    expect(normalizeTripStopAnchorMode("exact_place")).toBe("exact_place");
    expect(normalizeTripStopAnchorMode("regional")).toBe("regional");
    expect(normalizeTripStopAnchorMode("other")).toBe("exact_place");
    expect(normalizeTripStopAnchorMode(null)).toBe("exact_place");
  });
});

describe("shouldSeedDefaultStops", () => {
  test("keeps legacy city-stop seeding for non-Lumi callers", () => {
    expect(shouldSeedDefaultStops({})).toBe(true);
    expect(shouldSeedDefaultStops({ source: "manual" })).toBe(true);
  });

  test("disables city-stop seeding for Lumi-generated drafts", () => {
    expect(shouldSeedDefaultStops({ source: "lumi" })).toBe(false);
  });
});
