import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";
import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

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
  return proxyToApi(req, {
    path: `/storefront/orders/${encodeURIComponent(id)}/share-esims`,
    method: "POST",
    headers: {
      authorization: `Bearer ${session.access_token}`,
    },
    contentType: "json",
  });
}
