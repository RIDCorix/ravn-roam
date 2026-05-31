import { NextResponse, type NextRequest } from "next/server";

import { serverApiBase } from "@/lib/server-api-base";

type ProxyContentType = "request" | "json" | "none";

export interface ApiProxyOptions {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  contentType?: ProxyContentType;
}

export async function proxyToApi(
  request: NextRequest,
  {
    path,
    method = request.method,
    headers = {},
    contentType = "request",
  }: ApiProxyOptions,
): Promise<NextResponse> {
  const upstream = new URL(path, serverApiBase());
  for (const [key, value] of request.nextUrl.searchParams) {
    upstream.searchParams.append(key, value);
  }

  const requestHeaders: Record<string, string> = { ...headers };
  const shouldForwardBody = method !== "GET" && method !== "HEAD";
  if (shouldForwardBody) {
    if (contentType === "json") {
      requestHeaders["content-type"] = "application/json";
    } else if (contentType === "request") {
      const incomingContentType = request.headers.get("content-type");
      if (incomingContentType) {
        requestHeaders["content-type"] = incomingContentType;
      }
    }
  }

  const init: RequestInit = {
    method,
    headers: requestHeaders,
    cache: "no-store",
  };
  if (shouldForwardBody) {
    init.body = await request.text();
  }

  try {
    const response = await fetch(upstream, init);
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
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
