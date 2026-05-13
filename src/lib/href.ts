import type { Locale } from "@/app/[lang]/dictionaries";

export function localized(href: string, locale: Locale): string {
  if (!href) return href;
  if (href.startsWith("/")) return `/${locale}${href === "/" ? "" : href}`;
  return href;
}
