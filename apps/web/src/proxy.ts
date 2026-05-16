import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const LOCALES = ["en", "zh-TW"] as const;
export const DEFAULT_LOCALE = "en";

export type Locale = (typeof LOCALES)[number];

const PROTECTED_PATH = /^\/(en|zh-TW)\/trips(\/|$)/;

function pickLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const tags = acceptLanguage
    .split(",")
    .map((entry) => entry.trim().split(";")[0].toLowerCase());
  for (const tag of tags) {
    if (tag.startsWith("zh-tw") || tag === "zh-hant" || tag === "zh") {
      return "zh-TW";
    }
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

function localeFromPath(pathname: string): Locale | null {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Step 1: locale routing — same as before.
  const currentLocale = localeFromPath(pathname);
  if (!currentLocale) {
    const locale = pickLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // Step 2: refresh Supabase auth cookies + gate /trips/*.
  const response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: getUser refreshes the session if the JWT is expired AND
  // writes the new cookies onto `response` via the setAll() callback.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (PROTECTED_PATH.test(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${currentLocale}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Exclude framework internals (_next), route handlers (/api, /auth), and
  // any static file (anything with an extension) from locale rewriting.
  // Without the api/auth excludes, a fetch to "/api/trips/:id/lumi" gets
  // 307-redirected to "/zh-TW/api/trips/:id/lumi" which doesn't exist.
  matcher: ["/((?!_next|api|auth|favicon\\.svg|.*\\.[a-zA-Z0-9]+$).*)"],
};
