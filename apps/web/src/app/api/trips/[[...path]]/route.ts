// Generic browser → Hono /trips/* bridge. Attaches the user's Supabase
// access token for auth. Used by the companion CRUD UI and the checklist
// row PATCH; the read paths still go through server components.

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

  /* `path` is `undefined` when the request hits `/api/trips` with no
     extra segment (which happens on POST /api/trips for trip creation).
     Treat that as the empty tail so we forward to `<api>/trips`. */
  const tail = (path ?? []).join("/");
  return proxyToApi(request, {
    path: `/trips${tail ? `/${tail}` : ""}`,
    headers: {
      authorization: `Bearer ${session.access_token}`,
    },
    contentType: "json",
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
