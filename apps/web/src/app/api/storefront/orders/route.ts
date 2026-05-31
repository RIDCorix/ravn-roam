import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";
import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

async function forwardWithAuth(req: NextRequest, method: "GET" | "POST") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return proxyToApi(req, {
    path: "/storefront/orders",
    method,
    headers: {
      ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
    },
    contentType: "json",
  });
}

export async function GET(req: NextRequest) {
  return forwardWithAuth(req, "GET");
}

export async function POST(req: NextRequest) {
  return forwardWithAuth(req, "POST");
}
