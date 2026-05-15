"use client";

// Trip Detail body: tab switcher + two tab panels (Overview, Checklist).
// Phase C-1 leaves the Lumi tab out — that lands in C-2.

import { useState } from "react";

import type { ChecklistItem, Trip } from "@/lib/mock/consumer";
import { cn } from "@/lib/utils";

import { ChecklistRow } from "./checklist-row";
import { DailyTimeline } from "./daily-timeline";

type TabId = "overview" | "checklist";

export interface TripDetailLabels {
  tabs: {
    overview: string;
    checklist: string;
  };
  timelineSection: string;
  todayBadge: string;
  dayLabelTemplate: string;
  checklistGroups: {
    suggested: string;
    pending: string;
    done: string;
  };
  shopCta: string;
  emptyChecklist: string;
}

export function TripDetailTabs({
  trip,
  lang,
  labels,
}: {
  trip: Trip;
  lang: string;
  labels: TripDetailLabels;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const pendingCount = trip.checklist.filter((t) => !t.done).length;

  return (
    <div>
      <div className="flex gap-0 border-b border-divider px-4">
        <TabButton
          active={tab === "overview"}
          onClick={() => setTab("overview")}
          label={labels.tabs.overview}
        />
        <TabButton
          active={tab === "checklist"}
          onClick={() => setTab("checklist")}
          label={labels.tabs.checklist}
          count={pendingCount}
        />
      </div>

      <div className="px-5 pb-6 pt-4">
        {tab === "overview" ? (
          <DailyTimeline
            trip={trip}
            sectionLabel={labels.timelineSection}
            todayLabel={labels.todayBadge}
            dayLabelTemplate={labels.dayLabelTemplate}
          />
        ) : (
          <ChecklistView
            items={trip.checklist}
            lang={lang}
            labels={labels}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
    </button>
  );
}

function ChecklistView({
  items,
  lang,
  labels,
}: {
  items: ChecklistItem[];
  lang: string;
  labels: TripDetailLabels;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-10 text-center text-[13px] text-fg-muted">
        {labels.emptyChecklist}
      </div>
    );
  }

  const grouped = {
    suggested: items.filter((t) => !t.done && t.suggested),
    pending: items.filter((t) => !t.done && !t.suggested),
    done: items.filter((t) => t.done),
  };

  return (
    <div className="flex flex-col gap-5">
      {grouped.suggested.length > 0 && (
        <ChecklistGroup
          label={labels.checklistGroups.suggested}
          items={grouped.suggested}
          lang={lang}
          shopCta={labels.shopCta}
          tint
        />
      )}
      {grouped.pending.length > 0 && (
        <ChecklistGroup
          label={labels.checklistGroups.pending}
          items={grouped.pending}
          lang={lang}
          shopCta={labels.shopCta}
        />
      )}
      {grouped.done.length > 0 && (
        <ChecklistGroup
          label={labels.checklistGroups.done}
          items={grouped.done}
          lang={lang}
          shopCta={labels.shopCta}
        />
      )}
    </div>
  );
}

function ChecklistGroup({
  label,
  items,
  lang,
  shopCta,
  tint,
}: {
  label: string;
  items: ChecklistItem[];
  lang: string;
  shopCta: string;
  tint?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 px-1">
        <span
          className={cn(
            "text-[12px] font-semibold uppercase tracking-[0.04em]",
            tint ? "text-accent" : "text-fg-secondary",
          )}
        >
          {label}
        </span>
        <span
          className="text-[11px] text-fg-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            lang={lang}
            tint={tint}
            shopCtaLabel={shopCta}
          />
        ))}
      </div>
    </section>
  );
}
