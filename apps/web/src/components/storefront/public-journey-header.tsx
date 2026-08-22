"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Compass,
  Heart,
  Languages,
  Menu,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = [
  { locale: "en", shortLabel: "EN", label: "English" },
  { locale: "zh-TW", shortLabel: "繁", label: "繁體中文" },
] as const;

export type PublicJourneyHeaderLabels = {
  brand: string;
  nav: {
    explore: string;
    destinations: string;
    calendar: string;
    planner: string;
    esim: string;
  };
  favorites_aria: string;
  account_aria: string;
  menu_aria: string;
};

export function PublicJourneyHeader({
  lang,
  labels,
  tone = "auto",
}: {
  lang: string;
  labels: PublicJourneyHeaderLabels;
  tone?: "auto" | "onDark" | "onLight";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const searchSuffix = search ? `?${search}` : "";
  const prefix = `/${lang}`;
  const isLightRoute =
    pathname === `/${lang}/explore` ||
    pathname === `/${lang}/explore/` ||
    pathname === `/${lang}/shop` ||
    pathname === `/${lang}/shop/` ||
    pathname?.startsWith(`/${lang}/shop/`) ||
    pathname === `/${lang}/trips` ||
    pathname === `/${lang}/trips/` ||
    pathname?.startsWith(`/${lang}/trips/`) ||
    pathname === `/${lang}/me` ||
    pathname === `/${lang}/me/`;
  const resolvedTone =
    tone === "auto" && isLightRoute
      ? "onLight"
      : tone === "auto"
        ? "onDark"
        : tone;
  const isDark = resolvedTone === "onDark";
  const navItems = [
    { label: labels.nav.explore, href: `${prefix}/explore` },
    { label: labels.nav.destinations, href: `${prefix}/explore` },
    { label: labels.nav.calendar, href: `${prefix}/explore` },
    { label: labels.nav.planner, href: `${prefix}/trips` },
    { label: labels.nav.esim, href: `${prefix}/explore` },
  ];

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-4 sm:h-20 sm:px-8 md:gap-8">
        <Link
          href={prefix}
          className={cn(
            "flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]",
            isDark ? "text-white" : "text-[#273a3f]",
          )}
        >
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full",
              isDark ? "bg-white text-[#1d6a5a]" : "bg-[#273a3f] text-white",
            )}
          >
            <Compass className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
          <span className="truncate">{labels.brand}</span>
        </Link>

        <nav
          className={cn(
            "hidden items-center gap-9 text-[14px] font-semibold md:flex",
            isDark ? "text-white/86" : "text-[#273a3f]/78",
          )}
          aria-label="Primary"
        >
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "transition-colors",
                isDark ? "hover:text-white" : "hover:text-[#273a3f]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div
          className={cn(
            "ml-auto flex shrink-0 items-center gap-2 sm:gap-4",
            isDark ? "text-white/88" : "text-[#273a3f]/72",
          )}
        >
          <LanguageSelector
            lang={lang}
            pathname={pathname}
            search={searchSuffix}
            tone={resolvedTone}
          />
          <Link
            href={`${prefix}/me`}
            aria-label={labels.favorites_aria}
            className={cn(
              "hidden transition-colors hover:text-current sm:inline-flex",
              isDark ? "hover:text-white" : "hover:text-[#273a3f]",
            )}
          >
            <Heart className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <Link
            href={`${prefix}/me`}
            aria-label={labels.account_aria}
            className={cn(
              "hidden transition-colors hover:text-current sm:inline-flex",
              isDark ? "hover:text-white" : "hover:text-[#273a3f]",
            )}
          >
            <User className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <button
            type="button"
            aria-label={labels.menu_aria}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              isDark
                ? "bg-white/10 text-white backdrop-blur-md hover:bg-white/18"
                : "bg-[#273a3f] text-white shadow-[0_12px_28px_-18px_rgba(0,0,0,0.7)] hover:bg-[#344b50]",
            )}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

function LanguageSelector({
  lang,
  pathname,
  search,
  tone,
}: {
  lang: string;
  pathname: string;
  search: string;
  tone: "onDark" | "onLight";
}) {
  const current =
    LANGUAGE_OPTIONS.find((option) => option.locale === lang) ??
    LANGUAGE_OPTIONS[0];
  const isDark = tone === "onDark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Language"
          className={cn(
            "h-10 rounded-full px-3 text-[12px] font-semibold shadow-xs backdrop-blur-md",
            isDark
              ? "border-white/16 bg-white/10 text-white hover:bg-white/18"
              : "border-[#273a3f]/12 bg-white/74 text-[#273a3f] hover:bg-white",
          )}
        >
          <Languages className="h-3.5 w-3.5" />
          <span>{current.shortLabel}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[152px] rounded-2xl border-divider bg-surface p-1.5 shadow-lg"
      >
        {LANGUAGE_OPTIONS.map((option) => {
          const active = lang === option.locale;
          return (
            <DropdownMenuItem
              key={option.locale}
              asChild
              className={cn(
                "rounded-xl px-3 py-2 text-[13px] focus:bg-surface-hover focus:text-fg",
                active && "bg-accent-soft font-semibold text-accent",
              )}
            >
              <Link
                href={localizedHref({
                  pathname,
                  search,
                  locale: option.locale,
                })}
                aria-current={active ? "true" : undefined}
                className="flex w-full items-center justify-between gap-3"
              >
                <span>{option.label}</span>
                <span className="text-[11px] text-fg-muted">
                  {option.shortLabel}
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function localizedHref({
  pathname,
  search,
  locale,
}: {
  pathname: string;
  search: string;
  locale: string;
}): string {
  const parts = pathname.split("/");
  if (parts.length >= 2) {
    parts[1] = locale;
  }
  const nextPath = parts.join("/") || `/${locale}`;
  return `${nextPath}${search}`;
}
