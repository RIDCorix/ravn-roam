"use client";

// Locale picker for the /me page. Writes a NEXT_LOCALE cookie so the
// preference survives navigations + cold visits (proxy.ts reads it before
// falling back to Accept-Language) and routes the user to the same path
// under the new locale prefix.

import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface LanguageOption {
  value: string;
  label: string;
}

const COOKIE_NAME = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function LanguageSwitcher({
  current,
  options,
  hint,
  label,
}: {
  current: string;
  options: LanguageOption[];
  hint: string;
  label: string;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const switchTo = (locale: string) => {
    if (locale === current) return;
    document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    const nextPath = swapLocaleInPath(pathname, current, locale);
    router.push(nextPath);
    router.refresh();
  };

  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div className="mb-1 text-[13px] font-semibold text-fg">{label}</div>
      <p className="mb-3 text-[12px] leading-[1.5] text-fg-muted">{hint}</p>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const active = opt.value === current;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => switchTo(opt.value)}
              aria-pressed={active}
              className={cn(
                "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] transition-colors",
                active
                  ? "bg-accent-soft text-accent font-semibold"
                  : "text-fg hover:bg-[rgba(0,0,0,0.04)]",
              )}
              style={{
                boxShadow: active
                  ? "inset 0 0 0 1px rgba(15,184,180,0.3)"
                  : "inset 0 0 0 1px var(--divider)",
              }}
            >
              <span>{opt.label}</span>
              {active && <Check className="h-4 w-4" strokeWidth={2.5} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function swapLocaleInPath(
  pathname: string,
  fromLocale: string,
  toLocale: string,
): string {
  const fromPrefix = `/${fromLocale}`;
  if (pathname === fromPrefix) return `/${toLocale}`;
  if (pathname.startsWith(`${fromPrefix}/`)) {
    return `/${toLocale}${pathname.slice(fromPrefix.length)}`;
  }
  // Path didn't have a leading locale — prepend the target.
  return `/${toLocale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
