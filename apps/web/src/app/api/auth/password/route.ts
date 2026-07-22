import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

export const dynamic = "force-dynamic";

type AuthMode = "in" | "up";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const input = body as {
    email?: unknown;
    password?: unknown;
    mode?: unknown;
  };
  const email = typeof input.email === "string" ? input.email : "";
  const password = typeof input.password === "string" ? input.password : "";
  const mode = input.mode === "in" || input.mode === "up" ? input.mode : null;

  if (!email || !password || !mode) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await authenticate(supabase, mode, email, password);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "auth_unreachable",
    });
  }

  return NextResponse.json({ ok: true });
}

async function authenticate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  mode: AuthMode,
  email: string,
  password: string,
) {
  return mode === "in"
    ? supabase.auth.signInWithPassword({ email, password })
    : supabase.auth.signUp({ email, password });
}
