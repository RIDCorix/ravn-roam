"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, MapPin, Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { PageHeader } from "@/components/storefront/home-sections";
import {
  MotionButton,
  appSpring,
  fadeUp,
  popIn,
} from "@/components/storefront/motion";
import { TripCard } from "@/components/storefront/trips/trip-card";
import type { Trip } from "@/lib/mock/consumer";

export interface TripsListLabels {
  title: string;
  subtitle: string;
  empty: string;
  groups: {
    active: string;
    upcoming: string;
    past: string;
  };
  card: {
    tasks_label: string;
    days_unit: string;
    active_badge: string;
  };
  create: {
    title: string;
    body: string;
    button: string;
    dialog_title: string;
    dialog_body: string;
    trip_name: string;
    trip_name_placeholder: string;
    destination: string;
    destination_placeholder: string;
    start_date: string;
    end_date: string;
    cancel: string;
    submit: string;
    submitting: string;
    error: string;
  };
}

export function TripsListClient({
  lang,
  labels,
}: {
  lang: string;
  labels: TripsListLabels;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useSWR<{ trips: Trip[] }>(
    "storefront-trips",
    fetchTrips,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    },
  );
  const trips = data?.trips ?? [];
  const active = trips.filter((trip) => trip.status === "active");
  const upcoming = trips
    .filter((trip) => trip.status === "upcoming")
    .sort((a, b) => a.start.localeCompare(b.start));
  const past = trips
    .filter((trip) => trip.status === "past")
    .sort((a, b) => b.start.localeCompare(a.start));
  const liveCount = active.length + upcoming.length;
  const subtitle = format(labels.subtitle, { count: String(liveCount) });

  return (
    <div>
      <PageHeader title={labels.title} subtitle={subtitle} />
      <div className="flex flex-col gap-6 px-5 pt-1 pb-6">
        {!isLoading && (
          <motion.div {...fadeUp}>
            <NewTripCta
              labels={labels.create}
              onClick={() => setCreateOpen(true)}
            />
          </motion.div>
        )}
        {isLoading && <TripsListSkeleton />}
        {!isLoading && (
          <>
            <AnimatePresence mode="popLayout">
              {active.length > 0 && (
                <TripGroup
                  key="active"
                  label={labels.groups.active}
                  trips={active}
                  lang={lang}
                  labels={labels}
                />
              )}
              {upcoming.length > 0 && (
                <TripGroup
                  key="upcoming"
                  label={labels.groups.upcoming}
                  trips={upcoming}
                  lang={lang}
                  labels={labels}
                />
              )}
              {past.length > 0 && (
                <TripGroup
                  key="past"
                  label={labels.groups.past}
                  trips={past}
                  lang={lang}
                  labels={labels}
                />
              )}
              {trips.length === 0 && (
                <motion.div key="empty" {...fadeUp}>
                  <EmptyTrips label={labels.empty} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
      <AnimatePresence>
        {createOpen && (
          <CreateTripDialog
            labels={labels.create}
            onClose={() => setCreateOpen(false)}
            onCreated={(id) => {
              setCreateOpen(false);
              router.push(`/${lang}/trips/${id}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NewTripCta({
  labels,
  onClick,
}: {
  labels: TripsListLabels["create"];
  onClick: () => void;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-surface"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-4 p-4">
        <div className="relative h-[92px] w-[104px] shrink-0 overflow-hidden rounded-[18px] bg-accent-softer">
          <Image
            src="/illustrations/plan-with-lumi.png"
            alt=""
            fill
            sizes="104px"
            className="object-contain p-2"
            priority
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">
            {labels.title}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">
            {labels.body}
          </p>
          <MotionButton
            type="button"
            onClick={onClick}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(15,184,181,0.9)] transition-transform active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {labels.button}
          </MotionButton>
        </div>
      </div>
    </section>
  );
}

function CreateTripDialog({
  labels,
  onClose,
  onCreated,
}: {
  labels: TripsListLabels["create"];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const cleanDestination = destination.trim();
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          start_date: startDate,
          end_date: endDate < startDate ? startDate : endDate,
          status: "upcoming",
          days: cleanDestination
            ? [
                {
                  day_date: startDate,
                  city: cleanDestination,
                  note: "",
                },
              ]
            : [],
          checklist: [],
        }),
      });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const payload = (await res.json()) as { trip?: { id?: string } };
      const id = payload.trip?.id;
      if (!id) throw new Error("missing trip id");
      onCreated(id);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-4 pb-4 pt-16 backdrop-blur-[1px] sm:items-center sm:pb-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.button
        type="button"
        aria-label={labels.cancel}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <motion.form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={labels.dialog_title}
        {...popIn}
        className="relative z-10 w-full max-w-[390px] overflow-hidden rounded-[24px] bg-white shadow-2xl"
      >
        <div className="relative h-[132px] overflow-hidden bg-accent-softer">
          <Image
            src="/illustrations/travel-friends.png"
            alt=""
            fill
            sizes="390px"
            className="object-contain px-8 py-3"
            priority
          />
          <MotionButton
            type="button"
            aria-label={labels.cancel}
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-fg-secondary shadow-sm backdrop-blur"
          >
            <X className="h-4 w-4" />
          </MotionButton>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-fg">
              {labels.dialog_title}
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">
              {labels.dialog_body}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-fg-secondary">
              {labels.trip_name}
            </span>
            <input
              required
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={labels.trip_name_placeholder}
              className="h-11 rounded-xl border border-divider-strong bg-white px-3.5 text-[14px] outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-fg-secondary">
              {labels.destination}
            </span>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
              <input
                maxLength={80}
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder={labels.destination_placeholder}
                className="h-11 w-full rounded-xl border border-divider-strong bg-white pl-9 pr-3.5 text-[14px] outline-none focus:border-accent"
              />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <DateField
              label={labels.start_date}
              value={startDate}
              onChange={setStartDate}
            />
            <DateField
              label={labels.end_date}
              value={endDate}
              min={startDate}
              onChange={setEndDate}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[rgba(220,38,38,0.08)] px-3 py-2 text-[12.5px] text-[#b91c1c]">
              {labels.error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <MotionButton
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-divider-strong bg-white text-[14px] font-semibold text-fg disabled:opacity-60"
            >
              {labels.cancel}
            </MotionButton>
            <MotionButton
              type="submit"
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-accent text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? labels.submitting : labels.submit}
            </MotionButton>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
}

function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-fg-secondary">{label}</span>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <input
          type="date"
          required
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-divider-strong bg-white pl-9 pr-2 text-[13px] outline-none focus:border-accent"
        />
      </div>
    </label>
  );
}

function TripGroup({
  label,
  trips,
  lang,
  labels,
}: {
  label: string;
  trips: Trip[];
  lang: string;
  labels: TripsListLabels;
}) {
  return (
    <motion.section layout {...fadeUp} className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
          {label}
        </span>
        <span
          className="text-[12px] text-fg-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {trips.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {trips.map((trip) => (
          <motion.div key={trip.id} layout transition={appSpring}>
            <TripCard
              trip={trip}
              href={`/${lang}/trips/${trip.id}`}
              tasksLabel={labels.card.tasks_label}
              daysUnit={labels.card.days_unit}
              activeBadgeLabel={labels.card.active_badge}
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function TripsListSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: 2 }).map((_, group) => (
        <section key={group} className="flex flex-col gap-2.5">
          <div className="h-4 w-24 rounded-full bg-[rgba(0,0,0,0.08)]" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: group === 0 ? 2 : 3 }).map((__, row) => (
              <div
                key={row}
                className="flex items-center gap-3.5 rounded-2xl bg-surface px-4 py-3.5"
                style={{ boxShadow: "var(--shadow-xs)" }}
              >
                <div className="h-11 w-11 shrink-0 rounded-[12px] bg-[rgba(0,0,0,0.06)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-[54%] rounded-full bg-[rgba(0,0,0,0.08)]" />
                  <div className="h-3 w-[78%] rounded-full bg-[rgba(0,0,0,0.06)]" />
                </div>
                <div className="h-8 w-10 rounded-[10px] bg-[rgba(0,0,0,0.05)]" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmptyTrips({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-divider-strong px-4 py-10 text-center text-[13px] text-fg-muted">
      {label}
    </div>
  );
}

async function fetchTrips(): Promise<{ trips: Trip[] }> {
  const res = await fetch("/api/storefront/trips", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetch trips failed: ${res.status} ${text.slice(0, 160)}`);
  }
  return (await res.json()) as { trips: Trip[] };
}

function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
