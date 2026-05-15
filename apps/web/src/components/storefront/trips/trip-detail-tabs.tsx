"use client";

// Tab navigation for the trip detail page. C-1 used in-page state to flip
// between overview and checklist; we promote the tabs to real routes so
// each tab is deep-linkable. Lumi is *not* a tab — she lives as a global
// floating launcher in the storefront shell so the user can summon her
// from any view.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type TripTabId = "overview" | "checklist";

export interface TripTabsLabels {
  overview: string;
  checklist: string;
}

interface TripTabsProps {
  lang: string;
  tripId: string;
  labels: TripTabsLabels;
  pendingCount: number;
}

export function TripDetailTabBar({
  lang,
  tripId,
  labels,
  pendingCount,
}: TripTabsProps) {
  const pathname = usePathname() ?? "";
  const base = `/${lang}/trips/${tripId}`;
  const active: TripTabId = pathname.endsWith("/checklist")
    ? "checklist"
    : "overview";

  return (
    <div className="flex gap-0 border-b border-divider px-4">
      <TabLink href={base} active={active === "overview"} label={labels.overview} />
      <TabLink
        href={`${base}/checklist`}
        active={active === "checklist"}
        label={labels.checklist}
        count={pendingCount}
      />
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-[13px] transition-colors duration-150",
        active
          ? "border-accent font-semibold text-fg"
          : "border-transparent font-medium text-fg-muted hover:text-fg",
      )}
    >
      {label}
      {count != null && count > 0 && (
        <span
          className={cn(
            "inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
            active
              ? "bg-accent text-white"
              : "bg-[rgba(0,0,0,0.06)] text-fg-secondary",
          )}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
