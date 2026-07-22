import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";
import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

async function forward(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tail = (path ?? []).join("/");
  return proxyToApi(request, {
    path: `/me/collection${tail ? `/${tail}` : ""}`,
    headers: {
      authorization: `Bearer ${session.access_token}`,
    },
    contentType: "json",
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
