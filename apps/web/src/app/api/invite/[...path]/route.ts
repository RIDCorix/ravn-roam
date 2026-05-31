// Browser → Hono /invite/* bridge. GET /invite/:token is public (no auth
// required to see the invite preview). POST /invite/:token/accept is
// authenticated — the Supabase access token is attached when available.

import { type NextRequest } from "next/server";

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
  const tail = (path ?? []).join("/");
  return proxyToApi(request, {
    path: `/invite${tail ? `/${tail}` : ""}`,
    headers: {
      ...(session
        ? { authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    contentType: "json",
  });
}

export const GET = forward;
export const POST = forward;
