"use client";

import { usePathname, useRouter } from "next/navigation";

export function LocaleSwitcher({
  currentLang,
  locales,
}: {
  currentLang: string;
  locales: readonly string[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function pickLocale(next: string) {
    // Pathname starts with /<lang>/... — swap the first segment.
    const parts = pathname.split("/");
    if (parts.length >= 2) parts[1] = next;
    router.push(parts.join("/") || `/${next}`);
  }

  return (
    <select
      className="rounded border border-border bg-surface text-sm px-2 py-1"
      value={currentLang}
      onChange={(e) => pickLocale(e.target.value)}
      aria-label="Language"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {locale}
        </option>
      ))}
    </select>
  );
}
