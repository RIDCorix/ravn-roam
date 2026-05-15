// Locale helpers for the i18n jsonb columns. The admin UI lets editors fill
// each locale independently; the storefront preview falls back through a
// priority list so missing translations never blank out the page.

import type { I18nText } from "./types";

export const SUPPORTED_LOCALES = ["en", "zh-TW"] as const;
export type CatalogLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: CatalogLocale = "en";

// Pick the locale's string, falling back to default-locale, then any locale
// with content, then empty string. Empty string is preferred over `null`
// because most React renderers handle "" gracefully (no condition needed).
export function pickI18n(
  text: I18nText | undefined,
  locale: string,
): string {
  if (!text) return "";
  if (text[locale]) return text[locale];
  if (text[DEFAULT_LOCALE]) return text[DEFAULT_LOCALE];
  for (const value of Object.values(text)) {
    if (value) return value;
  }
  return "";
}

// "Is every supported locale filled?" — used by the publish guardrail. A
// publish attempt with an empty zh-TW name on a 1.5-language product is
// almost always a mistake.
export function missingLocales(
  text: I18nText | undefined,
  required: readonly CatalogLocale[] = SUPPORTED_LOCALES,
): CatalogLocale[] {
  if (!text) return [...required];
  return required.filter((locale) => !text[locale]?.trim());
}
