import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
