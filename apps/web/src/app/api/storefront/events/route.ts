// Server-side proxy to the upstream Hono /storefront/events endpoint.
// Same pattern as /api/storefront/products — keeps ROAM_API_URL
// server-only so the browser hits its own origin.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function apiBase(): string {
  return process.env.ROAM_API_URL ?? "http://localhost:3001";
}

export async function GET(req: NextRequest) {
  const upstream = new URL("/storefront/events", apiBase());
  for (const [key, value] of req.nextUrl.searchParams) {
    upstream.searchParams.append(key, value);
  }
  try {
    const res = await fetch(upstream, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: text || `upstream ${res.status}` },
        { status: res.status },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
