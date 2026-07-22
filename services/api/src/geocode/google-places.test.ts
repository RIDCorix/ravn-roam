import { afterEach, describe, expect, test, vi } from "vitest";

import { env } from "../env.js";
import { resolveGooglePlace, searchGooglePlaceSuggestions } from "./google-places.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete env.GOOGLE_MAPS_API_KEY;
  delete env.GOOGLE_MAPS_HTTP_REFERER;
});

describe("resolveGooglePlace", () => {
  test("accepts a Google place when the country matches the day context", async () => {
    env.GOOGLE_MAPS_API_KEY = "test-google-key";
    env.GOOGLE_MAPS_HTTP_REFERER = "http://localhost:3010/";
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              id: "places/v-and-a",
              displayName: { text: "Victoria and Albert Museum" },
              formattedAddress: "Cromwell Rd, London SW7 2RL, UK",
              location: { latitude: 51.496639, longitude: -0.17218 },
              addressComponents: [
                { shortText: "GB", types: ["country", "political"] },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const result = await resolveGooglePlace("Victoria and Albert Museum", {
      expectedCountry: "gb",
      city: "London",
      center: { lat: 51.5072, lng: -0.1276 },
      fetchImpl,
    });

    expect(result).toMatchObject({
      lat: 51.496639,
      lng: -0.17218,
      country_code: "gb",
    });
    const requestBody = JSON.parse(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]
        ?.body as string,
    ) as { textQuery: string; regionCode: string };
    expect(requestBody.textQuery).toBe("Victoria and Albert Museum, London");
    expect(requestBody.regionCode).toBe("GB");
    const requestHeaders = (fetchImpl as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(requestHeaders.referer).toBe("http://localhost:3010/");
  });

  test("rejects a Google place when the country conflicts with the day context", async () => {
    env.GOOGLE_MAPS_API_KEY = "test-google-key";
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              id: "places/v-and-a",
              displayName: { text: "Victoria and Albert Museum" },
              formattedAddress: "Cromwell Rd, London SW7 2RL, UK",
              location: { latitude: 51.496639, longitude: -0.17218 },
              addressComponents: [
                { shortText: "GB", types: ["country", "political"] },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    await expect(
      resolveGooglePlace("Victoria and Albert Museum", {
        expectedCountry: "fr",
        city: "Paris",
        center: { lat: 48.8566, lng: 2.3522 },
        fetchImpl,
      }),
    ).resolves.toBeNull();
  });

  test("rejects a Google place when it is too far from the expected city", async () => {
    env.GOOGLE_MAPS_API_KEY = "test-google-key";
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              id: "places/milan-shop-in-amsterdam",
              displayName: { text: "Cavalli e Nastri Uomo" },
              formattedAddress: "Amsterdam, Netherlands",
              location: { latitude: 52.3676, longitude: 4.9041 },
              addressComponents: [
                { shortText: "IT", types: ["country", "political"] },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    await expect(
      resolveGooglePlace("Cavalli e Nastri Uomo", {
        expectedCountry: "it",
        city: "Milan",
        center: { lat: 45.4642, lng: 9.19 },
        fetchImpl,
      }),
    ).resolves.toBeNull();
  });
});

describe("searchGooglePlaceSuggestions", () => {
  test("falls back to bounded candidates when type filters are too strict", async () => {
    env.GOOGLE_MAPS_API_KEY = "test-google-key";
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              id: "places/navigli-restaurant",
              displayName: { text: "Navigli Dinner Spot" },
              formattedAddress: "Ripa di Porta Ticinese, Milano MI, Italy",
              location: { latitude: 45.452, longitude: 9.174 },
              primaryType: "italian_restaurant",
              types: ["food", "point_of_interest"],
              rating: 4.5,
              userRatingCount: 120,
              googleMapsUri: "https://maps.google.com/?cid=1",
              addressComponents: [
                { shortText: "IT", types: ["country", "political"] },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const result = await searchGooglePlaceSuggestions("restaurant dinner", {
      area: "Navigli",
      city: "Milan",
      expectedCountry: "it",
      center: { lat: 45.4642, lng: 9.19 },
      placeTypes: ["restaurant"],
      fetchImpl,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "Navigli Dinner Spot",
      primary_type: "italian_restaurant",
      country_code: "it",
    });
  });
});
