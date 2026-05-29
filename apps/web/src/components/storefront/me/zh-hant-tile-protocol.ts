// Client-side OpenCC pipeline: intercept MapTiler vector tiles, decode
// the protobuf, run每一個 `name:zh` (Simplified) through 簡→繁(臺灣)
// conversion to populate `name:zh-Hant`, then re-encode. MapLibre's
// `text-field` expression on the style layers reads `name:zh-Hant`
// first, so 100% of labels render in Traditional Chinese — including
// the long tail where OpenMapTiles has no zh-Hant data of its own.
//
// Registered exactly once per page via maplibregl.addProtocol. The
// `transformRequest` callback on the map then rewrites every tile URL
// from `https://…` to `zhhant://…` to route it through this handler.

import maplibregl from "maplibre-gl";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
// @ts-expect-error vt-pbf ships no types; treat as `(tile) => Uint8Array`.
import vtpbf from "vt-pbf";
import { Converter } from "opencc-js";

const SCHEME = "zhhant";

let registered = false;

export function ensureZhHantProtocolRegistered() {
  if (registered) return;
  registered = true;

  // `cn` → `tw` includes Taiwan-style word substitution (软件→軟體 etc.),
  // which matches our zh-TW dictionary work elsewhere in the app.
  const cn2tw = Converter({ from: "cn", to: "tw" });

  maplibregl.addProtocol(SCHEME, async (params) => {
    const realUrl = params.url.replace(new RegExp(`^${SCHEME}://`), "https://");
    const resp = await fetch(realUrl);
    if (!resp.ok) {
      throw new Error(`zhhant tile fetch failed: ${resp.status}`);
    }
    const ab = await resp.arrayBuffer();
    const buf = new Uint8Array(ab);

    // Empty tiles (e.g. ocean-only) come back as 0-byte bodies — pass
    // them through untouched. VectorTile would throw otherwise.
    if (buf.byteLength === 0) {
      return { data: buf };
    }

    let tile: VectorTile;
    try {
      tile = new VectorTile(new Pbf(buf));
    } catch {
      // If the body isn't a valid vector tile (proxy/CDN error page,
      // unexpected gzip, etc.) fall back to the original bytes so the
      // map degrades gracefully instead of going blank.
      return { data: buf };
    }

    const wrappedLayers: Record<string, unknown> = {};
    for (const name in tile.layers) {
      const layer = tile.layers[name]!;
      wrappedLayers[name] = {
        version: layer.version,
        name: layer.name,
        extent: layer.extent,
        length: layer.length,
        feature: (i: number) => {
          const f = layer.feature(i);
          const props = f.properties as Record<string, unknown>;
          const zh = props["name:zh"];
          // Skip when zh-Hant is already populated (no extra work) or
          // when there's no Simplified source to convert from.
          if (
            typeof zh === "string" &&
            zh.length > 0 &&
            typeof props["name:zh-Hant"] !== "string"
          ) {
            props["name:zh-Hant"] = cn2tw(zh);
          }
          // Also convert the bare `name` if it looks Chinese and zh-Hant
          // isn't already richer — covers tiles where the default name
          // IS the Simplified version (common in China-region tiles).
          const bare = props["name"];
          if (
            typeof bare === "string" &&
            /[一-鿿]/.test(bare) &&
            typeof props["name:zh-Hant"] !== "string"
          ) {
            props["name:zh-Hant"] = cn2tw(bare);
          }
          return f;
        },
      };
    }
    const out = vtpbf({ layers: wrappedLayers }) as Uint8Array;
    return { data: out };
  });
}

export function toZhHantUrl(httpsUrl: string): string {
  return httpsUrl.replace(/^https:\/\//, `${SCHEME}://`);
}
