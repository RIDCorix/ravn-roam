import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

export const dynamic = "force-dynamic";

function apiBase(): string {
  return process.env.ROAM_API_URL ?? "http://localhost:4000";
}

async function forwardWithAuth(req: NextRequest, method: "GET" | "POST") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const upstream = new URL("/storefront/orders", apiBase());
  const res = await fetch(upstream, {
    method,
    cache: "no-store",
    headers: {
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(await req.json()) : undefined,
  });
  const data = await res.json().catch(async () => ({
    error: await res.text().catch(() => `upstream ${res.status}`),
  }));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest) {
  return forwardWithAuth(req, "GET");
}

export async function POST(req: NextRequest) {
  return forwardWithAuth(req, "POST");
}
