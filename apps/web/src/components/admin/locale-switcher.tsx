"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <Select value={currentLang} onValueChange={pickLocale}>
      <SelectTrigger
        aria-label="Language"
        className="h-8 w-[80px] text-xs"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {locales.map((locale) => (
          <SelectItem key={locale} value={locale} className="text-xs">
            {locale}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
