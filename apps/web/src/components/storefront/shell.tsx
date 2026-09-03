"use client";

// Consumer-app RWD shell: bottom tab bar on mobile, public top nav at md+,
// and side rail at md+ for signed-in app surfaces.
// Mirrors design/app/components/Shell.jsx — same five tabs, same
// active-state highlight, same glass-blur chrome. Active state derives
// from pathname so deep links (e.g. /trips/abc) light up the trips tab.

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Home,
  Languages,
  ListChecks,
  LogIn,
  Map,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";

import { MotionLink, appSpring } from "@/components/storefront/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LumiAssistant,
  type LumiAssistantLabels,
} from "@/components/storefront/trips/lumi-assistant";

export interface StorefrontShellLabels {
  home: string;
  trips: string;
  tasks: string;
  shop: string;
  me: string;
}

interface Tab {
  id: keyof StorefrontShellLabels | "login";
  label: string;
  href: string;
  Icon: LucideIcon;
}

const LANGUAGE_OPTIONS = [
  { locale: "en", shortLabel: "EN", label: "English" },
  { locale: "zh-TW", shortLabel: "繁", label: "繁體中文" },
] as const;

function buildTabs({
  lang,
  labels,
  isSignedIn,
  signInLabel,
}: {
  lang: string;
  labels: StorefrontShellLabels;
  isSignedIn: boolean;
  signInLabel: string;
}): Tab[] {
  const prefix = `/${lang}`;
  const homeTab: Tab = {
    id: "home",
    label: labels.home,
    href: `${prefix}`,
    Icon: Home,
  };
  const shopTab: Tab = {
    id: "shop",
    label: labels.shop,
    href: `${prefix}/shop`,
    Icon: Store,
  };
  const publicTabs: Tab[] = [
    homeTab,
    shopTab,
  ];
  if (!isSignedIn) {
    return [
      ...publicTabs,
      {
        id: "login",
        label: signInLabel,
        href: `${prefix}/login`,
        Icon: LogIn,
      },
    ];
  }
  return [
    homeTab,
    { id: "trips", label: labels.trips, href: `${prefix}/trips`, Icon: Map },
    {
      id: "tasks",
      label: labels.tasks,
      href: `${prefix}/tasks`,
      Icon: ListChecks,
    },
    shopTab,
    { id: "me", label: labels.me, href: `${prefix}/me`, Icon: User },
  ];
}

function isActive(pathname: string, href: string, lang: string): boolean {
  const root = `/${lang}`;
  // Home is the exact root path; every other tab matches its prefix.
  if (href === root) return pathname === root || pathname === `${root}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
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

export function StorefrontShell({
  lang,
  labels,
  children,
  isSignedIn,
  signInLabel,
  lumiLabels,
  lumiAvatarId,
  fullBleed = false,
}: {
  lang: string;
  labels: StorefrontShellLabels;
  children: React.ReactNode;
  isSignedIn: boolean;
  signInLabel: string;
  // Only set when the user is signed in. When null, the assistant is
  // hidden — anonymous visitors don't have a Lumi context.
  lumiLabels: LumiAssistantLabels | null;
  lumiAvatarId?: string;
  // App surfaces that own the whole viewport (the trip planner) opt out of
  // the centered content column, but keep the real navigation.
  fullBleed?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const tabs = buildTabs({ lang, labels, isSignedIn, signInLabel });
  const isPublicHome =
    !isSignedIn && (pathname === `/${lang}` || pathname === `/${lang}/`);
  const isPublicExplore =
    !isSignedIn &&
    (pathname === `/${lang}/explore` || pathname === `/${lang}/explore/`);
  const isPublicFullBleed = isPublicHome || isPublicExplore;
  const contentFullBleed = fullBleed || isPublicFullBleed;

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {isSignedIn ? (
        <DesktopRail
          lang={lang}
          tabs={tabs}
          pathname={pathname}
          search={search}
        />
      ) : null}

      <div className="flex flex-1 min-w-0 flex-col">
        {!isSignedIn && !isPublicFullBleed ? (
          <PublicTopNav
            lang={lang}
            tabs={tabs}
            pathname={pathname}
            search={search}
          />
        ) : null}
        <main
          className={cn(
            "flex-1 min-w-0",
            contentFullBleed ? "pb-0" : "pb-28 md:pb-0",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full",
              contentFullBleed
                ? "max-w-none"
                : "max-w-[980px] md:px-6 md:py-6",
            )}
          >
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        {!isPublicFullBleed ? (
          <MobileBottomNav
            tabs={tabs}
            pathname={pathname}
            lang={lang}
            search={search}
          />
        ) : null}
      </div>

      {isSignedIn && lumiLabels && (
        <LumiAssistant
          labels={lumiLabels}
          avatarId={lumiAvatarId}
        />
      )}
    </div>
  );
}

function PublicTopNav({
  lang,
  tabs,
  pathname,
  search,
}: {
  lang: string;
  tabs: Tab[];
  pathname: string;
  search: string;
}) {
  const searchSuffix = search ? `?${search}` : "";

  return (
    <header className="sticky top-0 z-30 hidden border-b border-divider bg-bg/88 backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-6 px-6">
        <Link
          href={`/${lang}`}
          className="flex items-center gap-2.5 text-sm font-semibold tracking-tight"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-cta text-[14px] font-semibold text-cta-fg">
            r
          </span>
          <span>Roam eSIM</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label="Primary">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href, lang);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition-colors duration-150",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-fg-secondary hover:bg-surface-hover hover:text-fg",
                )}
              >
                <tab.Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <LanguageSwitch
          lang={lang}
          pathname={pathname}
          search={searchSuffix}
        />
      </div>
    </header>
  );
}

function DesktopRail({
  lang,
  tabs,
  pathname,
  search,
}: {
  lang: string;
  tabs: Tab[];
  pathname: string;
  search: string;
}) {
  const searchSuffix = search ? `?${search}` : "";
  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col gap-1.5 border-r border-divider bg-surface px-3.5 py-5">
      <MotionLink
        href={`/${lang}`}
        className="mb-4 flex items-center gap-2.5 px-2 py-2 text-sm font-semibold tracking-tight"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-cta text-cta-fg text-[14px] font-semibold">
          r
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[14px]">Roam eSIM</span>
          <span className="text-[11px] font-normal text-fg-muted">v 2.4 · 旅遊版</span>
        </span>
      </MotionLink>
      <nav className="flex flex-col gap-0.5">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href, lang);
          return (
            <MotionLink
              key={tab.id}
              href={tab.href}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition-colors duration-150",
                active
                  ? "text-accent font-semibold"
                  : "text-fg hover:bg-[rgba(0,0,0,0.04)]",
              )}
            >
              {active && (
                <motion.span
                  layoutId="desktop-rail-active"
                  className="absolute inset-0 rounded-[10px] bg-accent-soft"
                  transition={appSpring}
                />
              )}
              <tab.Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-accent" : "text-fg-secondary")} />
              <span className="relative truncate">{tab.label}</span>
            </MotionLink>
          );
        })}
      </nav>
      <div className="mt-auto">
        <LanguageSwitch
          lang={lang}
          pathname={pathname}
          search={searchSuffix}
        />
      </div>
    </aside>
  );
}

function MobileBottomNav({
  tabs,
  pathname,
  lang,
  search,
}: {
  tabs: Tab[];
  pathname: string;
  lang: string;
  search: string;
}) {
  const searchSuffix = search ? `?${search}` : "";
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => isActive(pathname, tab.href, lang)),
  );
  const slotWidth = 70;
  const rowWidth = tabs.length * slotWidth;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 md:hidden"
      style={{
        bottom: "calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="pointer-events-auto absolute right-4"
        style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
      >
        <LanguageSwitch
          lang={lang}
          pathname={pathname}
          search={searchSuffix}
          compact
        />
      </div>
      <nav
        aria-label="Primary"
        className="pointer-events-auto relative h-[78px] w-[min(calc(100vw-32px),420px)] overflow-visible rounded-[34px]"
        style={{
          boxShadow:
            "0 18px 34px -18px rgba(17,17,32,0.28), 0 6px 16px -10px rgba(17,17,32,0.18)",
        }}
      >
        {/* White bar */}
        <span
          aria-hidden
          className="absolute inset-0 z-[5] rounded-[34px] bg-white"
        />

        <div
          className="relative z-20 mx-auto flex h-[78px]"
          style={{
            width: `min(${rowWidth}px, calc(100vw - 32px))`,
            maxWidth: `${rowWidth}px`,
          }}
        >
          {/* Keep the marker in the same responsive row coordinate system as
             the links, so it remains centered when the row shrinks. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-0 z-0 h-[78px] w-1/5 transition-[left] duration-300 ease-out"
            style={{
              left: `${activeIndex * (100 / tabs.length)}%`,
              width: `${100 / tabs.length}%`,
            }}
            transition={appSpring}
          >
            <motion.span
              layoutId="mobile-nav-active-orb"
              className="absolute left-1/2 top-[26px] h-[44px] w-[44px] -translate-x-1/2 -translate-y-[60%] rounded-full bg-accent shadow-[0_8px_18px_-6px_rgba(59,130,246,0.55)]"
              transition={appSpring}
            />
          </motion.span>
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href, lang);
            return (
              <MotionLink
                key={tab.id}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={cn(
                  "relative flex h-[78px] flex-1 basis-[70px] flex-col items-center justify-start pt-[14px] transition-colors duration-200 ease-out",
                  active ? "text-accent" : "text-fg-secondary",
                )}
              >
                <tab.Icon
                  className={cn(
                    "relative z-10 h-[22px] w-[22px] transition-transform duration-300 ease-out",
                    active ? "-translate-y-[6px] text-white" : "",
                  )}
                  strokeWidth={active ? 2.2 : 1.75}
                />
                <span
                  className={cn(
                    "relative z-10 mt-[16px] text-[11px] leading-none transition-colors duration-200 ease-out",
                    active ? "font-semibold text-accent" : "text-fg-secondary",
                  )}
                >
                  {tab.label}
                </span>
              </MotionLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function LanguageSwitch({
  lang,
  pathname,
  search,
  compact = false,
}: {
  lang: string;
  pathname: string;
  search: string;
  compact?: boolean;
}) {
  const current =
    LANGUAGE_OPTIONS.find((option) => option.locale === lang) ??
    LANGUAGE_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          aria-label="Language"
          className={cn(
            "rounded-full border-divider bg-surface text-fg shadow-xs hover:bg-surface-hover",
            compact && "h-10 bg-white/95 px-3 backdrop-blur",
            !compact && "h-9 px-3",
          )}
        >
          <Languages className="h-3.5 w-3.5 text-fg-secondary" />
          <span className="text-[12px] font-semibold">
            {current.shortLabel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-fg-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={compact ? "end" : "end"}
        side={compact ? "top" : "bottom"}
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
