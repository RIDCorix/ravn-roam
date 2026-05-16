import type { Metadata } from "next";

import { LOCALES, type Locale } from "@/app/[lang]/dictionaries";

/* Resolved at build/runtime from `NEXT_PUBLIC_SITE_URL` (set this in Vercel
   / Railway env). Falls back to localhost only so dev doesn't blow up; in
   production the env must be set, otherwise all canonical URLs and OG tags
   point at the wrong origin. */
export const SITE_URL: string = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
})();

/* ─────────────────────────────────────────────────────────────────────────
   BRAND — single source of truth for Organization JSON-LD.
   Edit these values once when launch info is final. Empty strings / arrays
   are omitted from the emitted schema so unset fields don't ship as nulls.
   ───────────────────────────────────────────────────────────────────────── */
export const BRAND = {
  legalName: "Roam Networks",
  displayName: "Roam",
  description:
    "Roam is a travel eSIM for 200+ destinations with live remaining-data visibility, designed to install in under a minute on iPhone or Pixel.",
  /* Roam is also a common word ("to roam") — disambiguate the entity so the
     Knowledge Graph doesn't merge us with the verb / unrelated products. */
  disambiguatingDescription: "Travel eSIM company (not the verb or unrelated brands).",
  foundingDate: "",
  founders: [] as Array<{ name: string; sameAs?: string }>,
  /* PostalAddress.addressCountry must be ISO 3166-1 alpha-2. */
  address: {
    streetAddress: "",
    addressLocality: "",
    addressRegion: "",
    postalCode: "",
    addressCountry: "TW",
  },
  contactPoint: {
    email: "",
    contactType: "customer support",
    availableLanguage: ["en", "zh-Hant"] as string[],
  },
  /* Public profiles for entity authority. Leave blanks; only populated
     entries are emitted to schema. */
  sameAs: [
    // "https://twitter.com/roam",
    // "https://www.linkedin.com/company/roam",
    // "https://www.crunchbase.com/organization/roam",
  ] as string[],
} as const;

/* BCP 47 hreflang codes — Google reads `zh-Hant-TW` more precisely than
   `zh-TW`. Keep them mapped here so every page emits the same alternates. */
const HREFLANG: Record<Locale, string> = {
  en: "en",
  "zh-TW": "zh-Hant-TW",
};

export function localeHref(locale: Locale, path = ""): string {
  const trimmed = path.replace(/^\/+/, "");
  return `${SITE_URL}/${locale}${trimmed ? `/${trimmed}` : ""}`;
}

export function alternatesFor(
  currentLocale: Locale,
  path = "",
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[HREFLANG[locale]] = localeHref(locale, path);
  }
  languages["x-default"] = localeHref("en", path);
  return {
    canonical: localeHref(currentLocale, path),
    languages,
  };
}

type BuildMetaInput = {
  title: string;
  description: string;
  locale: Locale;
  path?: string;
  /* When true, page is the locale root and the meta title is used as-is. */
  isRoot?: boolean;
};

export function buildMetadata({
  title,
  description,
  locale,
  path = "",
  isRoot = false,
}: BuildMetaInput): Metadata {
  const url = localeHref(locale, path);
  const fullTitle = isRoot ? title : `${title} — Roam Travel eSIM`;
  return {
    title: fullTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: alternatesFor(locale, path),
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: "Roam",
      type: "website",
      locale: locale === "zh-TW" ? "zh_TW" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

/* JSON-LD helpers — all return ready-to-stringify objects. */

/* Strip empty strings / empty arrays / empty objects so the emitted JSON-LD
   doesn't contain hollow fields. Google's Rich Results parser treats empty
   strings as "field present but invalid" — better to omit. */
function pruneEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((v) => pruneEmpty(v))
      .filter((v) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0));
    return cleaned as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = pruneEmpty(v);
      if (cleaned === undefined) continue;
      if (cleaned === "") continue;
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      if (
        cleaned &&
        typeof cleaned === "object" &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned).length === 0
      ) {
        continue;
      }
      out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

export function organizationJsonLd() {
  const orgId = `${SITE_URL}/#organization`;
  return pruneEmpty({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId,
    name: BRAND.displayName,
    legalName: BRAND.legalName,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/favicon.svg`,
    },
    description: BRAND.description,
    disambiguatingDescription: BRAND.disambiguatingDescription,
    foundingDate: BRAND.foundingDate,
    founder: BRAND.founders.map((f) => ({
      "@type": "Person",
      name: f.name,
      sameAs: f.sameAs,
    })),
    address: {
      "@type": "PostalAddress",
      ...BRAND.address,
    },
    contactPoint: BRAND.contactPoint.email
      ? {
          "@type": "ContactPoint",
          email: BRAND.contactPoint.email,
          contactType: BRAND.contactPoint.contactType,
          availableLanguage: BRAND.contactPoint.availableLanguage,
        }
      : "",
    sameAs: BRAND.sameAs,
  });
}

export function websiteJsonLd(locale: Locale) {
  return pruneEmpty({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BRAND.displayName,
    url: localeHref(locale),
    inLanguage: HREFLANG[locale],
    publisher: { "@id": `${SITE_URL}/#organization` },
  });
}

export function breadcrumbJsonLd(
  locale: Locale,
  trail: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: localeHref(locale, item.path),
    })),
  };
}

export function faqJsonLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
