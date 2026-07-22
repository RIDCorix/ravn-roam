import { describe, expect, test } from "vitest";

import { knownCityGeocode } from "./nominatim.js";

describe("knownCityGeocode", () => {
  test("pins Taipei to the canonical city center", () => {
    expect(knownCityGeocode("台北")).toMatchObject({
      lat: 25.033,
      lng: 121.5654,
      country_code: "tw",
    });
  });

  test("pins localized Milan to Italy", () => {
    expect(knownCityGeocode("米蘭")).toMatchObject({
      lat: 45.4642,
      lng: 9.19,
      country_code: "it",
    });
  });

  test("respects strict country constraints for stop geocoding", () => {
    expect(knownCityGeocode("台北", "it")).toBeNull();
  });
});
