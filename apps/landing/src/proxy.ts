import { NextResponse, type NextRequest } from "next/server";

export const LOCALES = ["en", "zh-TW"] as const;
export const DEFAULT_LOCALE = "en";

export type Locale = (typeof LOCALES)[number];

/* Per Google's i18n guidance, do NOT auto-redirect users to a locale based on
   Accept-Language — it hides locale variants from crawlers (which only fetch
   with `en-US`) and produces inconsistent canonicals.
   Instead: redirect every non-locale path to the default locale with a
   permanent 308, and expose all locales via hreflang in <head>. Users who
   want a different language use the in-nav switcher (the cookie set by the
   switcher takes precedence on subsequent visits). */
const LOCALE_COOKIE = "roam-locale";

function readLocaleCookie(request: NextRequest): Locale | null {
  const value = request.cookies.get(LOCALE_COOKIE)?.value;
  return (LOCALES as readonly string[]).includes(value ?? "")
    ? (value as Locale)
    : null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some(
    (locale) =>
      pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  /* Respect a user's previously-chosen locale (set by the language switcher)
     but never sniff Accept-Language at the crawler's request. */
  const preferred = readLocaleCookie(request) ?? DEFAULT_LOCALE;
  const url = request.nextUrl.clone();
  url.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;

  const response = NextResponse.redirect(url, 308);
  /* Tell caches the response varies by cookie so the redirect target stays
     correct for users who switched languages. */
  response.headers.set("Vary", "Cookie");
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon\\.svg|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
