"use client";

// Tab navigation for the trip detail page. C-1 used in-page state to flip
// between overview and checklist; C-2 promotes the tabs to real routes
// (overview / lumi / checklist) so the Lumi tab can have its own chat URL
// and the user can deep-link back to a specific tab.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type TripTabId = "overview" | "lumi" | "checklist";

export interface TripTabsLabels {
  overview: string;
  lumi: string;
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
  const active: TripTabId = pathname.endsWith("/lumi")
    ? "lumi"
    : pathname.endsWith("/checklist")
      ? "checklist"
      : "overview";

  return (
    <div className="flex gap-0 border-b border-divider px-4">
      <TabLink href={base} active={active === "overview"} label={labels.overview} />
      <TabLink
        href={`${base}/lumi`}
        active={active === "lumi"}
        label={labels.lumi}
      />
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
