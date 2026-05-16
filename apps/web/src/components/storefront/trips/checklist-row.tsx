"use client";

// Single checklist line. esim items with shortcut: "shop" render a Link
// to the shop with country/days/gb pre-filled. Each row also has:
//   * a clickable check-circle that toggles done via PATCH
//   * an assignee chip showing the responsible companion; clicking
//     opens a small native <select> to reassign

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { Avatar } from "@/components/storefront/trips/companions-section";
import type { ChecklistItem } from "@/lib/mock/consumer";
import type { ApiCompanion } from "@/lib/trips-api";
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
  tripId,
  companions,
  assigneeLabels,
  lang,
  tint,
  shopCtaLabel,
}: {
  item: ChecklistItem;
  tripId: string;
  companions: ApiCompanion[];
  assigneeLabels: {
    assign: string;
    assigned_to: string;
    unassigned: string;
  };
  lang: string;
  tint?: boolean;
  shopCtaLabel: string;
}) {
  const KindIcon = KIND_ICONS[item.kind] ?? Circle;
  const showShopCta =
    !item.done && item.kind === "esim" && item.shortcut === "shop";

  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<{
    done?: boolean;
    assignedCompanionId?: string | null;
  }>({});
  const done = optimistic.done ?? item.done;
  const assignedId =
    "assignedCompanionId" in optimistic
      ? optimistic.assignedCompanionId
      : (item.assignedCompanionId ?? null);
  const assignee = companions.find((c) => c.id === assignedId);

  function patch(body: Record<string, unknown>) {
    startTransition(async () => {
      await fetch(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    });
  }

  function toggleDone() {
    const next = !done;
    setOptimistic((p) => ({ ...p, done: next }));
    patch({ done: next });
  }

  function reassign(id: string | null) {
    setOptimistic((p) => ({ ...p, assignedCompanionId: id }));
    patch({ assigned_companion_id: id });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3.5 py-2.5",
        done && "opacity-60",
      )}
      style={{
        background: tint ? "rgba(15,184,180,0.06)" : "var(--surface)",
        boxShadow: tint
          ? "inset 0 0 0 1px rgba(15,184,180,0.22)"
          : "var(--shadow-xs)",
      }}
    >
      <button
        type="button"
        onClick={toggleDone}
        disabled={busy}
        aria-label={done ? "uncheck" : "check"}
        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-white transition-colors"
        style={{
          background: done ? "var(--accent)" : "transparent",
          boxShadow: done ? "none" : "inset 0 0 0 1.5px var(--divider-strong)",
        }}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <KindIcon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          tint ? "text-accent" : "text-fg-muted",
        )}
      />

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] text-fg",
          done && "line-through decoration-[var(--fg-muted)]",
        )}
      >
        {item.text}
      </span>

      {/* Assignee — invisible <select> overlay on a visible chip so the
          click area is large and the native picker handles all the a11y. */}
      <label
        className="relative inline-flex shrink-0 items-center"
        title={
          assignee
            ? `${assigneeLabels.assigned_to}: ${assignee.display_name}`
            : assigneeLabels.assign
        }
      >
        {assignee ? (
          <Avatar
            color={assignee.color}
            name={assignee.display_name}
            size={20}
          />
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-divider-strong text-fg-muted">
            <UserPlus className="h-3 w-3" />
          </span>
        )}
        <select
          value={assignedId ?? ""}
          onChange={(e) => reassign(e.target.value || null)}
          disabled={busy}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={assigneeLabels.assign}
        >
          <option value="">{assigneeLabels.unassigned}</option>
          {companions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      </label>

      {item.due && !done && (
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
