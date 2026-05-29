"use client";

// Consumer-app RWD shell: bottom tab bar on mobile, side rail at md+.
// Mirrors design/app/components/Shell.jsx — same five tabs, same
// active-state highlight, same glass-blur chrome. Active state derives
// from pathname so deep links (e.g. /trips/abc) light up the trips tab.

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Home, Map, ListChecks, Store, User, type LucideIcon } from "lucide-react";

import { MotionLink, appSpring } from "@/components/storefront/motion";
import { cn } from "@/lib/utils";
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
  id: keyof StorefrontShellLabels;
  href: string;
  Icon: LucideIcon;
}

function buildTabs(lang: string): Tab[] {
  const prefix = `/${lang}`;
  return [
    { id: "home",  href: `${prefix}`,        Icon: Home },
    { id: "trips", href: `${prefix}/trips`,  Icon: Map },
    { id: "tasks", href: `${prefix}/tasks`,  Icon: ListChecks },
    { id: "shop",  href: `${prefix}/shop`,   Icon: Store },
    { id: "me",    href: `${prefix}/me`,     Icon: User },
  ];
}

function isActive(pathname: string, href: string, lang: string): boolean {
  const root = `/${lang}`;
  // Home is the exact root path; every other tab matches its prefix.
  if (href === root) return pathname === root || pathname === `${root}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StorefrontShell({
  lang,
  labels,
  children,
  lumiLabels,
  lumiAvatarId,
}: {
  lang: string;
  labels: StorefrontShellLabels;
  children: React.ReactNode;
  // Only set when the user is signed in. When null, the assistant is
  // hidden — anonymous visitors don't have a Lumi context.
  lumiLabels: LumiAssistantLabels | null;
  lumiAvatarId?: string;
}) {
  const pathname = usePathname();
  const tabs = buildTabs(lang);

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {/* Desktop rail (md+) */}
      <DesktopRail lang={lang} tabs={tabs} labels={labels} pathname={pathname} />

      <div className="flex flex-1 min-w-0 flex-col">
        <main className="flex-1 min-w-0 pb-28 md:pb-0">
          <div className="mx-auto w-full max-w-[980px] md:px-6 md:py-6">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav tabs={tabs} labels={labels} pathname={pathname} lang={lang} />
      </div>

      {lumiLabels && (
        <LumiAssistant
          labels={lumiLabels}
          avatarId={lumiAvatarId}
        />
      )}
    </div>
  );
}

function DesktopRail({
  lang,
  tabs,
  labels,
  pathname,
}: {
  lang: string;
  tabs: Tab[];
  labels: StorefrontShellLabels;
  pathname: string;
}) {
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
              <span className="relative truncate">{labels[tab.id]}</span>
            </MotionLink>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileBottomNav({
  tabs,
  labels,
  pathname,
  lang,
}: {
  tabs: Tab[];
  labels: StorefrontShellLabels;
  pathname: string;
  lang: string;
}) {
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
              left: `${activeIndex * 20}%`,
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
                  {labels[tab.id]}
                </span>
              </MotionLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
