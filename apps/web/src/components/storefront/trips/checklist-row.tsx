// Single checklist line. Ports design/app/components/Lumi.jsx →
// ChecklistItem. esim items with shortcut: "shop" render a Link to the
// shop with country / days / gb pre-filled in the query string (C-4
// will wire the prefilter to actually filter).

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  File,
  Flame,
  Home as HomeIcon,
  Package,
  Plane,
  Receipt,
  Signal,
  type LucideIcon,
} from "lucide-react";

import type { ChecklistItem } from "@/lib/mock/consumer";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<ChecklistItem["kind"], LucideIcon> = {
  esim: Signal,
  money: Flame,
  flight: Plane,
  stay: HomeIcon,
  ticket: Receipt,
  visa: File,
  doc: File,
  gear: Package,
  transit: ArrowRight,
  insurance: CheckCircle2,
};

export function ChecklistRow({
  item,
  lang,
  tint,
  shopCtaLabel,
}: {
  item: ChecklistItem;
  lang: string;
  tint?: boolean;
  shopCtaLabel: string;
}) {
  const KindIcon = KIND_ICONS[item.kind] ?? Circle;
  const showShopCta =
    !item.done && item.kind === "esim" && item.shortcut === "shop";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3.5 py-2.5",
        item.done && "opacity-60",
      )}
      style={{
        background: tint ? "rgba(15,184,180,0.06)" : "var(--surface)",
        boxShadow: tint
          ? "inset 0 0 0 1px rgba(15,184,180,0.22)"
          : "var(--shadow-xs)",
      }}
    >
      <span
        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-white"
        style={{
          background: item.done ? "var(--accent)" : "transparent",
          boxShadow: item.done
            ? "none"
            : "inset 0 0 0 1.5px var(--divider-strong)",
        }}
        aria-hidden="true"
      >
        {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>

      <KindIcon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          tint ? "text-accent" : "text-fg-muted",
        )}
      />

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] text-fg",
          item.done && "line-through decoration-[var(--fg-muted)]",
        )}
      >
        {item.text}
      </span>

      {item.due && !item.done && (
        <span
          className="shrink-0 whitespace-nowrap text-[11px] text-warning"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {item.due.slice(5)}
        </span>
      )}

      {showShopCta && (
        <Link
          href={buildShopHref(lang, item)}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ background: "#111" }}
        >
          <ArrowUpRight className="h-2.5 w-2.5" />
          {shopCtaLabel}
        </Link>
      )}
    </div>
  );
}

function buildShopHref(lang: string, item: ChecklistItem): string {
  const filter = item.shopFilter;
  const params = new URLSearchParams();
  if (filter?.country) params.set("country", filter.country);
  if (filter?.days != null) params.set("days", String(filter.days));
  if (filter?.gb != null) params.set("gb", String(filter.gb));
  const qs = params.toString();
  return qs ? `/${lang}/shop?${qs}` : `/${lang}/shop`;
}
