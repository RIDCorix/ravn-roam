import { NextResponse, type NextRequest } from "next/server";

export const LOCALES = ["en", "zh-TW"] as const;
export const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";

export type Locale = (typeof LOCALES)[number];

function isLocale(value: string | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some(
    (locale) =>
      pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  // Cookie wins over Accept-Language so the user's explicit /me choice
  // sticks across visits.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : pickLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.svg|.*\\.[a-zA-Z0-9]+$).*)"],
};
