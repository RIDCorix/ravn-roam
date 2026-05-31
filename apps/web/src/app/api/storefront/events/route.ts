// Server-side proxy to the upstream Hono /storefront/events endpoint.
// Same pattern as /api/storefront/products — keeps ROAM_API_URL
// server-only so the browser hits its own origin.

import { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyToApi(req, { path: "/storefront/events" });
}
