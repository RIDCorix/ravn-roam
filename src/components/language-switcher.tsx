import Link from "next/link";

import type { Dictionary, Locale } from "@/app/[lang]/dictionaries";
import { LOCALES } from "@/app/[lang]/dictionaries";

export function LanguageSwitcher({
  current,
  dict,
}: {
  current: Locale;
  dict: Dictionary["language"];
}) {
  return (
    <div
      role="group"
      aria-label={dict.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 3,
        borderRadius: 999,
        background: "rgba(17,17,32,0.04)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            href={`/${locale}`}
            aria-current={active ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 26,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              color: active ? "#fff" : "var(--fg-secondary)",
              background: active ? "#111" : "transparent",
              textDecoration: "none",
              letterSpacing: "0.04em",
              transition:
                "color 180ms var(--ease-out-soft), background 180ms var(--ease-out-soft)",
            }}
          >
            {dict[locale]}
          </Link>
        );
      })}
    </div>
  );
}
