import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@roam/shared";

import { getLumiContext } from "@/lib/lumi-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ context: null }, { status: 401 });
  }

  const context = await getLumiContext();
  return NextResponse.json({ context });
}
