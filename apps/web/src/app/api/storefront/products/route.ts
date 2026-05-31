// Server-side proxy to the upstream Hono /storefront/products endpoint.
// Client components on the shop pages call this same-origin so the
// browser never needs ROAM_API_URL (server-only env).

import { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyToApi(req, { path: "/storefront/products" });
}
