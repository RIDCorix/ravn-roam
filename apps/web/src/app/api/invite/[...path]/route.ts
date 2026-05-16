// Browser → Hono /invite/* bridge. GET /invite/:token is public (no auth
// required to see the invite preview). POST /invite/:token/accept is
// authenticated — the Supabase access token is attached when available.

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
  const apiBase = process.env.ROAM_API_URL ?? "http://localhost:4000";
  const search = request.nextUrl.search ?? "";
  const tail = (path ?? []).join("/");
  const target = `${apiBase}/invite${tail ? `/${tail}` : ""}${search}`;
  const init: RequestInit = {
    method: request.method,
    headers: {
      ...(session
        ? { authorization: `Bearer ${session.access_token}` }
        : {}),
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
