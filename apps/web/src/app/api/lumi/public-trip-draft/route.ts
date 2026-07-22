import type { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return proxyToApi(request, {
    path: "/lumi/public-trip-draft",
    contentType: "json",
  });
}
