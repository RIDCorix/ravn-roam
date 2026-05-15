// Grouped checklist display (suggested / pending / done). Extracted from
// the C-1 trip-detail-tabs so each tab can live as its own route under
// /trips/[id]/{overview,lumi,checklist}.

import type { ChecklistItem } from "@/lib/mock/consumer";
import { cn } from "@/lib/utils";

import { ChecklistRow } from "./checklist-row";

export interface ChecklistViewLabels {
  groups: {
    suggested: string;
    pending: string;
    done: string;
  };
  shopCta: string;
  empty: string;
}

export function ChecklistView({
  items,
  lang,
  labels,
}: {
  items: ChecklistItem[];
  lang: string;
  labels: ChecklistViewLabels;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-10 text-center text-[13px] text-fg-muted">
        {labels.empty}
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
          label={labels.groups.suggested}
          items={grouped.suggested}
          lang={lang}
          shopCta={labels.shopCta}
          tint
        />
      )}
      {grouped.pending.length > 0 && (
        <ChecklistGroup
          label={labels.groups.pending}
          items={grouped.pending}
          lang={lang}
          shopCta={labels.shopCta}
        />
      )}
      {grouped.done.length > 0 && (
        <ChecklistGroup
          label={labels.groups.done}
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
