// Generic browser → Hono /trips/* bridge. Attaches the user's Supabase
// access token for auth. Used by the companion CRUD UI and the checklist
// row PATCH; the read paths still go through server components.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

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

  const apiBase = process.env.ROAM_API_URL ?? "http://localhost:4000";
  const search = request.nextUrl.search ?? "";
  /* `path` is `undefined` when the request hits `/api/trips` with no
     extra segment (which happens on POST /api/trips for trip creation).
     Treat that as the empty tail so we forward to `<api>/trips`. */
  const tail = (path ?? []).join("/");
  const target = `${apiBase}/trips${tail ? `/${tail}` : ""}${search}`;
  const init: RequestInit = {
    method: request.method,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      ...(request.method !== "GET" && request.method !== "HEAD"
        ? { "content-type": "application/json" }
        : {}),
    },
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }
  const res = await fetch(target, init);
  const text = await res.text();
  /* Preserve the upstream content-type — when the backend returns an
     HTML error page (e.g. Railway 502), labelling it as JSON makes the
     client misparse and surface the raw HTML in the UI. */
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
