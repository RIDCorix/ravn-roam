// Generic browser → Hono /lumi/* bridge. Attaches the Supabase access
// token from the cookie session so the API's requireAuth middleware can
// resolve the user.

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

  /* `path` is undefined when the request hits `/api/lumi` with no extra
     segment. Treat that as the empty tail so we forward to `<api>/lumi`. */
  const tail = (path ?? []).join("/");
  return proxyToApi(request, {
    path: `/lumi${tail ? `/${tail}` : ""}`,
    headers: {
      authorization: `Bearer ${session.access_token}`,
    },
    contentType: "json",
  });
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
