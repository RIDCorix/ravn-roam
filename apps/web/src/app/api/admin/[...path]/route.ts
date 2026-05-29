// Catch-all server-side proxy for every `/admin/*` API call made from
// the browser. The web app's client components (vendor-form,
// commission-product-picker, etc.) can't read `ROAM_API_URL` —
// `process.env` in the browser only exposes `NEXT_PUBLIC_*`. Instead,
// `lib/api.ts:apiBase()` rewrites client-side calls to hit
// `/api/admin/...` on the same origin; this route handler is what they
// land on, and it forwards to the real upstream with the auth headers
// only available to the server.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function upstreamBase(): string {
  return process.env.ROAM_API_URL ?? "http://localhost:3001";
}

function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "x-admin-user": process.env.ROAM_ADMIN_USER ?? "admin",
  };
  const token = process.env.ROAM_ADMIN_TOKEN;
  if (token) headers["x-admin-token"] = token;
  return headers;
}

async function proxy(
  req: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  const path = segments.join("/");
  const url = new URL(`/admin/${path}`, upstreamBase());
  for (const [key, value] of req.nextUrl.searchParams) {
    url.searchParams.append(key, value);
  }

  const headers: Record<string, string> = { ...adminHeaders() };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(url, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "content-type":
          res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `upstream unreachable: ${err.message}`
            : String(err),
      },
      { status: 502 },
    );
  }
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
