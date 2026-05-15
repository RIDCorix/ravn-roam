"use client";

// Consumer-app RWD shell: bottom tab bar on mobile, side rail at md+.
// Mirrors design/app/components/Shell.jsx — same five tabs, same
// active-state highlight, same glass-blur chrome. Active state derives
// from pathname so deep links (e.g. /trips/abc) light up the trips tab.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, ListChecks, Store, User, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

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
}: {
  lang: string;
  labels: StorefrontShellLabels;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = buildTabs(lang);

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {/* Desktop rail (md+) */}
      <DesktopRail lang={lang} tabs={tabs} labels={labels} pathname={pathname} />

      <div className="flex flex-1 min-w-0 flex-col">
        <main className="flex-1 min-w-0 pb-24 md:pb-0">
          <div className="mx-auto w-full max-w-[980px] md:px-6 md:py-6">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav tabs={tabs} labels={labels} pathname={pathname} lang={lang} />
      </div>
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
      <Link
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
      </Link>
      <nav className="flex flex-col gap-0.5">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href, lang);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition-colors duration-150",
                active
                  ? "bg-accent-soft text-accent font-semibold"
                  : "text-fg hover:bg-[rgba(0,0,0,0.04)]",
              )}
            >
              <tab.Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-accent" : "text-fg-secondary")} />
              <span className="truncate">{labels[tab.id]}</span>
            </Link>
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
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-divider px-3 py-2 backdrop-blur-xl backdrop-saturate-150 md:hidden"
      style={{
        background: "rgba(255,255,255,0.92)",
        paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(pathname, tab.href, lang);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors duration-150",
              active ? "text-accent" : "text-fg-muted",
            )}
          >
            <tab.Icon className="h-[22px] w-[22px]" strokeWidth={active ? 1.8 : 1.5} />
            <span
              className={cn(
                "text-[10.5px] tracking-[0.01em]",
                active ? "font-semibold" : "font-medium",
              )}
            >
              {labels[tab.id]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
