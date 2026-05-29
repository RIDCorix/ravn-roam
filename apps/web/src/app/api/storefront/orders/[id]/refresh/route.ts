import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function apiBase(): string {
  return process.env.ROAM_API_URL ?? "http://localhost:4000";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const upstream = new URL(
    `/storefront/orders/${encodeURIComponent(id)}/refresh`,
    apiBase(),
  );
  const res = await fetch(upstream, {
    method: "POST",
    cache: "no-store",
  });
  const data = await res.json().catch(async () => ({
    error: await res.text().catch(() => `upstream ${res.status}`),
  }));
  return NextResponse.json(data, { status: res.status });
}
