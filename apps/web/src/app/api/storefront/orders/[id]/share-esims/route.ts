import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

export const dynamic = "force-dynamic";

function apiBase(): string {
  return process.env.ROAM_API_URL ?? "http://localhost:4000";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const upstream = new URL(
    `/storefront/orders/${encodeURIComponent(id)}/share-esims`,
    apiBase(),
  );
  const res = await fetch(upstream, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(await req.json()),
  });
  const data = await res.json().catch(async () => ({
    error: await res.text().catch(() => `upstream ${res.status}`),
  }));
  return NextResponse.json(data, { status: res.status });
}
