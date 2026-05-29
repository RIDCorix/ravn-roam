// Composed sections for the consumer home screen. Server components by
// default; the only interaction is link navigation (no useState).
// Ports design/app/components/Home.jsx — keep visual fidelity, swap
// inline styles for Tailwind where natural, keep CSS vars for tokens.

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Backpack,
  BedDouble,
  CalendarClock,
  ChevronRight,
  FileCheck,
  FileText,
  Info,
  ListChecks,
  MapPlus,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Signal,
  Sparkles,
  Store,
  Ticket,
  Train,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { ActiveESIM, ChecklistItem, Trip } from "@/lib/mock/consumer";
import { buildChecklistEsimShopHref } from "@/lib/shop-link";

const CHECKLIST_KIND_ICON: Record<ChecklistItem["kind"], LucideIcon> = {
  esim: Signal,
  money: Wallet,
  flight: Plane,
  stay: BedDouble,
  ticket: Ticket,
  visa: FileCheck,
  doc: FileText,
  transit: Train,
  gear: Backpack,
  insurance: Shield,
};

// ─── Hero: active eSIM card ─────────────────────────────────────────────────

export function ActiveESIMCard({
  sim,
  labels,
  lang,
}: {
  sim: ActiveESIM;
  labels: {
    activeLabel: string; // 「使用中 · {network}」 already substituted
    countryPlan: string;
    remainingUnit: string;
    daysLeft: string;
    used: string;
    remaining: string;
    topup: string;
    switchHotspot: string;
    troubleshoot: string;
  };
  lang: string;
}) {
  const remaining = sim.total - sim.used;
  const usedPct = Math.min(100, (sim.used / sim.total) * 100);

  return (
    <div
      className="relative overflow-hidden rounded-3xl text-white"
      style={{
        background: "linear-gradient(160deg, #0FB8B4 0%, #0a7d7a 100%)",
        boxShadow:
          "var(--shadow-md), 0 12px 40px rgba(15, 184, 180, 0.24)",
      }}
    >
      {/* Decorative orbital rings */}
      <svg
        viewBox="0 0 240 240"
        className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 opacity-[0.18]"
      >
        <circle cx="120" cy="120" r="100" fill="none" stroke="#fff" strokeWidth="1" />
        <circle cx="120" cy="120" r="70" fill="none" stroke="#fff" strokeWidth="1" />
        <circle cx="120" cy="120" r="40" fill="none" stroke="#fff" strokeWidth="1" />
      </svg>

      <div className="relative p-5">
        {/* Top row: live indicator + network + signal */}
        <div className="mb-3.5 flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full bg-white"
            style={{
              boxShadow: "0 0 0 4px rgba(255,255,255,0.25)",
              animation: "lume-pulse 2s var(--ease-out-soft) infinite",
            }}
          />
          <span className="whitespace-nowrap text-[12px] font-medium tracking-[0.02em]">
            {labels.activeLabel}
          </span>
          <span className="flex-1" />
          <SignalBars n={sim.signal} speed={sim.speed} />
        </div>

        {/* Remaining GB + days */}
        <div className="mb-5 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="whitespace-nowrap text-[11px] uppercase tracking-[0.06em] opacity-80">
              {labels.countryPlan}
            </div>
            <div
              className="mt-1.5 whitespace-nowrap text-[36px] font-semibold leading-none tracking-[-0.025em]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {remaining.toFixed(2)}
              <span className="ml-1 text-[16px] font-normal opacity-70">
                {labels.remainingUnit}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-[30px] font-semibold leading-none tracking-[-0.02em]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {sim.daysLeft}
            </div>
            <div className="whitespace-nowrap text-[11px] opacity-80">
              {labels.daysLeft}
            </div>
          </div>
        </div>

        {/* Usage bar */}
        <div className="mb-1">
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.18)" }}>
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div
            className="mt-1.5 flex justify-between text-[11px] opacity-85"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span>{labels.used}</span>
            <span>{labels.remaining}</span>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-4 flex gap-2">
          <ESIMAction icon={<Plus className="h-3.5 w-3.5" />} label={labels.topup} href={`/${lang}/shop`} />
          <ESIMAction icon={<RefreshCw className="h-3.5 w-3.5" />} label={labels.switchHotspot} subtle />
          <ESIMAction icon={<Info className="h-3.5 w-3.5" />} label={labels.troubleshoot} subtle />
        </div>
      </div>
    </div>
  );
}

function ESIMAction({
  icon,
  label,
  href,
  subtle,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  subtle?: boolean;
}) {
  const cls =
    "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2.5 text-[12px] font-semibold";
  const inner = (
    <>
      {icon}
      {label}
    </>
  );
  const style = subtle
    ? { background: "rgba(255,255,255,0.14)", color: "#fff" }
    : { background: "#fff", color: "var(--accent)" };
  return href ? (
    <Link href={href} className={cls} style={style}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} style={style} disabled={subtle}>
      {inner}
    </button>
  );
}

function SignalBars({ n, speed }: { n: 1 | 2 | 3 | 4; speed: string }) {
  return (
    <span className="inline-flex items-end gap-[2px]">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="rounded-[1px]"
          style={{
            width: 3,
            height: 4 + i * 2,
            background: i <= n ? "#fff" : "rgba(255,255,255,0.32)",
          }}
        />
      ))}
      <span
        className="ml-1 text-[10px] font-semibold"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {speed}
      </span>
    </span>
  );
}

// ─── Quick actions grid ─────────────────────────────────────────────────────

export function HomeSummaryCard({
  title,
  primary,
  secondary,
  cta,
  href,
  variant = "default",
}: {
  title: string;
  primary: string;
  secondary: string;
  cta: string;
  href: string;
  variant?: "default" | "hero";
}) {
  if (variant === "hero") {
    return (
      <Link
        href={href}
        className="relative block overflow-hidden rounded-[24px] px-5 py-5 text-white transition-transform duration-200 hover:-translate-y-0.5"
        style={{
          background:
            "linear-gradient(135deg, #0FB8B4 0%, #1A9BD8 55%, #5B7CFA 110%)",
          boxShadow:
            "0 20px 50px -16px rgba(15,184,180,0.55), 0 8px 24px -8px rgba(91,124,250,0.35)",
        }}
      >
        {/* Decorative orbit rings (animated) */}
        <svg
          viewBox="0 0 240 240"
          className="pointer-events-none absolute -right-12 -top-14 h-64 w-64 opacity-[0.22]"
          style={{ animation: "lume-orbit 60s linear infinite" }}
          aria-hidden
        >
          <circle cx="120" cy="120" r="100" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="120" cy="120" r="70" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 6" />
          <circle cx="120" cy="120" r="40" fill="none" stroke="#fff" strokeWidth="1" />
        </svg>
        {/* Soft highlight glow */}
        <div
          className="pointer-events-none absolute -left-10 -bottom-16 h-44 w-44 rounded-full opacity-50"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.35), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <div
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold"
            style={{
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
            }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] opacity-80">
              {title}
            </div>
            <div className="mt-1 truncate text-[20px] font-semibold tracking-[-0.02em]">
              {primary}
            </div>
            <div className="mt-0.5 text-[12.5px] opacity-85">{secondary}</div>
          </div>
          <div
            className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-accent"
            style={{ background: "#fff" }}
          >
            {cta}
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-[20px] px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
    >
      {/* Subtle corner gradient wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, rgba(15,184,180,0.08), transparent 55%)",
        }}
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-[14px] font-bold text-accent"
          style={{
            background: "linear-gradient(135deg, var(--accent-softer), var(--accent-soft))",
            boxShadow: "inset 0 0 0 1px rgba(15,184,180,0.18)",
          }}
        >
          r
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-fg-muted">
            {title}
          </div>
          <div className="mt-1 truncate text-[18px] font-semibold tracking-[-0.015em] text-fg">
            {primary}
          </div>
          <div className="mt-0.5 text-[12px] text-fg-secondary">
            {secondary}
          </div>
        </div>
        <div className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-[rgba(15,184,180,0.10)] px-2.5 py-1 text-[12px] font-medium text-accent transition-colors group-hover:bg-[rgba(15,184,180,0.16)]">
          {cta}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export function SimpleTripCard({
  trip,
  label,
  meta,
  href,
}: {
  trip: Trip;
  label: string;
  meta: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[18px] px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-xs)" }}
    >
      <div
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-bold text-info"
        style={{
          background: "linear-gradient(135deg, #ECF0FE, #DCE3FD)",
          boxShadow: "inset 0 0 0 1px rgba(91,124,250,0.16)",
        }}
      >
        {trip.cover}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.06em] text-fg-muted">
          {label}
        </div>
        <div className="mt-0.5 truncate text-[15px] font-semibold text-fg">
          {trip.title}
        </div>
        <div className="text-[12px] text-fg-secondary">
          {trip.start.slice(5)} – {trip.end.slice(5)} · {meta}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export interface QuickActionsLabels {
  shop: string;
  newTrip: string;
  askLumi: string;
  myTasks: string;
}

export function QuickActions({
  labels,
  lang,
}: {
  labels: QuickActionsLabels;
  lang: string;
}) {
  const actions: Array<{
    id: keyof QuickActionsLabels;
    href: string;
    Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number | string }>;
  }> = [
    { id: "shop",    href: `/${lang}/shop`,  Icon: Store },
    { id: "newTrip", href: `/${lang}/trips`, Icon: MapPlus },
    { id: "askLumi", href: `/${lang}/trips`, Icon: Sparkles },
    { id: "myTasks", href: `/${lang}/tasks`, Icon: ListChecks },
  ];
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {actions.map((a) => (
        <Link
          key={a.id}
          href={a.href}
          className="group flex flex-col items-center gap-1.5 text-[12px] font-medium text-fg"
        >
          <span
            className="flex aspect-square w-full items-center justify-center rounded-2xl bg-accent-softer transition-colors group-hover:bg-accent-soft"
          >
            <a.Icon className="h-6 w-6 text-accent" strokeWidth={1.75} />
          </span>
          <span className="whitespace-nowrap">{labels[a.id]}</span>
        </Link>
      ))}
    </div>
  );
}

// ─── Lumi nudge ─────────────────────────────────────────────────────────────

export function LumiNudge({
  body,
  timeLabel,
  name,
  href,
}: {
  body: string;
  timeLabel: string;
  name: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block w-full rounded-[18px] p-4 text-left transition-shadow duration-150 hover:shadow-md"
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start gap-3">
        <LumiAvatar size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12px] text-fg-muted">
            <span className="font-semibold text-accent">{name}</span>
            <span>·</span>
            <span>{timeLabel}</span>
          </div>
          <div className="mt-0.5 text-[14px] leading-[1.5] text-fg">{body}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-fg-muted" />
      </div>
    </Link>
  );
}

export function LumiAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, #5DD9D5 0%, #0FB8B4 60%, #5B7CFA 120%)",
        boxShadow: "0 4px 16px rgba(15,184,180,0.32)",
      }}
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon
          points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
          fill="currentColor"
          opacity="0.95"
        />
      </svg>
    </div>
  );
}

// ─── Upcoming trip card ─────────────────────────────────────────────────────

export function UpcomingTripCard({
  trip,
  countdownLabel,
  durationLabel,
  cities,
  href,
}: {
  trip: Trip;
  countdownLabel: string; // 「下個行程 · 還有 16 天」 already substituted
  durationLabel: string; // 「14 天」
  cities: string[];
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block w-full overflow-hidden rounded-[20px] text-left transition-shadow duration-150 hover:shadow-md"
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="flex items-center gap-3 px-[18px] py-4"
        style={{
          background:
            "linear-gradient(110deg, rgba(91,124,250,0.10), rgba(15,184,180,0.06))",
        }}
      >
        <div
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[14px] font-bold tracking-[-0.02em] text-info"
          style={{ background: "#fff" }}
        >
          {trip.cover}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.06em] text-fg-muted">
            {countdownLabel}
          </div>
          <div className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.015em]">
            {trip.title}
          </div>
          <div className="text-[12px] text-fg-secondary">
            {trip.start.slice(5)} – {trip.end.slice(5)} · {durationLabel}
          </div>
        </div>
        <ArrowRight className="h-[18px] w-[18px] text-fg-secondary" />
      </div>
      <div
        className="flex gap-1.5 overflow-x-auto border-t border-divider px-[18px] py-3"
      >
        {cities.map((c, i) => (
          <span
            key={i}
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] text-fg"
            style={{ background: "rgba(0,0,0,0.04)" }}
          >
            {c}
          </span>
        ))}
      </div>
    </Link>
  );
}

// ─── Active trip checklist preview ──────────────────────────────────────────

export function ActiveTripStrip({
  trip,
  sectionTitle,
  summary,
  viewAllLabel,
  href,
}: {
  trip: Trip;
  sectionTitle: string;
  summary: string;
  viewAllLabel: string;
  href: string;
}) {
  const incomplete = trip.checklist.filter((t) => !t.done);
  const preview = incomplete.slice(0, 3);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-[14px] font-semibold tracking-[-0.01em]">{sectionTitle}</span>
        <span className="text-[12px] text-fg-muted">{summary}</span>
        <span className="flex-1" />
        <Link
          href={href}
          className="text-[12px] font-medium text-accent"
        >
          {viewAllLabel}
        </Link>
      </div>
      <div className="flex flex-col gap-1.5">
        {preview.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-[14px] px-3.5 py-3"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-xs)" }}
          >
            <span
              className="h-[18px] w-[18px] shrink-0 rounded-[5px]"
              style={{ boxShadow: "inset 0 0 0 1.5px var(--divider-strong)" }}
            />
            <span className="flex-1 truncate text-[13px] text-fg">{t.text}</span>
            {t.due && (
              <span
                className="whitespace-nowrap text-[11px] text-warning"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {t.due.slice(5)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Search-entry pill (Uber-style "Where to?") ─────────────────────────────

export function SearchEntryPill({
  placeholder,
  badgeLabel,
  href,
}: {
  placeholder: string;
  badgeLabel: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-full bg-surface px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-card-hover)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Search className="h-[18px] w-[18px] text-accent" strokeWidth={2.25} />
      <span className="flex-1 truncate text-[15px] font-medium text-fg">
        {placeholder}
      </span>
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 text-[12px] font-medium text-fg"
      >
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        {badgeLabel}
      </span>
    </Link>
  );
}

// ─── Flat row inside a list card (Uber Work/Home style) ─────────────────────

export function ListRow({
  icon,
  title,
  subtitle,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-hover"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-softer text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-fg-muted">{subtitle}</span>
      </span>
    </Link>
  );
}

// Trip row — city photo bleeds full-height on the right side, fades
// into the card surface on the left so the title/subtitle stay legible.
export function TripRow({
  imageSrc,
  title,
  subtitle,
  href,
}: {
  imageSrc: string;
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="relative block h-20 overflow-hidden transition-colors hover:bg-surface-hover"
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 460px"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--surface) 0%, var(--surface) 32%, rgba(255,255,255,0.45) 62%, rgba(255,255,255,0) 100%)",
        }}
      />
      <div className="absolute inset-y-0 left-0 flex w-[68%] flex-col justify-center px-4">
        <span className="truncate text-[15px] font-semibold text-fg">
          {title}
        </span>
        <span className="mt-0.5 truncate text-[12.5px] text-fg-muted">
          {subtitle}
        </span>
      </div>
    </Link>
  );
}

export function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-2xl bg-surface divide-y divide-divider"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}

export { Plane as TripIcon, CalendarClock as UpcomingIcon };

// ─── Todo list: trip-grouped checklist preview ──────────────────────────────

export function TripTodoCard({
  trip,
  href,
  previewCount = 3,
  countLabel,
  viewAllLabel,
  coverSrc,
  lang,
}: {
  trip: Trip;
  href: string;
  previewCount?: number;
  countLabel: string; // already-substituted "X 項待辦"
  viewAllLabel: string; // already-substituted "查看全部 X 項"
  coverSrc?: string;
  // Needed to build deep-links from eSIM checklist items to the shop.
  // Optional so legacy callers (or callers in scopes without locale
  // info) still render — they just lose the shop shortcut.
  lang?: string;
}) {
  const incomplete = trip.checklist.filter((item) => !item.done);
  const preview = incomplete.slice(0, previewCount);
  const remaining = incomplete.length - preview.length;
  if (preview.length === 0) return null;

  return (
    <div
      className="overflow-hidden rounded-2xl bg-surface"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {coverSrc ? (
        <div className="relative h-[68px] overflow-hidden">
          <Image
            src={coverSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 460px"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, var(--surface) 0%, var(--surface) 32%, rgba(255,255,255,0.45) 62%, rgba(255,255,255,0) 100%)",
            }}
          />
          <div className="absolute inset-y-0 left-0 flex w-[68%] flex-col justify-center px-4">
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">
              {trip.title}
            </span>
            <span className="mt-0.5 text-[11.5px] text-fg-muted">
              {countLabel}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">
            {trip.title}
          </span>
          <span className="shrink-0 text-[12px] text-fg-muted">{countLabel}</span>
        </div>
      )}
      <ul className="flex flex-col">
        {preview.map((item) => (
          <TodoRow key={item.id} item={item} lang={lang} />
        ))}
      </ul>
      {remaining > 0 && (
        <Link
          href={href}
          className="group flex items-center justify-between border-t border-divider px-4 py-2.5 text-[13px] font-medium text-accent transition-colors hover:bg-surface-hover"
        >
          <span>{viewAllLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function TodoRow({ item, lang }: { item: ChecklistItem; lang?: string }) {
  const Icon = CHECKLIST_KIND_ICON[item.kind] ?? ListChecks;
  // eSIM items with shop intent (either an explicit shopFilter or the
  // shortcut flag) deep-link straight into the shop page with the
  // slider pre-positioned. Anything else stays a static row.
  const shopHref = lang ? buildChecklistEsimShopHref(lang, item) : null;

  const body = (
    <>
      <span
        aria-hidden
        className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md"
        style={{ boxShadow: "inset 0 0 0 1.5px var(--divider-strong)" }}
      />
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-softer text-accent">
        <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg">
        {item.text}
      </span>
      {shopHref ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-accent">
          去買
          <ArrowRight className="h-3 w-3" />
        </span>
      ) : null}
      {item.due && !shopHref && (
        <span
          className="shrink-0 whitespace-nowrap text-[11px] text-warning"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {item.due.slice(5)}
        </span>
      )}
    </>
  );

  if (shopHref) {
    return (
      <li>
        <Link
          href={shopHref}
          className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover"
        >
          {body}
        </Link>
      </li>
    );
  }
  return <li className="flex items-center gap-3 px-4 py-2.5">{body}</li>;
}

// ─── Section header with "see all" link ─────────────────────────────────────

export function SectionHeader({
  title,
  actionLabel,
  href,
}: {
  title: string;
  actionLabel?: string;
  href?: string;
}) {
  return (
    <div className="flex items-baseline justify-between pt-1">
      <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">
        {title}
      </h2>
      {actionLabel && href && (
        <Link
          href={href}
          className="text-[13px] font-medium text-fg-secondary transition-colors hover:text-fg"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

// ─── User header (avatar + name + level + XP) ───────────────────────────────

export function UserHeader({
  name,
  level,
  levelTitle,
  xp,
  xpToNext,
  right,
}: {
  name: string;
  level: number;
  levelTitle: string;
  xp: number;
  xpToNext: number;
  right?: React.ReactNode;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const pct = Math.max(0, Math.min(100, (xp / Math.max(1, xpToNext)) * 100));
  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3.5 backdrop-blur-xl backdrop-saturate-150"
      style={{ background: "rgba(247,247,245,0.85)" }}
    >
      <div
        aria-hidden
        className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold text-white"
        style={{
          background:
            "linear-gradient(135deg, #5DD9D5 0%, #0FB8B4 60%, #5B7CFA 120%)",
          boxShadow:
            "0 4px 14px -4px rgba(15,184,180,0.45), inset 0 0 0 2px rgba(255,255,255,0.7)",
        }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold tracking-[-0.01em] text-fg">
          {name}
        </div>
        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent-softer px-2 py-[2px] text-[11px] font-semibold text-accent">
          Lv.{level} · {levelTitle}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div
          className="text-[11px] font-medium text-fg-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {xp} / {xpToNext} XP
        </div>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, var(--accent-light), var(--accent))",
            }}
          />
        </div>
      </div>
      {right}
    </header>
  );
}

// ─── Page header ────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3.5 backdrop-blur-xl backdrop-saturate-150"
      style={{ background: "rgba(247,247,245,0.85)" }}
    >
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em]">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</div>
        )}
      </div>
      {right}
    </header>
  );
}
