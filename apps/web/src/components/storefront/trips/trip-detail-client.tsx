"use client";

// Client wrapper for the trip detail body. Receives the server-rendered
// initial payload so the first paint is identical to RSC, then takes
// over data ownership via SWR. Mutations (Lumi edits, companion CRUD)
// call `refreshTrip(id)` which re-fetches just this entry — no RSC
// re-render, no router.refresh().

import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Settings, Trash2 } from "lucide-react";

import { MotionButton, MotionLink, popIn } from "@/components/storefront/motion";
import { CompanionsMenu } from "@/components/storefront/trips/companions-menu";
import {
  TripDetailTabs,
  type TripDetailLabels,
} from "@/components/storefront/trips/trip-detail-tabs";
import { tripCoverUrl } from "@/lib/trip-cover";
import { apiDetailToTrip } from "@/lib/trip-mapping";
import { useTripDetail } from "@/lib/trip-cache";
import type { TripDetailPayload } from "@/lib/trips-api";

export interface TripDetailClientLabels extends TripDetailLabels {
  back: string;
  dayUnit: string;
  settings: {
    title: string;
    aria: string;
    trip_section: string;
    delete_trip: string;
    delete_confirm: string;
    delete_cancel: string;
    deleting: string;
    delete_error: string;
  };
  companions: {
    manage_title: string;
    manage_aria: string;
    add: string;
    rename_placeholder: string;
    copy_invite: string;
    copied: string;
    link_only: string;
    joined: string;
    delete: string;
    pick_friend: string;
    pick_friend_soon: string;
  };
  notFound: string;
}

export function TripDetailClient({
  tripId,
  lang,
  initialPayload,
  labels,
}: {
  tripId: string;
  lang: string;
  initialPayload?: TripDetailPayload;
  labels: TripDetailClientLabels;
}) {
  const router = useRouter();
  const { data, error, isLoading } = useTripDetail(tripId, initialPayload);
  const payload = data ?? initialPayload;
  if (!payload) {
    return (
      <TripDetailSkeleton
        lang={lang}
        labels={labels}
        message={error ? labels.notFound : undefined}
        loading={isLoading}
      />
    );
  }
  const trip = apiDetailToTrip(payload);
  const coverSrc = tripCoverUrl({
    title: trip.title,
    cities: trip.days.map((d) => d.city),
  });

  return (
    <div>
      <header className="relative h-[180px] overflow-hidden">
        <Image
          src={coverSrc}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        {/* Bottom-anchored fade so the title sits on a darkened gradient,
            while the back / companions buttons up top read against the
            photo via their own pill backgrounds. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-3">
          <MotionLink
            href={`/${lang}/trips`}
            aria-label={labels.back}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-fg transition-colors hover:bg-surface-hover"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </MotionLink>
          <div className="flex items-center gap-2">
            <CompanionsMenu
              tripId={trip.id}
              companions={payload.companions}
              labels={labels.companions}
            />
            <TripSettingsMenu
              tripId={trip.id}
              title={trip.title}
              labels={labels.settings}
              onDeleted={() => {
                router.push(`/${lang}/trips`);
                router.refresh();
              }}
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4 text-white">
          <div className="inline-flex max-w-full flex-col rounded-[14px] bg-black/24 px-3 py-2 backdrop-blur-[2px]">
            <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] drop-shadow-sm">
              {trip.title}
            </h1>
            <div className="mt-0.5 text-[12.5px] text-white/92">
              {trip.start} → {trip.end}
              {trip.days.length > 0
                ? ` · ${trip.days.length} ${labels.dayUnit}`
                : ""}
            </div>
          </div>
        </div>
      </header>

      <TripDetailTabs
        trip={trip}
        cities={payload.cities}
        companions={payload.companions}
        lang={lang}
        labels={labels}
      />
    </div>
  );
}

function TripSettingsMenu({
  tripId,
  title,
  labels,
  onDeleted,
}: {
  tripId: string;
  title: string;
  labels: TripDetailClientLabels["settings"];
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
        setError(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function deleteTrip() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      onDeleted();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <MotionButton
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
          setError(false);
        }}
        aria-label={labels.aria}
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/88 text-fg transition-colors backdrop-blur hover:bg-white"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Settings className="h-4 w-4" />
      </MotionButton>

      <AnimatePresence>
        {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 px-4 pt-[72px] backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={() => {
              setOpen(false);
              setConfirming(false);
              setError(false);
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={labels.title}
            {...popIn}
            className="relative z-10 w-full max-w-[320px] overflow-hidden rounded-2xl border border-divider bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-divider px-4 py-3">
              <div className="text-[13px] font-semibold tracking-[-0.01em] text-fg">
                {labels.title}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-fg-muted">
                {title}
              </div>
            </div>

            <div className="px-4 py-3 text-[12px] font-medium text-fg-muted">
              {labels.trip_section}
            </div>

            <div className="border-t border-divider p-1.5">
              {confirming ? (
                <div className="space-y-1">
                  <MotionButton
                    type="button"
                    onClick={() => void deleteTrip()}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-[#b91c1c] transition-colors hover:bg-[#fee2e2] disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{busy ? labels.deleting : labels.delete_confirm}</span>
                  </MotionButton>
                  <MotionButton
                    type="button"
                    onClick={() => {
                      setConfirming(false);
                      setError(false);
                    }}
                    disabled={busy}
                    className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-fg-muted transition-colors hover:bg-[rgba(0,0,0,0.04)] disabled:opacity-60"
                  >
                    {labels.delete_cancel}
                  </MotionButton>
                </div>
              ) : (
                <MotionButton
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-[#b91c1c] transition-colors hover:bg-[#fee2e2] disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{labels.delete_trip}</span>
                </MotionButton>
              )}
              {error && (
                <div className="px-3 pb-2 pt-1 text-[11px] text-[#b91c1c]">
                  {labels.delete_error}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TripDetailSkeleton({
  lang,
  labels,
  message,
  loading,
}: {
  lang: string;
  labels: TripDetailClientLabels;
  message?: string;
  loading: boolean;
}) {
  return (
    <div>
      <header className="relative h-[180px] overflow-hidden bg-surface-sunken">
        <div className="absolute inset-x-0 top-0 flex items-start px-4 pt-3">
          <MotionLink
            href={`/${lang}/trips`}
            aria-label={labels.back}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-fg"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </MotionLink>
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-2 px-5 pb-4">
          <div className="h-6 w-44 rounded-full bg-[rgba(0,0,0,0.08)]" />
          <div className="h-3 w-32 rounded-full bg-[rgba(0,0,0,0.06)]" />
        </div>
      </header>

      {message && !loading ? (
        <div className="flex min-h-[52vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-[16px] text-fg-muted">{message}</div>
          <MotionLink
            href={`/${lang}/trips`}
            className="rounded-[10px] bg-fg px-4 py-2 text-[13px] font-semibold text-white"
          >
            {labels.back}
          </MotionLink>
        </div>
      ) : (
        <div className="px-5 pb-8">
          <div className="mt-5 h-[34vw] min-h-[180px] max-h-[340px] rounded-[24px] bg-[rgba(0,0,0,0.06)]" />
          <div className="mt-8 space-y-3">
            <div className="h-3 w-28 rounded-full bg-[rgba(0,0,0,0.08)]" />
            <div className="h-7 w-64 max-w-full rounded-full bg-[rgba(0,0,0,0.08)]" />
            <div className="h-4 w-24 rounded-full bg-[rgba(0,0,0,0.06)]" />
          </div>
          <div className="mt-8 space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-16 space-y-2">
                  <div className="h-4 w-12 rounded-full bg-[rgba(0,0,0,0.10)]" />
                  <div className="h-3 w-9 rounded-full bg-[rgba(0,0,0,0.06)]" />
                </div>
                <div className="h-10 w-10 rounded-full bg-[rgba(15,184,180,0.16)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 w-[70%] rounded-full bg-[rgba(0,0,0,0.08)]" />
                  <div className="h-3 w-[46%] rounded-full bg-[rgba(0,0,0,0.06)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
