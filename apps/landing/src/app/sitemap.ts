import type { MetadataRoute } from "next";

import { LOCALES, type Locale } from "@/app/[lang]/dictionaries";
import { localeHref } from "@/lib/seo";

/* All canonical URLs are locale-prefixed. Each entry emits hreflang
   alternates so Google associates the two language variants. */
const PATHS: Array<{ path: string; priority: number }> = [
  { path: "", priority: 1.0 },
  { path: "plans", priority: 0.9 },
  { path: "faq", priority: 0.7 },
  { path: "privacy", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return LOCALES.flatMap((locale) =>
    PATHS.map(({ path, priority }) => ({
      url: localeHref(locale, path),
      lastModified,
      changeFrequency: "weekly" as const,
      priority,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((alt: Locale) => [
            alt === "zh-TW" ? "zh-Hant-TW" : alt,
            localeHref(alt, path),
          ]),
        ),
      },
    })),
  );
}
