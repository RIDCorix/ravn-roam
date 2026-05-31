// Catch-all server-side proxy for every `/admin/*` API call made from
// the browser. The web app's client components (vendor-form,
// commission-product-picker, etc.) can't read `ROAM_API_URL` —
// `process.env` in the browser only exposes `NEXT_PUBLIC_*`. Instead,
// `lib/api.ts:apiBase()` rewrites client-side calls to hit
// `/api/admin/...` on the same origin; this route handler is what they
// land on, and it forwards to the real upstream with the auth headers
// only available to the server.

import { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "x-admin-user": process.env.ROAM_ADMIN_USER ?? "admin",
  };
  const token = process.env.ROAM_ADMIN_TOKEN;
  if (token) headers["x-admin-token"] = token;
  return headers;
}

async function proxy(req: NextRequest, segments: string[]) {
  const path = segments.join("/");
  return proxyToApi(req, {
    path: `/admin/${path}`,
    headers: adminHeaders(),
    contentType: "request",
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
