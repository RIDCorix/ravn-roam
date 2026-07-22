"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Compass,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import {
  LocationSelector,
  type LocationSelection,
  type LocationSelectorLabels,
} from "@/components/storefront/location-selector";
import {
  getLumiAvatar,
  LumiAvatarChip,
} from "@/components/storefront/lumi-avatar";
import {
  OPEN_LUMI_ASSISTANT_EVENT,
  type OpenLumiAssistantDetail,
} from "@/components/storefront/trips/lumi-assistant";
import {
  EditorialCover,
  EditorialMasthead,
  EditorialSectionLabel,
  editorialCoverSource,
} from "@/components/storefront/trips/trip-editorial-ui";
import {
  StorefrontTabs,
  StorefrontTabsList,
  StorefrontTabsTrigger,
} from "@/components/storefront/storefront-tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Trip } from "@/lib/trip-types";
import { uniqueTripCities } from "@/lib/trip-types";
import { cn } from "@/lib/utils";

type TripsPayload = { trips: Trip[] };

export type BackendTripsLabels = {
  title: string;
  eyebrow: string;
  subtitle: string;
  tabs: {
    all: string;
    draft: string;
    completed: string;
    archived: string;
  };
  search_placeholder: string;
  new_trip: string;
  actions: {
    more: string;
    delete_trip: string;
    delete_title: string;
    delete_body: string;
    delete_confirm: string;
    delete_cancel: string;
    deleting: string;
    delete_error: string;
    load_error: string;
    retry: string;
  };
  empty: {
    title: string;
    body: string;
    cta: string;
  };
  form: {
    title: string;
    mode_manual: string;
    mode_explore: string;
    mode_lumi: string;
    explore_title: string;
    explore_body: string;
    explore_default_title: string;
    trip_name: string;
    trip_name_placeholder: string;
    destination: string;
    start_date: string;
    end_date: string;
    lumi_prompt: string;
    lumi_prompt_placeholder: string;
    lumi_error: string;
    creating: string;
    lumi_generating: string;
    lumi_thinking_phrases: string[];
    cancel: string;
    save: string;
    location_selector: LocationSelectorLabels;
  };
  card: {
    destination_fallback: string;
    date_fallback: string;
    planned: string;
    open: string;
    continue: string;
    companion_count: string;
    active: string;
    upcoming: string;
  };
  side: {
    recommendations_title: string;
    view_all: string;
    articles_title: string;
    weather_title: string;
    weather_link: string;
    read_time: string;
    recommendations: Array<{ title: string; duration: string }>;
    articles: Array<{ title: string; tag: string }>;
    weather_summary: string;
  };
};

const RECOMMENDATION_IMAGES = [
  "/illustrations/events/korea-jinhae-gunhangje-cherry-blossom.png",
  "/illustrations/cities/kyoto.jpg",
  "/illustrations/events/japan-gion-matsuri-2026.png",
];

export function BackendTripsPage({
  lang,
  labels,
  initialTrips,
  preview = false,
}: {
  lang: string;
  labels: BackendTripsLabels;
  initialTrips?: Trip[];
  preview?: boolean;
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [previewTrips, setPreviewTrips] = useState(initialTrips ?? []);
  const {
    data,
    error: remoteError,
    isLoading: remoteLoading,
    mutate,
  } = useSWR<TripsPayload>(
    preview ? null : "storefront-trips",
    fetchTrips,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    },
  );
  const trips = useMemo(
    () => (preview ? previewTrips : (data?.trips ?? [])),
    [data?.trips, preview, previewTrips],
  );
  const isLoading = preview ? false : remoteLoading;
  const visibleTrips = useMemo(
    () => filterTrips(trips, tab, query),
    [query, tab, trips],
  );

  function handleCreated(id: string) {
    setEditorOpen(false);
    void mutate();
    router.push(`/${lang}/trips/${id}`);
  }

  async function handleDeleteTrip() {
    if (!deleteTarget || deleteBusy) return;
    const targetId = deleteTarget.id;
    if (preview) {
      setPreviewTrips((current) => current.filter((trip) => trip.id !== targetId));
      setDeleteTarget(null);
      return;
    }
    setDeleteBusy(true);
    setDeleteError(false);
    try {
      await mutate(
        async (current) => {
          await deleteTrip(targetId);
          return {
            trips: (current?.trips ?? trips).filter((trip) => trip.id !== targetId),
          };
        },
        {
          optimisticData: {
            trips: trips.filter((trip) => trip.id !== targetId),
          },
          populateCache: true,
          revalidate: false,
          rollbackOnError: true,
        },
      );
      setDeleteTarget(null);
    } catch {
      setDeleteError(true);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper px-4 pb-10 pt-20 text-fg sm:px-8 sm:pt-28">
      <div className="mx-auto grid w-full max-w-[1480px] gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <EditorialMasthead className="bg-paper-raised p-5 sm:p-7 lg:p-8">
            <EditorialSectionLabel>{labels.eyebrow}</EditorialSectionLabel>
            <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[660px]">
                <h1 className="font-editorial text-[46px] font-normal leading-[0.95] tracking-[-0.04em] text-fg sm:text-[62px]">
                  {labels.title}
                </h1>
                <p className="mt-4 max-w-[540px] text-[14px] leading-6 text-fg-secondary sm:text-[15px]">
                  {labels.subtitle}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <div className="relative min-w-0 sm:w-[330px]">
                  <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-fg-muted" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={labels.search_placeholder}
                    aria-label={labels.search_placeholder}
                    className="h-11 rounded-xl border-divider-strong bg-white/90 pr-10 text-[14px] shadow-none"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="trip-editorial-pressable h-11 w-full rounded-xl bg-fg px-5 text-[14px] font-semibold text-white shadow-sm hover:bg-fg-secondary sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  {labels.new_trip}
                </Button>
              </div>
            </div>

            <StorefrontTabs value={tab} onValueChange={setTab} className="mt-7">
              <StorefrontTabsList className="w-full gap-5 overflow-x-auto border-t border-divider pt-4 sm:gap-7">
                <StorefrontTabsTrigger value="all" className="text-[14px]">
                  {labels.tabs.all}
                </StorefrontTabsTrigger>
                <StorefrontTabsTrigger value="draft" className="text-[14px]">
                  {labels.tabs.draft}
                </StorefrontTabsTrigger>
                <StorefrontTabsTrigger value="completed" className="text-[14px]">
                  {labels.tabs.completed}
                </StorefrontTabsTrigger>
                <StorefrontTabsTrigger value="archived" className="text-[14px]">
                  {labels.tabs.archived}
                </StorefrontTabsTrigger>
              </StorefrontTabsList>
            </StorefrontTabs>
          </EditorialMasthead>

          <div className="mt-5 space-y-4">
            {isLoading && <TripSkeleton />}
            {!isLoading && remoteError && (
              <div
                role="alert"
                className="rounded-[22px] border border-error/20 bg-error-soft p-6 text-[14px] text-fg-secondary"
              >
                <p>{labels.actions.load_error}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-10 rounded-xl bg-paper-raised"
                  onClick={() => void mutate()}
                >
                  {labels.actions.retry}
                </Button>
              </div>
            )}
            {!isLoading && !remoteError &&
              visibleTrips.map((trip) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  lang={lang}
                  labels={labels}
                  onDelete={setDeleteTarget}
                />
              ))}
            {!isLoading && !remoteError && visibleTrips.length === 0 && (
              <EmptyState labels={labels} onCreate={() => setEditorOpen(true)} />
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-5">
          <SidePanel labels={labels} />
        </aside>
      </div>

      {editorOpen && (
        <TripEditor
          lang={lang}
          labels={labels}
          onCancel={() => setEditorOpen(false)}
          onCreated={handleCreated}
        />
      )}

      <DeleteTripDialog
        trip={deleteTarget}
        labels={labels}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteTarget(null);
          setDeleteError(false);
        }}
        onConfirm={handleDeleteTrip}
      />
    </div>
  );
}

function TripRow({
  trip,
  lang,
  labels,
  onDelete,
}: {
  trip: Trip;
  lang: string;
  labels: BackendTripsLabels;
  onDelete: (trip: Trip) => void;
}) {
  const cities = uniqueTripCities(trip);
  const destination = cities.join(" · ") || labels.card.destination_fallback;
  const days = tripDays(trip.start, trip.end);
  const dateLabel =
    trip.start && trip.end
      ? `${trip.start} - ${trip.end} (${days} ${labels.card.date_fallback})`
      : labels.card.date_fallback;
  const progress = tripProgress(trip);
  const cover = imageForTrip(trip);

  return (
    <article
      data-testid="trip-editorial-card"
      className="trip-editorial-pressable group relative grid min-h-[176px] overflow-hidden rounded-[22px] border border-divider bg-paper-raised shadow-[var(--shadow-sm)] focus-within:border-accent/45 focus-within:ring-2 focus-within:ring-accent/25 sm:grid-cols-[230px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]"
    >
      <Link
        href={`/${lang}/trips/${trip.id}`}
        aria-label={`${labels.card.open}: ${trip.title}`}
        className="absolute inset-0 z-10 rounded-[22px] focus-visible:outline-none"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="trip-editorial-pressable absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-fg-muted shadow-sm backdrop-blur hover:bg-surface-hover hover:text-fg"
            aria-label={labels.actions.more}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="rounded-xl border-divider bg-white p-1.5 shadow-[0_18px_50px_-32px_rgba(32,41,46,0.55)]"
        >
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onDelete(trip)}
            className="h-10 rounded-lg px-3 text-[13px] font-semibold"
          >
            <Trash2 className="h-4 w-4" />
            {labels.actions.delete_trip}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="relative min-h-[150px] bg-accent-softer sm:min-h-0">
        <EditorialCover
          src={cover}
          seed={trip.id}
          alt=""
          sizes="(min-width: 1024px) 300px, 250px"
          className="object-cover transition-transform duration-200 motion-reduce:transition-none motion-reduce:transform-none group-hover:[@media(hover:hover)_and_(pointer:fine)]:scale-[1.015]"
          priority
        />
        <span className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-white/92 text-accent shadow-sm backdrop-blur">
          <CalendarDays className="h-5 w-5" />
        </span>
      </div>
      <div className="grid gap-6 p-5 pr-14 sm:p-6 md:grid-cols-[minmax(0,1fr)_190px] md:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                {statusLabel(trip, labels)}
              </span>
              <h2 className="mt-2 truncate font-editorial text-[28px] font-normal leading-tight tracking-[-0.025em] text-fg sm:text-[32px]">
                {trip.title}
              </h2>
            </div>
          </div>
          <p className="mt-2 flex min-w-0 items-center gap-2 text-[13px] font-medium text-fg-secondary sm:text-[14px]">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            <span className="truncate">{destination}</span>
          </p>
          <p className="mt-4 flex min-w-0 items-center gap-2 text-[13px] text-fg-muted sm:text-[14px]">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="truncate">{dateLabel}</span>
          </p>
        </div>

        <div className="flex items-end justify-between gap-4 md:flex-col md:items-stretch">
          <div
            data-testid="trip-editorial-progress"
            role="progressbar"
            aria-label={labels.card.planned}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="min-w-[142px]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                {labels.card.planned}
              </p>
              <p className="font-mono text-[14px] font-semibold text-fg">
                {progress}%
              </p>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="trip-editorial-pressable relative z-20 h-10 min-w-[128px] rounded-xl border-divider-strong bg-transparent text-[13px] font-semibold text-fg hover:border-accent/40 hover:bg-accent-soft hover:text-accent sm:min-w-[142px]"
          >
            <Link href={`/${lang}/trips/${trip.id}`}>
              {progress > 0 ? labels.card.continue : labels.card.open}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function DeleteTripDialog({
  trip,
  labels,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  trip: Trip | null;
  labels: BackendTripsLabels;
  busy: boolean;
  error: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={Boolean(trip)}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="rounded-[24px] border-white/70 bg-white p-5 shadow-2xl sm:max-w-[430px]">
        <DialogHeader>
          <DialogTitle className="text-[22px] tracking-[-0.02em] text-fg">
            {labels.actions.delete_title}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-6 text-fg-muted">
            {formatDeleteBody(labels.actions.delete_body, trip?.title ?? "")}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-xl bg-[rgba(220,38,38,0.08)] px-3 py-2 text-[12px] leading-5 text-[#b91c1c]">
            {labels.actions.delete_error}
          </div>
        )}
        <DialogFooter className="gap-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={busy}
            onClick={onCancel}
          >
            {labels.actions.delete_cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 rounded-xl px-5"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? labels.actions.deleting : labels.actions.delete_confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TripEditor({
  lang,
  labels,
  onCancel,
  onCreated,
}: {
  lang: string;
  labels: BackendTripsLabels;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [mode, setMode] = useState<"manual" | "explore" | "lumi">("manual");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState<LocationSelection | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(labels.form.lumi_generating);
  const [error, setError] = useState<string | null>(null);
  const lumiAvatar = getLumiAvatar("classic");

  useEffect(() => {
    if (!busy || mode !== "lumi") return;
    const phrases = labels.form.lumi_thinking_phrases.length
      ? labels.form.lumi_thinking_phrases
      : [labels.form.lumi_generating];
    let index = Math.floor(Math.random() * phrases.length);
    const interval = window.setInterval(() => {
      index = (index + 1) % phrases.length;
      setThinkingPhrase(phrases[index] ?? labels.form.lumi_generating);
    }, 2600);
    return () => window.clearInterval(interval);
  }, [
    busy,
    labels.form.lumi_generating,
    labels.form.lumi_thinking_phrases,
    mode,
  ]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (mode === "explore") {
      setBusy(true);
      setError(null);
      try {
        const id = await createExploreTrip({
          title: labels.form.explore_default_title,
          startDate,
          endDate,
        });
        onCreated(id);
      } catch {
        setError(labels.form.lumi_error);
        setBusy(false);
      }
      return;
    }
    if (mode === "lumi") {
      const cleanPrompt = prompt.trim();
      if (!cleanPrompt) return;
      openLumiTripChat(cleanPrompt);
      onCancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createManualTrip({
        title: title.trim(),
        location,
        startDate,
        endDate,
      });
      onCreated(id);
    } catch {
      setError(labels.form.lumi_error);
      setBusy(false);
    }
  }

  const manualDisabled = !title.trim() || !location;
  const lumiDisabled = !prompt.trim();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[24px] border-divider bg-paper-raised p-4 shadow-2xl sm:max-w-[520px] sm:p-5"
      >
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="font-editorial text-[26px] font-normal tracking-[-0.025em] text-fg">
              {labels.form.title}
            </DialogTitle>
          </DialogHeader>
        <div className="mt-4 grid grid-cols-1 rounded-2xl bg-surface p-1 min-[420px]:grid-cols-3">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-colors",
              mode === "manual"
                ? "bg-white text-fg shadow-sm"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <MapPin className="h-4 w-4" />
            {labels.form.mode_manual}
          </button>
          <button
            type="button"
            onClick={() => setMode("explore")}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-colors",
              mode === "explore"
                ? "bg-white text-fg shadow-sm"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <Compass className="h-4 w-4" />
            {labels.form.mode_explore}
          </button>
          <button
            type="button"
            onClick={() => setMode("lumi")}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-colors",
              mode === "lumi"
                ? "bg-white text-fg shadow-sm"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <LumiAvatarChip
              avatar={lumiAvatar}
              size={24}
              active={mode === "lumi"}
            />
            {labels.form.mode_lumi}
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {mode === "manual" ? (
            <>
              <label className="block">
                <span className="text-[13px] font-semibold text-fg-secondary">
                  {labels.form.trip_name}
                </span>
                <Input
                  required
                  maxLength={80}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={labels.form.trip_name_placeholder}
                  className="mt-2 h-11 rounded-xl"
                />
              </label>
              <div className="block">
                <span className="text-[13px] font-semibold text-fg-secondary">
                  {labels.form.destination}
                </span>
                <LocationSelector
                  lang={lang}
                  value={location}
                  labels={labels.form.location_selector}
                  onChange={setLocation}
                />
              </div>
              <DateRangeFields
                labels={labels}
                startDate={startDate}
                endDate={endDate}
                onStartDate={setStartDate}
                onEndDate={setEndDate}
              />
            </>
          ) : mode === "explore" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-accent/18 bg-accent-softer p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-accent shadow-sm">
                    <Compass className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-fg">
                      {labels.form.explore_title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-6 text-fg-muted">
                      {labels.form.explore_body}
                    </p>
                  </div>
                </div>
              </div>
              <DateRangeFields
                labels={labels}
                startDate={startDate}
                endDate={endDate}
                onStartDate={setStartDate}
                onEndDate={setEndDate}
              />
            </div>
          ) : (
            <label className="block">
              <span className="text-[13px] font-semibold text-fg-secondary">
                {labels.form.lumi_prompt}
              </span>
              <Textarea
                required
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={labels.form.lumi_prompt_placeholder}
                className="mt-2 min-h-[150px] rounded-2xl border-divider-strong text-[14px] leading-6 focus-visible:ring-accent/25"
              />
              {busy && (
                <span className="mt-3 flex w-fit max-w-full items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-[12.5px] font-medium text-fg-secondary">
                  <LumiAvatarChip avatar={lumiAvatar} size={24} />
                  <BouncingMurmur text={thinkingPhrase} />
                </span>
              )}
            </label>
          )}
          {error && (
            <span className="block rounded-xl bg-[rgba(220,38,38,0.08)] px-3 py-2 text-[12px] leading-5 text-[#b91c1c]">
              {error}
            </span>
          )}
        </div>
          <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            onClick={onCancel}
            disabled={busy}
          >
            {labels.form.cancel}
          </Button>
          <Button
            type="submit"
            disabled={
              busy ||
              (mode === "manual"
                ? manualDisabled
                : mode === "lumi"
                  ? lumiDisabled
                  : false)
            }
            className="h-11 min-w-[136px] rounded-xl bg-fg text-white disabled:opacity-55"
          >
            {busy && mode === "lumi" ? (
              <BouncingMurmur text={thinkingPhrase} />
            ) : busy ? (
              labels.form.creating
            ) : (
              labels.form.save
            )}
          </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DateRangeFields({
  labels,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
}: {
  labels: BackendTripsLabels;
  startDate: string;
  endDate: string;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-[13px] font-semibold text-fg-secondary">
          {labels.form.start_date}
        </span>
        <Input
          required
          type="date"
          value={startDate}
          onChange={(event) => onStartDate(event.target.value)}
          className="mt-2 h-11 rounded-xl"
        />
      </label>
      <label className="block">
        <span className="text-[13px] font-semibold text-fg-secondary">
          {labels.form.end_date}
        </span>
        <Input
          required
          type="date"
          value={endDate}
          min={startDate}
          onChange={(event) => onEndDate(event.target.value)}
          className="mt-2 h-11 rounded-xl"
        />
      </label>
    </div>
  );
}

function SidePanel({ labels }: { labels: BackendTripsLabels }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-divider bg-paper-raised shadow-[var(--shadow-sm)] xl:sticky xl:top-28">
      <section className="p-5 sm:p-6">
        <PanelTitle title={labels.side.recommendations_title} />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {labels.side.recommendations.map((item, index) => (
            <article key={item.title} className="min-w-0">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-accent-softer">
                <Image
                  src={RECOMMENDATION_IMAGES[index] ?? RECOMMENDATION_IMAGES[0]}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-[1.45] text-fg">
                {item.title}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">
                {item.duration}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-divider p-5 sm:p-6">
        <PanelTitle title={labels.side.articles_title} />
        <div className="mt-5 space-y-4">
          {labels.side.articles.map((article, index) => (
            <article key={article.title} className="flex gap-3">
              <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-accent-softer">
                <Image
                  src={
                    [
                      "/illustrations/cities/kyoto.jpg",
                      "/illustrations/cities/new-york.jpg",
                      "/illustrations/cities/singapore.jpg",
                    ][index] ?? "/illustrations/cities/kyoto.jpg"
                  }
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 font-editorial text-[16px] leading-[1.25] text-fg">
                  {article.title}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-fg-muted">
                  {article.tag} · 5 {labels.side.read_time}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="font-editorial text-[20px] font-normal tracking-[-0.02em] text-fg">
        {title}
      </h2>
    </div>
  );
}

function EmptyState({
  labels,
  onCreate,
}: {
  labels: BackendTripsLabels;
  onCreate: () => void;
}) {
  return (
    <div
      data-testid="trip-empty-editorial"
      className="grid min-h-[360px] overflow-hidden rounded-[22px] border border-divider bg-paper-raised shadow-[var(--shadow-sm)] lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,1.08fr)]"
    >
      <div className="flex flex-col justify-center p-7 sm:p-10">
        <EditorialSectionLabel>{labels.eyebrow}</EditorialSectionLabel>
        <span className="mt-6 grid h-12 w-12 place-items-center rounded-full border border-accent/25 bg-accent-softer text-accent">
          <Compass className="h-5 w-5" />
        </span>
        <h2 className="mt-5 max-w-[420px] font-editorial text-[36px] font-normal leading-[1.02] tracking-[-0.035em] text-fg sm:text-[44px]">
          {labels.empty.title}
        </h2>
        <p className="mt-4 max-w-[420px] text-[14px] leading-6 text-fg-muted">
          {labels.empty.body}
        </p>
        <Button
          type="button"
          onClick={onCreate}
          className="trip-editorial-pressable mt-6 h-11 w-fit rounded-xl bg-fg px-5 text-white hover:bg-fg-secondary"
        >
          <Plus className="h-4 w-4" />
          {labels.empty.cta}
        </Button>
      </div>

      <div className="relative hidden min-h-[360px] overflow-hidden bg-accent-softer lg:block">
        <Image
          src="/illustrations/cities/barcelona.jpg"
          alt=""
          fill
          sizes="640px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-fg/35 via-transparent to-paper/10" />
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 text-white">
          <p className="max-w-[260px] font-editorial text-[24px] leading-[1.08]">
            {labels.subtitle}
          </p>
          <span className="grid h-11 w-11 place-items-center rounded-full border border-white/55 bg-white/12 backdrop-blur-sm">
            <MapPin className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

function TripSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-[190px] animate-pulse rounded-[22px] border border-divider bg-paper-raised motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

async function fetchTrips(): Promise<TripsPayload> {
  const res = await fetch("/api/storefront/trips", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetch trips failed: ${res.status} ${text.slice(0, 160)}`);
  }
  return (await res.json()) as TripsPayload;
}

async function createManualTrip(input: {
  title: string;
  location: LocationSelection | null;
  startDate: string;
  endDate: string;
}): Promise<string> {
  if (!input.title || !input.location) throw new Error("missing trip input");
  const endDate = input.endDate < input.startDate ? input.startDate : input.endDate;
  const response = await postTrip({
    title: input.title,
    cover: null,
    start_date: input.startDate,
    end_date: endDate,
    status: "upcoming",
    metadata: {
      draft: true,
      source: "manual",
      location: input.location,
    },
    days: [
      {
        day_date: input.startDate,
        city: input.location.label,
        note: "",
      },
    ],
    checklist: [
      {
        text: "Confirm eSIM coverage",
        kind: "esim",
        phase: "before_trip",
        group_label: "Connectivity",
        suggested: true,
        suggested_by: "Roam",
        due_date: input.startDate,
      },
    ],
  });
  return response.trip.id;
}

async function createExploreTrip(input: {
  title: string;
  startDate: string;
  endDate: string;
}): Promise<string> {
  const endDate = input.endDate < input.startDate ? input.startDate : input.endDate;
  const response = await postTrip({
    title: input.title,
    cover: null,
    start_date: input.startDate,
    end_date: endDate,
    status: "upcoming",
    metadata: {
      draft: true,
      source: "explore",
      planning: {
        inspiration: "",
        main_destinations: [],
        destination_days: [],
      },
    },
    days: [],
    checklist: [],
  });
  return response.trip.id;
}

async function postTrip(body: Record<string, unknown>): Promise<{ trip: { id: string } }> {
  const response = await fetch("/api/trips", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`create trip failed: ${response.status}`);
  const payload = (await response.json()) as { trip?: { id?: string } };
  if (!payload.trip?.id) throw new Error("missing trip id");
  return { trip: { id: payload.trip.id } };
}

function openLumiTripChat(prompt: string) {
  window.dispatchEvent(
    new CustomEvent<OpenLumiAssistantDetail>(OPEN_LUMI_ASSISTANT_EVENT, {
      detail: {
        prompt,
        autoSend: true,
        newConversation: true,
        skill: "create-trip",
        autoCreateTrip: true,
      },
    }),
  );
}

async function deleteTrip(id: string): Promise<void> {
  const response = await fetch(`/api/trips/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`delete trip failed: ${response.status}`);
}

function filterTrips(trips: Trip[], tab: string, query: string): Trip[] {
  const needle = query.trim().toLowerCase();
  return trips.filter((trip) => {
    const archived = trip.metadata?.archived === true;
    if (tab === "draft" && (trip.metadata?.draft !== true || archived)) return false;
    if (tab === "completed" && (trip.status !== "past" || archived)) return false;
    if (tab === "archived" && !archived) return false;
    if (!needle) return true;
    const haystack = `${trip.title} ${uniqueTripCities(trip).join(" ")}`.toLowerCase();
    return haystack.includes(needle);
  });
}

function tripProgress(trip: Trip): number {
  const total = trip.checklist.length;
  if (total > 0) {
    return Math.round((trip.checklist.filter((item) => item.done).length / total) * 100);
  }
  if (isExploreTrip(trip)) return exploreTripProgress(trip);
  return 0;
}

function isExploreTrip(trip: Trip): boolean {
  return (
    trip.metadata?.source === "explore" ||
    trip.metadata?.source === "explore_confirmed"
  );
}

function exploreTripProgress(trip: Trip): number {
  const planning =
    trip.metadata?.planning && typeof trip.metadata.planning === "object"
      ? (trip.metadata.planning as Record<string, unknown>)
      : {};
  const hasDateRange = Boolean(trip.start && trip.end);
  const hasInspiration =
    typeof planning.inspiration === "string" &&
    planning.inspiration.trim().length > 0;
  const hasDestinations =
    hasStringEntries(planning.main_destinations) || uniqueTripCities(trip).length > 0;
  const hasSavedInspiration = Array.isArray(planning.inspiration_wishlist)
    ? planning.inspiration_wishlist.length > 0
    : false;
  const hasDaySplit = hasDestinationDayEntries(planning.destination_days);
  const completedSignals = [
    hasDateRange,
    hasInspiration || hasSavedInspiration,
    hasDestinations,
    hasDaySplit,
  ].filter(Boolean).length;
  return completedSignals * 25;
}

function hasStringEntries(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim());
}

function hasDestinationDayEntries(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      const countryCode =
        typeof record.country_code === "string" ? record.country_code.trim() : "";
      const days = Number(record.days);
      return countryCode.length > 0 && Number.isFinite(days) && days > 0;
    })
  );
}

function imageForTrip(trip: Trip): string {
  return editorialCoverSource(trip.cover, trip.id);
}

function statusLabel(trip: Trip, labels: BackendTripsLabels): string {
  if (trip.metadata?.archived === true) return labels.tabs.archived;
  if (trip.status === "past") return labels.tabs.completed;
  if (trip.metadata?.draft === true) return labels.tabs.draft;
  if (trip.status === "active") return labels.card.active;
  return labels.card.upcoming;
}

function tripDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diff = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(diff / 86_400_000) + 1;
}

function formatDeleteBody(template: string, title: string): string {
  return template.replace("{title}", title);
}

function BouncingMurmur({ text }: { text: string }) {
  return (
    <span key={text} className="inline-flex" aria-label={text}>
      {Array.from(text).map((char, index) => (
        <span
          key={index}
          aria-hidden
          className="inline-block"
          style={{
            animation: "roam-trip-lumi-bounce 1.1s ease-in-out infinite",
            animationDelay: `${index * 80}ms`,
            whiteSpace: "pre",
          }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
      <style>{`
        @keyframes roam-trip-lumi-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-3px); }
        }
      `}</style>
    </span>
  );
}
