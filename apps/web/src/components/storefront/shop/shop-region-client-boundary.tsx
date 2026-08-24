"use client";

import dynamic from "next/dynamic";

// Chrome's native translation can rewrite server-rendered text nodes before
// hydration. The catalog replaces its loading state asynchronously, so mount
// it as client-owned DOM rather than reconciling translated loader markup.
export const ShopRegionClientBoundary = dynamic(
  () =>
    import("./shop-region-client").then(
      ({ ShopRegionClient }) => ShopRegionClient,
    ),
  { ssr: false },
);
