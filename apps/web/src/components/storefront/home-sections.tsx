// Composed sections for the consumer home screen. Server components by
// default; the only interaction is link navigation (no useState).
// Ports design/app/components/Home.jsx — keep visual fidelity, swap
// inline styles for Tailwind where natural, keep CSS vars for tokens.

import Link from "next/link";
import { ArrowRight, ChevronRight, Info, Plus, RefreshCw, Sparkles, ListChecks, Store, MapPlus } from "lucide-react";

import type { ActiveESIM, Trip } from "@/lib/mock/consumer";

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
    Icon: React.ComponentType<{ className?: string }>;
    accent?: boolean;
  }> = [
    { id: "shop",    href: `/${lang}/shop`,  Icon: Store },
    { id: "newTrip", href: `/${lang}/trips`, Icon: MapPlus },
    { id: "askLumi", href: `/${lang}/trips`, Icon: Sparkles, accent: true },
    { id: "myTasks", href: `/${lang}/tasks`, Icon: ListChecks },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((a) => (
        <Link
          key={a.id}
          href={a.href}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl px-2 py-4 text-[12px] font-medium transition-shadow duration-150"
          style={{
            background: a.accent ? "rgba(15,184,180,0.10)" : "var(--surface)",
            color: a.accent ? "var(--accent)" : "var(--fg)",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <a.Icon className="h-5 w-5" />
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
