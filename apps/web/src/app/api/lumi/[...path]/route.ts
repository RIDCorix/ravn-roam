// Generic browser → Hono /lumi/* bridge. Attaches the Supabase access
// token from the cookie session so the API's requireAuth middleware can
// resolve the user.

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
  /* `path` is undefined when the request hits `/api/lumi` with no extra
     segment. Treat that as the empty tail so we forward to `<api>/lumi`. */
  const tail = (path ?? []).join("/");
  const target = `${apiBase}/lumi${tail ? `/${tail}` : ""}${search}`;
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
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
