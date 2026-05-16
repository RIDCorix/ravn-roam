// Generic browser → Hono /trips/* bridge. Attaches the user's Supabase
// access token for auth. Used by the companion CRUD UI and the checklist
// row PATCH; the read paths still go through server components.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

export const dynamic = "force-dynamic";

async function forward(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
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
  const target = `${apiBase}/trips/${path.join("/")}${search}`;
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
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
