"use client";

// Trip Detail body. Tabs are: 概覽 / 清單 / Day 1 / Day 2 / …
// The tab bar scrolls horizontally so long trips don't break the layout.
// Lumi itself lives at the storefront shell level — when she edits the
// itinerary, she calls router.refresh() and the new trip.days arrive as
// fresh props here.

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  FilePenLine,
  Image as ImageIcon,
  List,
  Loader2,
  Plane,
  Receipt,
  Smartphone,
  Ticket,
  Upload,
  X,
} from "lucide-react";

import {
  getUnreadDays,
  markDayRead,
  UNREAD_CHANGED_EVENT,
} from "@/lib/lumi-unread";
import { Input } from "@/components/ui/input";
import { compressImageToDataUrl } from "@/lib/image-compression";
import { refreshTrip } from "@/lib/trip-cache";
import type { ChecklistItem, Trip, TripDay, TripStop } from "@/lib/trip-types";
import { cn } from "@/lib/utils";

import type { ApiCompanion } from "@/lib/trips-api";

import { ChecklistRow } from "./checklist-row";
import { DailyTimeline } from "./daily-timeline";
import type { TripMapCity } from "./trip-map";

/* Same dynamic import path as DailyTimeline → Next.js dedupes the chunk,
   so the Day-N map shares one bundle with the overview map. */
const TripMap = dynamic(() => import("./trip-map").then((m) => m.TripMap), {
  ssr: false,
  loading: () => (
    <div
      className="h-40 rounded-2xl"
      style={{ background: "linear-gradient(135deg, #DCF4F3 0%, #ECF0FE 100%)" }}
    />
  ),
});

type TabId = "overview" | "checklist" | `day:${number}`;

export interface TripDetailLabels {
  tabs: {
    overview: string;
    checklist: string;
    // Used for both the tab pill ("Day 1") and the grey caption inside
    // the day view; "{n}" is replaced with the 1-based day number.
    day_short?: string;
  };
  timelineSection: string;
  todayBadge: string;
  dayLabelTemplate: string;
  checklistGroups: {
    suggested: string;
    pending: string;
    done: string;
  };
  checklistFilters: {
    all: string;
    mine: string;
  };
  shopCta: string;
  esimOrderLabels?: {
    pending: string;
    ready: string;
    shared: string;
  };
  esimShareLabels?: {
    title: string;
    description: string;
    cta: string;
    sharing: string;
    shared: string;
    empty: string;
    error: string;
  };
  emptyChecklist: string;
  assigneeLabels: {
    assign: string;
    assigned_to: string;
    unassigned: string;
  };
  quickInfo: {
    title: string;
    ready: string;
    prepare: string;
    view: string;
    empty: string;
    source_task: string;
    install_esim_cta: string;
    install_esim: string;
    copy_activation_code: string;
    copied: string;
    open_qr_code: string;
  };
}

export function TripDetailTabs({
  trip,
  cities,
  companions,
  lang,
  labels,
}: {
  trip: Trip;
  cities: TripMapCity[];
  companions: ApiCompanion[];
  lang: string;
  labels: TripDetailLabels;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const pendingCount = trip.checklist.filter((t) => !t.done).length;
  const dayShortTemplate = labels.tabs.day_short ?? labels.dayLabelTemplate;

  // Unread day indices — set by LumiAssistant via localStorage when Lumi
  // edits the itinerary. Reading here renders the yellow dot indicator.
  const [unreadDays, setUnreadDays] = useState<Set<number>>(new Set());
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUnreadDays(getUnreadDays(trip.id));
    }, 0);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tripId?: string }>).detail;
      if (detail?.tripId && detail.tripId !== trip.id) return;
      setUnreadDays(getUnreadDays(trip.id));
    };
    window.addEventListener(UNREAD_CHANGED_EVENT, handler);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(UNREAD_CHANGED_EVENT, handler);
    };
  }, [trip.id]);

  const selectTab = (next: TabId) => {
    setTab(next);
    const idx = dayIndexFromTab(next);
    if (idx != null && unreadDays.has(idx)) {
      markDayRead(trip.id, idx);
    }
  };

  // When Lumi adds or removes a day, trip.days arrives changed via
  // router.refresh(). Auto-jump to the newly-added tail day; clamp out of
  // a now-invalid day tab.
  const prevLengthRef = useRef(trip.days.length);
  useEffect(() => {
    const prev = prevLengthRef.current;
    const next = trip.days.length;
    if (next > prev) {
      window.setTimeout(() => selectTab(`day:${next - 1}`), 0);
    } else if (next < prev) {
      const idx = dayIndexFromTab(tab);
      if (idx != null && idx >= next) {
        window.setTimeout(() => setTab("overview"), 0);
      }
    }
    prevLengthRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.days.length]);

  return (
    <div>
      <div className="border-b border-divider">
        <div className="flex gap-0 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabButton
            active={tab === "overview"}
            onClick={() => selectTab("overview")}
            label={labels.tabs.overview}
          />
          <TabButton
            active={tab === "checklist"}
            onClick={() => selectTab("checklist")}
            label={labels.tabs.checklist}
            count={pendingCount}
          />
          {trip.days.map((d, i) => (
            <TabButton
              key={i}
              active={tab === `day:${i}`}
              onClick={() => selectTab(`day:${i}`)}
              label={dayShortTemplate.replace("{n}", String(i + 1))}
              count={d.stops?.length ?? 0}
              tone="compact"
              unread={unreadDays.has(i)}
            />
          ))}
        </div>
      </div>

      <div className="px-5 pb-6 pt-4">
        {tab === "overview" ? (
          <div className="flex flex-col gap-5">
            <QuickInfoPanel
              trip={trip}
              labels={labels.quickInfo}
              onPrepare={() => selectTab("checklist")}
            />
            <DailyTimeline
              trip={trip}
              cities={cities}
              sectionLabel={labels.timelineSection}
              todayLabel={labels.todayBadge}
              dayLabelTemplate={labels.dayLabelTemplate}
            />
          </div>
        ) : tab === "checklist" ? (
          <ChecklistView
            items={trip.checklist}
            tripId={trip.id}
            companions={companions}
            lang={lang}
            labels={labels}
          />
        ) : (
          <DayView
            tripId={trip.id}
            day={trip.days[dayIndexFromTab(tab) ?? 0]}
            prevDay={trip.days[(dayIndexFromTab(tab) ?? 0) - 1]}
            index={dayIndexFromTab(tab) ?? 0}
            dayLabelTemplate={dayShortTemplate}
            cities={cities}
          />
        )}
      </div>
    </div>
  );
}

// ─── Fast-access travel docs ───────────────────────────────────────────

type QuickInfoSource =
  | {
      kind: "attachment";
      key: string;
      type: string;
      title: string;
      subtitle: string;
      dayLabel: string;
      ready: boolean;
      checklistItemId: string | null;
      checklistText: string | null;
      attachment: NonNullable<TripStop["attachments"]>[number];
      imageDataUrl?: string | null;
      imageName?: string | null;
      dateISO?: string | null;
    }
  | {
      kind: "task";
      key: string;
      type: ChecklistItem["kind"];
      title: string;
      subtitle: string;
      dayLabel: string;
      ready: boolean;
      checklistItemId: string;
      checklistText: string;
      attachment: NonNullable<TripStop["attachments"]>[number] | null;
      imageDataUrl?: string | null;
      imageName?: string | null;
      dateISO?: string | null;
    };

const QUICK_ATTACHMENT_TYPES = new Set([
  "flight",
  "booking",
  "reservation",
  "ticket",
  "transit",
  "document",
]);
function QuickInfoPanel({
  trip,
  labels,
  onPrepare,
}: {
  trip: Trip;
  labels: TripDetailLabels["quickInfo"];
  onPrepare: () => void;
}) {
  const items = buildQuickInfoItems(trip);
  const [openItem, setOpenItem] = useState<QuickInfoSource | null>(null);

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">
          {labels.title}
        </h2>
        <span className="text-[11px] text-fg-muted">
          {items.filter((item) => item.ready).length}/{items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-5 text-[13px] text-fg-muted">
          {labels.empty}
        </div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <QuickInfoCard
              key={item.key}
              item={item}
              labels={labels}
              onView={() => setOpenItem(item)}
              onPrepare={onPrepare}
            />
          ))}
        </div>
      )}

      {openItem && (
        <QuickInfoModal
          item={openItem}
          labels={labels}
          onClose={() => setOpenItem(null)}
          onPrepare={() => {
            setOpenItem(null);
            onPrepare();
          }}
        />
      )}
    </section>
  );
}

function QuickInfoCard({
  item,
  labels,
  onView,
  onPrepare,
}: {
  item: QuickInfoSource;
  labels: TripDetailLabels["quickInfo"];
  onView: () => void;
  onPrepare: () => void;
}) {
  return (
    <article
      className={cn(
        "flex min-h-[132px] w-[220px] shrink-0 flex-col justify-between rounded-2xl border bg-surface p-3.5",
        item.ready
          ? "border-[rgba(15,184,180,0.26)]"
          : "border-[rgba(217,119,6,0.28)]",
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-xl",
              item.ready
                ? "bg-accent-softer text-accent"
                : "bg-warning-soft text-warning",
            )}
          >
            <QuickInfoGlyph type={item.type} className="h-4 w-4" />
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              item.ready
                ? "bg-accent-softer text-accent"
                : "bg-warning-soft text-warning",
            )}
          >
            {item.ready ? labels.ready : labels.prepare}
          </span>
        </div>
        <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-fg">
          {item.title}
        </h3>
        <p className="mt-1 truncate text-[11px] text-fg-muted">
          {item.dayLabel ? `${item.dayLabel} · ` : ""}
          {item.subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={item.ready ? onView : onPrepare}
        className={cn(
          "mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors",
          item.ready
            ? "bg-fg text-white hover:bg-cta-hover"
            : "bg-warning-soft text-warning hover:bg-[rgba(217,153,78,0.18)]",
        )}
      >
        {item.ready ? labels.view : labels.prepare}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}

function QuickInfoModal({
  item,
  labels,
  onClose,
  onPrepare,
}: {
  item: QuickInfoSource;
  labels: TripDetailLabels["quickInfo"];
  onClose: () => void;
  onPrepare: () => void;
}) {
  const attachment = item.attachment;
  const imageDataUrl = attachment?.imageDataUrl ?? item.imageDataUrl ?? null;
  const imageName = attachment?.imageName ?? item.imageName ?? null;
  const [copied, setCopied] = useState(false);
  const isIOS =
    typeof window !== "undefined" &&
    (/iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1));
  const isEsim = item.type === "esim" && item.ready;
  const activationCode = normalizeLpaActivationCode(attachment?.amount);
  const appleInstallUrl = activationCode
    ? `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(activationCode)}`
    : null;
  async function copyActivationCode() {
    if (!activationCode) return;
    await navigator.clipboard.writeText(activationCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10 md:items-center md:pb-10">
      <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-divider bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-divider px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-fg">
              <QuickInfoGlyph type={item.type} className="h-4 w-4 text-accent" />
              <span className="truncate">{item.title}</span>
            </div>
            <div className="mt-0.5 truncate text-[12px] text-fg-muted">
              {item.dayLabel ? `${item.dayLabel} · ` : ""}
              {item.subtitle}
            </div>
          </div>
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-[rgba(0,0,0,0.04)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {imageDataUrl ? (
            <Image
              src={imageDataUrl}
              alt={imageName ?? item.title}
              width={800}
              height={520}
              unoptimized
              className="max-h-[54vh] w-full rounded-xl object-contain bg-surface-sunken"
            />
          ) : (
            <div className="rounded-xl bg-surface-sunken px-4 py-5 text-[13px] leading-6 text-fg-secondary">
              {item.checklistText
                ? `${labels.source_task}：${item.checklistText}`
                : item.subtitle}
            </div>
          )}

          {attachment?.amount ? (
            <div className="break-all rounded-xl bg-surface-sunken px-4 py-3 text-[13px] leading-6 text-fg-secondary">
              {attachment.amount}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            {!item.ready && (
              <button
                type="button"
                onClick={onPrepare}
                className="rounded-full bg-warning-soft px-4 py-2 text-[13px] font-semibold text-warning"
              >
                {labels.prepare}
              </button>
            )}
            {attachment?.url ? (
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-fg px-4 py-2 text-[13px] font-semibold text-white"
              >
                {isEsim ? labels.open_qr_code : labels.view}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {isEsim && isIOS && appleInstallUrl ? (
              <a
                href={appleInstallUrl}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white"
              >
                {labels.install_esim_cta}
                <Smartphone className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {isEsim && activationCode ? (
              <button
                type="button"
                onClick={copyActivationCode}
                className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-4 py-2 text-[13px] font-semibold text-fg"
              >
                {copied ? labels.copied : labels.copy_activation_code}
                <Copy className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {isEsim ? (
            <div className="rounded-xl bg-accent-softer px-4 py-3 text-[12px] leading-5 text-fg-secondary">
              {labels.install_esim}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function normalizeLpaActivationCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase().startsWith("LPA:") ? trimmed : null;
}

function buildQuickInfoItems(trip: Trip): QuickInfoSource[] {
  const checklistById = new Map(trip.checklist.map((item) => [item.id, item]));
  const attachmentByChecklistId = new Map<
    string,
    {
      attachment: NonNullable<TripStop["attachments"]>[number];
      stopName: string;
      dayLabel: string;
      dateISO: string;
    }
  >();
  const standaloneAttachments: QuickInfoSource[] = [];

  trip.days.forEach((day, dayIndex) => {
    (day.stops ?? []).forEach((stop) => {
      (stop.attachments ?? []).forEach((attachment) => {
        if (!QUICK_ATTACHMENT_TYPES.has(attachment.type)) return;
        const linked =
          attachment.checklistItemId != null
            ? checklistById.get(attachment.checklistItemId)
            : undefined;
        if (attachment.checklistItemId && linked) {
          attachmentByChecklistId.set(attachment.checklistItemId, {
            attachment,
            stopName: stop.name,
            dayLabel: `Day ${dayIndex + 1}`,
            dateISO: day.d,
          });
          return;
        }
        const ready =
          attachment.done ||
          attachment.status === "uploaded" ||
          attachment.status === "completed" ||
          Boolean(attachment.url || attachment.imageDataUrl) ||
          Boolean(linked?.done);
        standaloneAttachments.push({
          kind: "attachment",
          key: `a-${dayIndex}-${stop.id ?? stop.name}-${attachment.id}`,
          type: attachment.type,
          title: attachment.label,
          subtitle: stop.name,
          dayLabel: `Day ${dayIndex + 1}`,
          dateISO: day.d,
          ready,
          checklistItemId: attachment.checklistItemId ?? null,
          checklistText: attachment.checklistText ?? linked?.text ?? null,
          attachment,
        });
      });
    });
  });

  const out: QuickInfoSource[] = [];
  const emittedChecklistIds = new Set<string>();
  const today = localTodayISO();

  const openActionable = trip.checklist
    .filter((task) => !task.done && isChecklistActionable(task, today))
    .sort(compareChecklistByDueDate);

  for (const task of openActionable) {
    out.push(checklistToQuickInfo(task, attachmentByChecklistId.get(task.id)));
    emittedChecklistIds.add(task.id);
  }

  trip.checklist.forEach((task) => {
    if (emittedChecklistIds.has(task.id)) return;
    if (!checklistHasAttachment(task, attachmentByChecklistId)) return;
    out.push(checklistToQuickInfo(task, attachmentByChecklistId.get(task.id)));
    emittedChecklistIds.add(task.id);
  });

  standaloneAttachments.sort(compareQuickInfoItems);
  return [
    ...buildTripEsimQuickInfoItems(trip),
    ...out,
    ...standaloneAttachments,
  ].slice(0, 8);
}

function buildTripEsimQuickInfoItems(trip: Trip): QuickInfoSource[] {
  const raw = trip.metadata?.esims;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item, index) => {
      const companionName = String(item.companion_name ?? "");
      const productName = String(item.product_name ?? "eSIM");
      const qrcodeUrl =
        typeof item.qrcode_url === "string" ? item.qrcode_url : null;
      const qrcodeContent =
        typeof item.qrcode_content === "string" ? item.qrcode_content : null;
      const redemptionCode =
        typeof item.redemption_code === "string" ? item.redemption_code : null;
      return {
        kind: "attachment" as const,
        key: `esim-${String(item.id ?? index)}`,
        type: "esim",
        title: companionName ? `${companionName} · eSIM` : "eSIM",
        subtitle: productName,
        dayLabel: "",
        dateISO: typeof item.assigned_at === "string" ? item.assigned_at.slice(0, 10) : null,
        ready: Boolean(qrcodeUrl || qrcodeContent || redemptionCode),
        checklistItemId:
          typeof item.checklist_item_id === "string"
            ? item.checklist_item_id
            : null,
        checklistText: productName,
        attachment: {
          id: String(item.id ?? `esim-${index}`),
          type: "esim",
          label: productName,
          url: qrcodeUrl,
          amount: qrcodeContent ?? redemptionCode,
          actionLabel: null,
          checklistItemId:
            typeof item.checklist_item_id === "string"
              ? item.checklist_item_id
              : null,
          checklistText: productName,
          checklistKind: "esim",
          imageName: null,
          imageDataUrl: null,
          status: "completed",
          done: true,
        },
      };
    });
}

function checklistToQuickInfo(
  task: ChecklistItem,
  linked:
    | {
        attachment: NonNullable<TripStop["attachments"]>[number];
        stopName: string;
        dayLabel: string;
        dateISO: string;
      }
    | undefined,
): QuickInfoSource {
  const imageSubtask = task.subtasks?.find((subtask) => subtask.imageDataUrl);
  const hasViewableAttachment =
    Boolean(linked?.attachment.url || linked?.attachment.imageDataUrl) ||
    Boolean(imageSubtask?.imageDataUrl);

  return {
    kind: "task",
    key: `t-${task.id}`,
    type: task.kind,
    title: task.text,
    subtitle: linked?.stopName ?? imageSubtask?.text ?? task.groupLabel ?? "",
    dayLabel: linked?.dayLabel ?? formatChecklistDateLabel(task),
    dateISO: linked?.dateISO ?? task.due ?? task.start ?? null,
    ready: task.done || hasViewableAttachment,
    checklistItemId: task.id,
    checklistText: task.text,
    attachment: linked?.attachment ?? null,
    imageDataUrl:
      imageSubtask?.imageDataUrl ?? linked?.attachment.imageDataUrl ?? null,
    imageName: imageSubtask?.imageName ?? linked?.attachment.imageName ?? null,
  };
}

function checklistHasAttachment(
  task: ChecklistItem,
  attachmentByChecklistId: Map<string, unknown>,
): boolean {
  return (
    attachmentByChecklistId.has(task.id) ||
    Boolean(task.subtasks?.some((subtask) => subtask.imageDataUrl))
  );
}

function isChecklistActionable(task: ChecklistItem, today: string): boolean {
  if (!task.start) return true;
  return task.start <= today;
}

function compareChecklistByDueDate(a: ChecklistItem, b: ChecklistItem): number {
  const dueDelta = checklistDueRank(a) - checklistDueRank(b);
  if (dueDelta !== 0) return dueDelta;
  const startDelta = checklistStartRank(a) - checklistStartRank(b);
  if (startDelta !== 0) return startDelta;
  return a.text.localeCompare(b.text);
}

function checklistDueRank(task: ChecklistItem): number {
  return task.due ? Date.parse(`${task.due}T00:00:00`) : Number.MAX_SAFE_INTEGER;
}

function checklistStartRank(task: ChecklistItem): number {
  return task.start
    ? Date.parse(`${task.start}T00:00:00`)
    : Number.MAX_SAFE_INTEGER;
}

function formatChecklistDateLabel(task: ChecklistItem): string {
  if (task.due) return task.due.slice(5);
  if (task.start) return task.start.slice(5);
  return "";
}

function compareQuickInfoItems(a: QuickInfoSource, b: QuickInfoSource): number {
  if (a.ready !== b.ready) return a.ready ? -1 : 1;
  const dateDelta = quickInfoDateRank(a.dateISO) - quickInfoDateRank(b.dateISO);
  if (dateDelta !== 0) return dateDelta;
  return quickInfoRank(a.type) - quickInfoRank(b.type);
}

function quickInfoDateRank(dateISO: string | null | undefined): number {
  if (!dateISO) return 100_000;
  const today = localTodayISO();
  const days = Math.round(
    (Date.parse(`${dateISO}T00:00:00`) - Date.parse(`${today}T00:00:00`)) /
      86_400_000,
  );
  if (days === 0) return 0;
  if (days > 0) return days;
  return 20_000 + Math.abs(days);
}

function localTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function quickInfoRank(type: string): number {
  const ranks: Record<string, number> = {
    flight: 0,
    transit: 1,
    stay: 2,
    booking: 2,
    reservation: 3,
    ticket: 4,
    visa: 5,
    doc: 6,
    document: 6,
    esim: 7,
    insurance: 8,
  };
  return ranks[type] ?? 20;
}

function QuickInfoGlyph({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  if (type === "flight" || type === "transit") {
    return <Plane className={className} strokeWidth={2} />;
  }
  if (type === "stay" || type === "booking" || type === "reservation") {
    return <CalendarCheck className={className} strokeWidth={2} />;
  }
  if (type === "visa" || type === "doc" || type === "document") {
    return <FilePenLine className={className} strokeWidth={2} />;
  }
  if (type === "esim") return <Receipt className={className} strokeWidth={2} />;
  if (type === "insurance") {
    return <CheckCircle2 className={className} strokeWidth={2} />;
  }
  return <Ticket className={className} strokeWidth={2} />;
}

// ─── Day view ──────────────────────────────────────────────────────────

function DayView({
  tripId,
  day,
  prevDay,
  index,
  dayLabelTemplate,
  cities,
}: {
  tripId: string;
  day: TripDay | undefined;
  /* Previous day in the itinerary, if any. Used to draw "today's move"
     as a solid segment on the map when prevDay.city !== day.city. */
  prevDay: TripDay | undefined;
  index: number;
  dayLabelTemplate: string;
  cities: TripMapCity[];
}) {
  const [activeStop, setActiveStop] = useState<{
    day: string;
    index: number;
  } | null>(null);
  const activeStopIndex =
    activeStop && activeStop.day === day?.d ? activeStop.index : null;
  const focusStop = (stopIndex: number) => {
    if (!day) return;
    setActiveStop({ day: day.d, index: stopIndex });
  };

  if (!day) {
    return (
      <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-10 text-center text-[13px] text-fg-muted">
        ✕
      </div>
    );
  }
  /* Materialize the day's stops for the map. The API always seeds at least
     one stop named after `city` (see migration 0009), but legacy mock data
     might still have undefined — fall back to the city as a single stop. */
  const stops: TripStop[] =
    day.stops && day.stops.length > 0
      ? day.stops
      : [{ name: day.city, kind: "other", lat: null, lng: null }];
  const dayStops: TripMapCity[] = stops.map((s) => ({
    name: s.name,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <TripMap
        cities={cities}
        activeCity={day.city}
        activeLegFrom={prevDay?.city ?? null}
        dayStops={dayStops}
        activeStopIndex={activeStopIndex}
      />
      <div className="flex flex-col gap-3 px-1">
        <div
          className="text-[11px] font-medium uppercase tracking-[0.06em] text-fg-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {dayLabelTemplate.replace("{n}", String(index + 1))} · {day.d.slice(5)}
        </div>
        {/* Headline = Lumi-written `note` when present; falls back to city
            for unplanned days. City is then shown as a small caption when
            it adds info (i.e. note isn't just the city name). */}
        {(() => {
          const note = day.note?.trim();
          const headline = note || day.city;
          const showCity = note && note !== day.city;
          return (
            <>
              <div className="text-[22px] font-semibold tracking-[-0.01em] text-fg">
                {headline}
              </div>
              {showCity && (
                <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-fg-muted">
                  {day.city}
                </div>
              )}
            </>
          );
        })()}
        {day.stops && day.stops.length > 0 && (
          <StopsTimeline
            tripId={tripId}
            city={day.city}
            stops={day.stops}
            activeStopIndex={activeStopIndex}
            onFocusStop={focusStop}
          />
        )}
      </div>
    </div>
  );
}

type StopsView = "list" | "calendar";
const STOPS_VIEW_KEY = "roam-trip-stops-view";

/* Day stops, in either of two flavors:
     • list — time on the LEFT in a fixed column so each row aligns,
       name + chips on the right. Reads quickly.
     • calendar — Google Calendar-style proportional timeline: hours
       run vertically on the y-axis and each stop is a positioned
       block sized by its real duration.
   Stops missing arrival_time still render in the list flavor and
   appear in an "unscheduled" group at the bottom of the calendar
   flavor — they shouldn't disappear just because Lumi forgot a time. */
function StopsTimeline({
  tripId,
  city,
  stops,
  activeStopIndex,
  onFocusStop,
}: {
  tripId: string;
  city: string;
  stops: NonNullable<TripDay["stops"]>;
  activeStopIndex: number | null;
  onFocusStop: (index: number) => void;
}) {
  const [view, setView] = useState<StopsView>("list");
  // Hydrate the toggle from localStorage after mount so SSR markup
  // stays stable; flip is then persisted across day switches.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STOPS_VIEW_KEY);
      if (saved === "calendar" || saved === "list") setView(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STOPS_VIEW_KEY, view);
  }, [view]);

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>
      {view === "list" ? (
        <StopsList
          tripId={tripId}
          city={city}
          stops={stops}
          activeStopIndex={activeStopIndex}
          onFocusStop={onFocusStop}
        />
      ) : (
        <StopsCalendar
          tripId={tripId}
          city={city}
          stops={stops}
          activeStopIndex={activeStopIndex}
          onFocusStop={onFocusStop}
        />
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: StopsView;
  onChange: (v: StopsView) => void;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center rounded-full border border-divider bg-white p-0.5 text-fg-muted shadow-xs"
    >
      <ToggleButton
        active={view === "list"}
        onClick={() => onChange("list")}
        label="清單"
        icon={<List className="h-3 w-3" />}
      />
      <ToggleButton
        active={view === "calendar"}
        onClick={() => onChange("calendar")}
        label="行事曆"
        icon={<CalendarClock className="h-3 w-3" />}
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
        active ? "bg-accent text-white shadow-xs" : "text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StopsList({
  tripId,
  city,
  stops,
  activeStopIndex,
  onFocusStop,
}: {
  tripId: string;
  city: string;
  stops: NonNullable<TripDay["stops"]>;
  activeStopIndex?: number | null;
  onFocusStop?: (index: number) => void;
}) {
  return (
    <ol className="relative grid grid-cols-[58px_32px_minmax(0,1fr)_40px] gap-x-2">
      <span className="absolute bottom-4 left-[73px] top-4 w-px bg-divider" />
      {stops.map((s, i) => {
        const startEnd = computeStartEnd(s.arrival_time, s.duration_min);
        return (
          <li
            key={i}
            className="relative col-span-4 grid grid-cols-subgrid items-start py-2"
          >
            <div
              className="pt-1 text-right"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {s.arrival_time ? (
                <>
                  <div className="text-[12px] font-semibold leading-tight text-fg">
                    {startEnd?.start ?? s.arrival_time}
                  </div>
                  {startEnd?.end && (
                    <div className="text-[10.5px] leading-tight text-fg-muted">
                      {startEnd.end}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[10.5px] text-fg-muted">—</div>
              )}
            </div>
            <span
              className="relative z-10 mt-0.5 inline-flex h-7 w-7 items-center justify-center justify-self-center rounded-full bg-white text-[10px] font-semibold text-accent"
              style={{
                boxShadow:
                  "inset 0 0 0 1.5px var(--accent), 0 1px 3px rgba(0,0,0,0.06)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <button
                type="button"
                onClick={() => onFocusStop?.(i)}
                className={cn(
                  "w-full rounded-xl px-1 py-0.5 text-left transition-colors",
                  activeStopIndex === i
                    ? "bg-accent-softer"
                    : "hover:bg-surface-sunken",
                )}
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="min-w-0 break-words text-[15px] font-semibold leading-tight text-fg">
                    {s.name}
                  </span>
                  <KindChip kind={s.kind} />
                  {s.duration_min ? (
                    <span className="text-[11px] text-fg-muted">
                      · {formatDuration(s.duration_min)}
                    </span>
                  ) : null}
                </div>
                {s.note ? (
                  <div className="text-[13px] leading-relaxed text-fg-secondary">
                    {s.note}
                  </div>
                ) : null}
              </button>
            </div>
            <div className="flex justify-end pt-0">
              <StopActions
                tripId={tripId}
                stop={s}
                city={city}
                attachments={s.attachments ?? []}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* Proportional day-column. Time axis on the left (one tick per hour),
   stops drawn as positioned blocks whose top + height come from real
   arrival_time + duration_min. Looks like Google Calendar's day view. */
function StopsCalendar({
  tripId,
  city,
  stops,
  activeStopIndex,
  onFocusStop,
}: {
  tripId: string;
  city: string;
  stops: NonNullable<TripDay["stops"]>;
  activeStopIndex: number | null;
  onFocusStop: (index: number) => void;
}) {
  const PX_PER_MIN = 1.2; // → 1 hour = 72px, ~17h visible window ≈ 1224px tall
  const HOUR_PX = PX_PER_MIN * 60;

  type Scheduled = {
    stop: NonNullable<TripDay["stops"]>[number];
    start: number;
    end: number;
    index: number;
  };
  const scheduled: Scheduled[] = [];
  const unscheduled: { stop: NonNullable<TripDay["stops"]>[number]; index: number }[] = [];
  stops.forEach((s, index) => {
    const start = parseMinutes(s.arrival_time);
    if (start == null) {
      unscheduled.push({ stop: s, index });
      return;
    }
    const dur = s.duration_min && s.duration_min > 0 ? s.duration_min : 30;
    scheduled.push({ stop: s, start, end: start + dur, index });
  });

  if (scheduled.length === 0) {
    // Nothing has a real time — fall back to the list view rather than
    // an empty grid.
    return (
      <StopsList
        tripId={tripId}
        city={city}
        stops={stops}
        activeStopIndex={activeStopIndex}
        onFocusStop={onFocusStop}
      />
    );
  }

  const earliest = Math.min(...scheduled.map((s) => s.start));
  const latest = Math.max(...scheduled.map((s) => s.end));
  const startHour = Math.floor(earliest / 60);
  const endHour = Math.ceil(latest / 60);
  const startMin = startHour * 60;
  const endMin = endHour * 60;
  const totalMin = Math.max(60, endMin - startMin);
  const totalPx = totalMin * PX_PER_MIN;
  const hours = endHour - startHour;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative ml-1 overflow-hidden rounded-xl border border-divider bg-surface"
        style={{ height: totalPx + 16 }}
      >
        {/* Hour rows */}
        {Array.from({ length: hours + 1 }).map((_, h) => {
          const top = h * HOUR_PX + 8;
          const label = `${pad2(startHour + h)}:00`;
          return (
            <div
              key={`h-${h}`}
              className="pointer-events-none absolute inset-x-0 flex items-start"
              style={{ top }}
            >
              <span
                className="w-12 shrink-0 pr-2 text-right text-[10.5px] text-fg-muted"
                style={{
                  fontFamily: "var(--font-mono)",
                  transform: "translateY(-6px)",
                }}
              >
                {label}
              </span>
              <span className="mt-0 flex-1 border-t border-divider/70" />
            </div>
          );
        })}
        {/* Stop blocks */}
        {scheduled.map(({ stop, start, end, index }) => {
          const top = (start - startMin) * PX_PER_MIN + 8;
          const height = Math.max(28, (end - start) * PX_PER_MIN - 2);
          return (
            <div
              role="button"
              tabIndex={0}
              key={`s-${index}`}
              onClick={() => onFocusStop(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onFocusStop(index);
                }
              }}
              className={cn(
                "absolute right-2 overflow-visible rounded-lg border px-2 py-1.5 text-left transition-colors",
                activeStopIndex === index
                  ? "border-accent bg-accent-softer"
                  : "border-accent/40 bg-[rgba(15,184,180,0.08)] hover:bg-accent-softer",
              )}
              style={{ top, height, left: 56 }}
            >
              <div className="flex items-start gap-1.5">
                <span
                  className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-accent"
                  style={{
                    boxShadow: "inset 0 0 0 1.25px var(--accent)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold leading-tight text-fg">
                    {stop.name}
                  </div>
                  <div
                    className="mt-0.5 truncate text-[10.5px] text-fg-muted"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {formatTimeRange(stop.arrival_time, stop.duration_min) ??
                      stop.arrival_time}
                  </div>
                  <div className="mt-1">
                    <StopActions
                      tripId={tripId}
                      stop={stop}
                      city={city}
                      attachments={stop.attachments ?? []}
                      compact
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {unscheduled.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="px-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-muted">
            未排定時間
          </div>
          <StopsList
            tripId={tripId}
            city={city}
            stops={unscheduled.map((u) => u.stop)}
            activeStopIndex={unscheduled.findIndex(
              (u) => u.index === activeStopIndex,
            )}
            onFocusStop={(idx) => onFocusStop(unscheduled[idx]?.index ?? idx)}
          />
        </div>
      )}
    </div>
  );
}

function parseMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1]!, 10);
  const mm = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function computeStartEnd(
  arrival: string | null | undefined,
  durationMin: number | null | undefined,
): { start: string; end: string | null } | null {
  if (!arrival) return null;
  const start = parseMinutes(arrival);
  if (start == null) return { start: arrival, end: null };
  if (!durationMin || durationMin <= 0) {
    return { start: `${pad2(Math.floor(start / 60))}:${pad2(start % 60)}`, end: null };
  }
  const total = start + durationMin;
  const eH = Math.floor((total / 60) % 24);
  const eM = total % 60;
  return {
    start: `${pad2(Math.floor(start / 60))}:${pad2(start % 60)}`,
    end: `${pad2(eH)}:${pad2(eM)}`,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  sight: { label: "景點", color: "#2563eb" },
  meal: { label: "用餐", color: "#d97706" },
  transit: { label: "交通", color: "#6b7280" },
  stay: { label: "住宿", color: "#7c3aed" },
  shop: { label: "購物", color: "#db2777" },
  other: { label: "其他", color: "#0fb8b4" },
};

function KindChip({ kind }: { kind: string }) {
  const meta = KIND_LABELS[kind] ?? KIND_LABELS.other!;
  return (
    <span
      className="rounded-full px-2 py-[1px] text-[10px] font-medium"
      style={{
        background: `${meta.color}15`,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

function StopActions({
  tripId,
  stop,
  city,
  attachments,
  compact,
}: {
  tripId: string;
  stop: TripStop;
  city: string;
  attachments: NonNullable<TripStop["attachments"]>;
  compact?: boolean;
}) {
  const mapUrl = googleMapsUrl(stop, city);
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <a
        href={mapUrl}
        target="_blank"
        rel="noreferrer"
        title="Google Maps"
        aria-label={`${stop.name} Google Maps`}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-divider bg-white text-fg-muted shadow-xs transition-colors hover:border-accent/40 hover:text-accent",
          compact ? "h-7 w-7" : "h-8 w-8",
        )}
      >
        <ExternalLink className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </a>
      <AttachmentBadges
        tripId={tripId}
        stop={stop}
        attachments={attachments}
        compact={compact}
      />
    </div>
  );
}

function googleMapsUrl(stop: TripStop, city: string): string {
  const textQuery = [
    stop.placeName?.trim() || stop.name,
    stop.placeAddress,
    city,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");
  const params = new URLSearchParams({ api: "1" });
  if (stop.placeId) {
    const coordinateQuery =
      stop.lat != null && stop.lng != null ? `${stop.lat},${stop.lng}` : null;
    params.set("query", textQuery || coordinateQuery || stop.placeId);
    params.set("query_place_id", stop.placeId);
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }
  if (stop.lat != null && stop.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
  }
  params.set("query", textQuery);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function AttachmentBadges({
  tripId,
  stop,
  attachments,
  compact,
}: {
  tripId: string;
  stop: TripStop;
  attachments: NonNullable<TripStop["attachments"]>;
  compact?: boolean;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      {attachments.map((attachment) => (
        <AttachmentIconButton
          key={attachment.id}
          tripId={tripId}
          stop={stop}
          attachment={attachment}
          compact={compact}
        />
      ))}
    </div>
  );
}

function AttachmentIconButton({
  tripId,
  stop,
  attachment,
  compact,
}: {
  tripId: string;
  stop: TripStop;
  attachment: NonNullable<TripStop["attachments"]>[number];
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [labelValue, setLabelValue] = useState(attachment.label);
  const [amountValue, setAmountValue] = useState(attachment.amount ?? "");
  const [urlValue, setUrlValue] = useState(attachment.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const done = attachment.done || attachment.status === "uploaded";
  const Icon = ATTACHMENT_ICONS[attachment.type] ?? Ticket;
  const stopId = stop.id;

  function openModal() {
    setLabelValue(attachment.label);
    setAmountValue(attachment.amount ?? "");
    setUrlValue(attachment.url ?? "");
    setError(null);
    setOpen(true);
  }

  function upload(file: File | null) {
    if (!file || !stopId || busy) return;
    setError(null);
    startTransition(async () => {
      let imageDataUrl: string;
      try {
        imageDataUrl = await compressImageToDataUrl(file, {
          maxDataUrlLength: 1_800_000,
          fallbackQuality: 0.45,
        });
      } catch {
        setError("圖片處理失敗");
        return;
      }
      const res = await fetch(
        `/api/trips/${tripId}/stops/${stopId}/attachments/${encodeURIComponent(
          attachment.id,
        )}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "uploaded",
            image_name: file.name,
            image_data_url: imageDataUrl,
          }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? `HTTP ${res.status}`);
        return;
      }
      await refreshTrip(tripId);
      setOpen(false);
    });
  }

  function saveDetails() {
    if (!stopId || busy) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/trips/${tripId}/stops/${stopId}/attachments/${encodeURIComponent(
          attachment.id,
        )}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: labelValue.trim(),
            amount: amountValue.trim(),
            url: urlValue.trim(),
          }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? `HTTP ${res.status}`);
        return;
      }
      await refreshTrip(tripId);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        title={done ? `${attachment.label}已上傳` : attachment.label}
        aria-label={attachment.label}
        onClick={openModal}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-full border bg-white transition-colors",
          compact ? "h-7 w-7" : "h-8 w-8",
          done
            ? "border-[rgba(22,163,74,0.35)] text-[#15803d]"
            : "border-[rgba(217,119,6,0.36)] text-[#b45309] hover:bg-[rgba(217,119,6,0.08)]",
          busy && "cursor-wait opacity-70",
        )}
      >
        <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {done && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-[0_0_0_2px_white]">
            <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10 md:items-center md:pb-10">
          <div className="w-full max-w-[420px] rounded-2xl border border-divider bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                  <FilePenLine className="h-4 w-4 text-accent" />
                  票券資訊
                </div>
                <div className="mt-0.5 truncate text-[12px] text-fg-muted">
                  {stop.name}
                </div>
              </div>
              <button
                type="button"
                aria-label="關閉"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-[rgba(0,0,0,0.04)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <TicketField
                label="名稱"
                value={labelValue}
                onChange={setLabelValue}
                placeholder="例如：門票"
              />
              <TicketField
                label="金額"
                value={amountValue}
                onChange={setAmountValue}
                placeholder="例如：€18"
              />
              <TicketField
                label="網址"
                value={urlValue}
                onChange={setUrlValue}
                placeholder="https://..."
                inputMode="url"
              />
              {urlValue.trim() && (
                <a
                  href={urlValue.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-[rgba(15,184,180,0.10)] px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-[rgba(15,184,180,0.16)]"
                >
                  <span className="truncate">開啟連結</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
            </div>

            <button
              type="button"
              disabled={busy || !stopId}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "mt-4 flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-divider-strong bg-[rgba(0,0,0,0.015)] px-3 py-4 text-center transition-colors",
                "hover:border-accent hover:bg-[rgba(15,184,180,0.05)]",
                busy && "cursor-wait opacity-70",
              )}
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
              ) : done ? (
                <CheckCircle2 className="h-5 w-5 text-[#16a34a]" />
              ) : (
                <Upload className="h-5 w-5 text-fg-muted" />
              )}
              <span className="text-[12px] font-medium text-fg">
                {done ? "重新上傳票券圖片" : "上傳票券圖片"}
              </span>
              {attachment.imageName && (
                <span className="max-w-full truncate text-[10.5px] text-fg-muted">
                  {attachment.imageName}
                </span>
              )}
            </button>
            {error && (
              <div className="mt-2 text-[11px] leading-snug text-[#b91c1c]">
                儲存失敗：{error}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-[13px] font-medium text-fg-muted hover:bg-[rgba(0,0,0,0.04)]"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy || labelValue.trim().length === 0}
                onClick={saveDetails}
                className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-45"
              >
                {busy ? "儲存中..." : "儲存"}
              </button>
            </div>
            <Input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy || !stopId}
              onChange={(e) => {
                upload(e.target.files?.[0] ?? null);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function TicketField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-medium text-fg">
      {label}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-10 rounded-xl border border-divider bg-white px-3 text-[13px] font-normal text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-accent"
      />
    </label>
  );
}

const ATTACHMENT_ICONS: Record<string, typeof Ticket> = {
  ticket: Ticket,
  reservation: CalendarCheck,
  booking: CalendarCheck,
  flight: Plane,
  transit: Plane,
  upload: Upload,
  document: ImageIcon,
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分鐘`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}

/* Render a stop's time window. When both arrival + duration are
   concrete we show "09:30 → 11:00"; bare arrival falls back to the
   raw label so legacy data ("morning") still surfaces something. */
function formatTimeRange(
  arrival: string | null | undefined,
  durationMin: number | null | undefined,
): string | null {
  if (!arrival) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(arrival.trim());
  if (!match || !durationMin || durationMin <= 0) return arrival;
  const startH = Number.parseInt(match[1]!, 10);
  const startM = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(startH) || !Number.isFinite(startM)) return arrival;
  const total = startH * 60 + startM + durationMin;
  const endH = Math.floor((total / 60) % 24);
  const endM = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(startH)}:${pad(startM)} → ${pad(endH)}:${pad(endM)}`;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function dayIndexFromTab(tab: TabId): number | null {
  if (!tab.startsWith("day:")) return null;
  const n = Number.parseInt(tab.slice(4), 10);
  return Number.isFinite(n) ? n : null;
}

function TabButton({
  active,
  onClick,
  label,
  count,
  tone,
  unread,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  tone?: "compact";
  unread?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5 transition-colors duration-150",
        tone === "compact" ? "px-3 text-[12.5px]" : "px-4 text-[13px]",
        active
          ? "border-accent font-semibold text-fg"
          : "border-transparent font-medium text-fg-muted hover:text-fg",
      )}
    >
      {label}
      {unread && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#facc15] shadow-[0_0_0_2px_rgba(250,204,21,0.25)]"
        />
      )}
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
  tripId,
  companions,
  lang,
  labels,
}: {
  items: ChecklistItem[];
  tripId: string;
  companions: ApiCompanion[];
  lang: string;
  labels: TripDetailLabels;
}) {
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-10 text-center text-[13px] text-fg-muted">
        {labels.emptyChecklist}
      </div>
    );
  }

  const filterOptions = buildChecklistAssigneeFilters(
    items,
    companions,
    labels.checklistFilters,
  );
  const visibleItems = filterChecklistByAssignee(items, assigneeFilter);
  const openGroups = groupChecklistItems(visibleItems.filter((t) => !t.done));
  const done = visibleItems.filter((t) => t.done);

  return (
    <div className="flex flex-col gap-5">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setAssigneeFilter(option.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors",
              assigneeFilter === option.id
                ? "bg-fg text-white"
                : "bg-surface text-fg-secondary shadow-xs hover:text-fg",
            )}
          >
            {option.label}
            {option.count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  assigneeFilter === option.id
                    ? "bg-white/18 text-white"
                    : "bg-surface-sunken text-fg-muted",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-8 text-center text-[13px] text-fg-muted">
          {labels.emptyChecklist}
        </div>
      ) : null}
      {openGroups.map((group) => (
        <ChecklistGroup
          key={group.key}
          label={group.label}
          items={group.items}
          tripId={tripId}
          companions={companions}
          assigneeLabels={labels.assigneeLabels}
          lang={lang}
          shopCta={labels.shopCta}
          esimOrderLabels={labels.esimOrderLabels}
          esimShareLabels={labels.esimShareLabels}
          tint={group.tint}
        />
      ))}
      {done.length > 0 && (
        <ChecklistGroup
          label={labels.checklistGroups.done}
          items={done}
          tripId={tripId}
          companions={companions}
          assigneeLabels={labels.assigneeLabels}
          lang={lang}
          shopCta={labels.shopCta}
          esimOrderLabels={labels.esimOrderLabels}
          esimShareLabels={labels.esimShareLabels}
        />
      )}
    </div>
  );
}

function buildChecklistAssigneeFilters(
  items: ChecklistItem[],
  companions: ApiCompanion[],
  labels: TripDetailLabels["checklistFilters"],
) {
  const countFor = (id: string) =>
    items.filter((item) => !item.done && item.assignedCompanionId === id).length;
  return [
    {
      id: "all",
      label: labels.all,
      count: items.filter((item) => !item.done).length,
    },
    ...companions.map((companion) => ({
      id: companion.id,
      label: companion.role === "owner" ? labels.mine : companion.display_name,
      count: countFor(companion.id),
    })),
  ];
}

function filterChecklistByAssignee(
  items: ChecklistItem[],
  assigneeFilter: string,
) {
  if (assigneeFilter === "all") return items;
  return items.filter((item) => item.assignedCompanionId === assigneeFilter);
}

const CHECKLIST_PHASES = [
  { key: "early", label: "越早越好", tint: true },
  { key: "week_before", label: "出發前一週", tint: true },
  { key: "days_before", label: "出發前 3 天", tint: false },
  { key: "travel_day", label: "出發當天", tint: false },
  { key: "on_trip", label: "抵達後", tint: false },
] as const;

function groupChecklistItems(items: ChecklistItem[]) {
  const sorted = [...items].sort((a, b) => {
    const phaseDelta = phaseIndex(a.phase) - phaseIndex(b.phase);
    if (phaseDelta !== 0) return phaseDelta;
    const aDate = a.start ?? a.due ?? "";
    const bDate = b.start ?? b.due ?? "";
    if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return a.text.localeCompare(b.text);
  });

  const grouped = new Map<string, ChecklistItem[]>();
  for (const item of sorted) {
    const phase = item.phase || inferChecklistPhase(item);
    const groupKey = `${phase}::${item.groupLabel || phaseLabel(phase)}`;
    const bucket = grouped.get(groupKey) ?? [];
    bucket.push(item);
    grouped.set(groupKey, bucket);
  }

  return Array.from(grouped, ([key, groupItems]) => {
    const [phase, label] = key.split("::");
    return {
      key,
      label: label || phaseLabel(phase || "week_before"),
      items: groupItems,
      tint: CHECKLIST_PHASES.some((p) => p.key === phase && p.tint),
    };
  });
}

function phaseIndex(phase: string | null | undefined) {
  const key = phase || "week_before";
  const index = CHECKLIST_PHASES.findIndex((p) => p.key === key);
  return index >= 0 ? index : 1;
}

function phaseLabel(phase: string) {
  return CHECKLIST_PHASES.find((p) => p.key === phase)?.label ?? "待安排";
}

function inferChecklistPhase(item: ChecklistItem) {
  if (item.kind === "ticket" || item.kind === "stay" || item.kind === "visa") {
    return "early";
  }
  if (item.kind === "gear") return "days_before";
  if (item.kind === "transit") return "travel_day";
  return "week_before";
}

function ChecklistGroup({
  label,
  items,
  tripId,
  companions,
  assigneeLabels,
  lang,
  shopCta,
  esimOrderLabels,
  esimShareLabels,
  tint,
}: {
  label: string;
  items: ChecklistItem[];
  tripId: string;
  companions: ApiCompanion[];
  assigneeLabels: TripDetailLabels["assigneeLabels"];
  lang: string;
  shopCta: string;
  esimOrderLabels?: TripDetailLabels["esimOrderLabels"];
  esimShareLabels?: TripDetailLabels["esimShareLabels"];
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
            tripId={tripId}
            companions={companions}
            assigneeLabels={assigneeLabels}
            lang={lang}
            tint={tint}
            shopCtaLabel={shopCta}
            esimOrderLabels={esimOrderLabels}
            esimShareLabels={esimShareLabels}
          />
        ))}
      </div>
    </section>
  );
}
