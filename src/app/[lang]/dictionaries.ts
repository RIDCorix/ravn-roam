import "server-only";

import type en from "@/i18n/dictionaries/en.json";

const loaders = {
  en: () =>
    import("@/i18n/dictionaries/en.json").then((module) => module.default),
  "zh-TW": () =>
    import("@/i18n/dictionaries/zh-TW.json").then((module) => module.default),
} as const;

export type Locale = keyof typeof loaders;
export type Dictionary = typeof en;

export const LOCALES = Object.keys(loaders) as readonly Locale[];
export const DEFAULT_LOCALE: Locale = "en";

export function hasLocale(value: string): value is Locale {
  return value in loaders;
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]() as Promise<Dictionary>;
}
