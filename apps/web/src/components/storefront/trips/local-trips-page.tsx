"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CloudSun,
  Compass,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  findLocationByText,
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
  StorefrontTabs,
  StorefrontTabsList,
  StorefrontTabsTrigger,
} from "@/components/storefront/storefront-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LOCAL_TRIP_KEY = "roam.localTripDraft.v1";
const ANONYMOUS_LUMI_TRIP_USED_KEY = "roam.anonymousLumiTripDraftUsed.v1";
const SYNC_TIMEOUT_MS = 15_000;

type SyncState = "local" | "syncing" | "synced" | "error";

type LocalTripDraft = {
  id: string;
  title: string;
  destination: string;
  location?: LocationSelection | null;
  startDate: string;
  endDate: string;
  progress: number;
  cover: string;
  sourcePrompt?: string;
  lumiDraft?: LocalLumiDraft | null;
  createdAt: string;
  updatedAt: string;
  syncedTripId?: string;
  syncState?: SyncState;
  syncStartedAt?: string;
};

type LocalLumiDraft = {
  title: string;
  start_date: string;
  end_date: string;
  cover?: string | null;
  days: {
    day_date: string;
    city: string;
    note: string;
    stops?: {
      name: string;
      kind?: string;
      arrival_time?: string | null;
      duration_min?: number | null;
      note?: string;
      attachments?: {
        id?: string | null;
        type?: string;
        label: string;
        url?: string | null;
        amount?: string | null;
        action_label?: string | null;
        checklist_text?: string | null;
        checklist_kind?: string | null;
        checklist_item_id?: string | null;
        status?: "required" | "completed" | "uploaded";
      }[];
    }[];
  }[];
  checklist?: {
    text: string;
    description?: string | null;
    kind: string;
    start_date?: string | null;
    phase?: string | null;
    group_label?: string | null;
    subtasks?: { text: string; done?: boolean }[];
    shop_filter?: {
      country: string;
      days?: number | null;
      gb?: number | null;
    } | null;
    suggested?: boolean;
  }[];
};

export type LocalTripsLabels = {
  title: string;
  tabs: {
    all: string;
    draft: string;
    completed: string;
    archived: string;
  };
  search_placeholder: string;
  new_trip: string;
  local_badge: string;
  sync: {
    signed_out_title: string;
    signed_out_body: string;
    sign_in: string;
    syncing: string;
    synced: string;
    error: string;
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
    mode_lumi: string;
    trip_name: string;
    trip_name_placeholder: string;
    destination: string;
    destination_placeholder: string;
    start_date: string;
    end_date: string;
    lumi_prompt: string;
    lumi_prompt_placeholder: string;
    lumi_signed_out_hint: string;
    lumi_once_used: string;
    lumi_error: string;
    lumi_generating: string;
    lumi_thinking_phrases: string[];
    cancel: string;
    save: string;
    location_selector: LocationSelectorLabels;
  };
  card: {
    destination_fallback: string;
    date_fallback: string;
    progress: string;
    planned: string;
    open: string;
    continue: string;
    companion_count: string;
  };
  side: {
    tabs: {
      inspiration: string;
      events: string;
      info: string;
      invite: string;
    };
    recommendations_title: string;
    view_all: string;
    articles_title: string;
    weather_title: string;
    weather_link: string;
    read_time: string;
  };
};

const RECOMMENDATION_IMAGES = [
  "/illustrations/events/korea-jinhae-gunhangje-cherry-blossom.png",
  "/illustrations/cities/kyoto.jpg",
  "/illustrations/events/japan-gion-matsuri-2026.png",
];

const COVER_BY_DESTINATION: Array<{ match: RegExp; src: string }> = [
  { match: /paris|france|巴黎|法國/i, src: "/illustrations/cities/paris.jpg" },
  { match: /kyoto|osaka|japan|京都|大阪|日本/i, src: "/illustrations/cities/kyoto.jpg" },
  { match: /new york|nyc|紐約/i, src: "/illustrations/cities/new-york.jpg" },
  { match: /swiss|zurich|瑞士|蘇黎世/i, src: "/illustrations/cities/europe.jpg" },
  { match: /sydney|australia|雪梨|澳洲/i, src: "/illustrations/cities/sydney.jpg" },
  { match: /taipei|taiwan|台北|台灣/i, src: "/illustrations/cities/taipei.jpg" },
];

export function LocalTripsPage({
  lang,
  isSignedIn,
  labels,
}: {
  lang: string;
  isSignedIn: boolean;
  labels: LocalTripsLabels;
}) {
  const [draft, setDraft] = useState<LocalTripDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setDraft(readLocalDraft());
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function retrySync() {
    if (!draft) return;
    const retryDraft = {
      ...draft,
      syncState: "local" as const,
      syncStartedAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    persistDraft(retryDraft);
    setDraft(retryDraft);
  }

  useEffect(() => {
    if (!hydrated || !isSignedIn || !draft || draft.syncedTripId) return;
    if (draft.syncState === "syncing" || draft.syncState === "error") return;

    const nextDraft = {
      ...draft,
      syncState: "syncing" as const,
      syncStartedAt: new Date().toISOString(),
    };
    let cancelled = false;
    void (async () => {
      persistDraft(nextDraft);
      await Promise.resolve();
      if (cancelled) return;
      setDraft(nextDraft);
      try {
        const syncedTripId = await syncDraft(nextDraft);
        if (cancelled) return;
        const synced = {
          ...nextDraft,
          syncedTripId,
          syncState: "synced" as const,
          syncStartedAt: undefined,
          updatedAt: new Date().toISOString(),
        };
        persistDraft(synced);
        setDraft(synced);
      } catch {
        if (cancelled) return;
        const failed = {
          ...nextDraft,
          syncState: "error" as const,
          syncStartedAt: undefined,
          updatedAt: new Date().toISOString(),
        };
        persistDraft(failed);
        setDraft(failed);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draft, hydrated, isSignedIn]);

  useEffect(() => {
    if (!hydrated || !isSignedIn || !draft || draft.syncedTripId) return;
    if (draft.syncState !== "syncing") return;
    const startedAt = Date.parse(draft.syncStartedAt ?? draft.updatedAt ?? draft.createdAt);
    const elapsed = Number.isFinite(startedAt) ? Date.now() - startedAt : SYNC_TIMEOUT_MS;
    const delay = Math.max(0, SYNC_TIMEOUT_MS - elapsed);
    const timer = window.setTimeout(() => {
      setDraft((current) => {
        if (!current || current.syncedTripId || current.syncState !== "syncing") return current;
        const failed = {
          ...current,
          syncState: "error" as const,
          syncStartedAt: undefined,
          updatedAt: new Date().toISOString(),
        };
        persistDraft(failed);
        return failed;
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [draft, hydrated, isSignedIn]);

  const visibleDraft = useMemo(() => {
    if (!draft) return null;
    const needle = query.trim().toLowerCase();
    if (!needle) return draft;
    return `${draft.title} ${draft.destination}`.toLowerCase().includes(needle)
      ? draft
      : null;
  }, [draft, query]);

  function saveDraft(input: {
    title: string;
    destination: string;
    location?: LocationSelection | null;
    startDate: string;
    endDate: string;
    sourcePrompt?: string;
    lumiDraft?: LocalLumiDraft | null;
    progress?: number;
  }) {
    const now = new Date().toISOString();
    const next: LocalTripDraft = {
      id: draft?.id ?? crypto.randomUUID(),
      title: input.title,
      destination: input.destination,
      location: input.location ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      cover: coverForDestination(input.destination),
      progress: input.progress ?? draft?.progress ?? 30,
      sourcePrompt: input.sourcePrompt,
      lumiDraft: input.lumiDraft ?? null,
      createdAt: draft?.createdAt ?? now,
      updatedAt: now,
      syncState: "local",
    };
    persistDraft(next);
    setDraft(next);
    setEditorOpen(false);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(15,184,180,0.1),transparent_34%),linear-gradient(180deg,#fbfaf7_0%,#f5f2ec_100%)] px-5 pb-10 pt-28 text-fg sm:px-8">
      <div className="mx-auto grid w-full max-w-full gap-6 xl:max-w-[1480px] xl:grid-cols-[minmax(0,1fr)_410px]">
        <section className="min-w-0 rounded-[28px] border border-white/72 bg-white/72 p-5 shadow-[0_24px_70px_-45px_rgba(32,41,46,0.45)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-fg sm:text-[42px]">
                {labels.title}
              </h1>
              <StorefrontTabs defaultValue="all" className="mt-5">
                <StorefrontTabsList className="gap-7">
                  <StorefrontTabsTrigger value="all" className="text-[15px]">
                    {labels.tabs.all}
                  </StorefrontTabsTrigger>
                  <StorefrontTabsTrigger value="draft" className="text-[15px]">
                    {labels.tabs.draft}
                  </StorefrontTabsTrigger>
                  <StorefrontTabsTrigger value="completed" className="text-[15px]">
                    {labels.tabs.completed}
                  </StorefrontTabsTrigger>
                  <StorefrontTabsTrigger value="archived" className="text-[15px]">
                    {labels.tabs.archived}
                  </StorefrontTabsTrigger>
                </StorefrontTabsList>
              </StorefrontTabs>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative min-w-0 sm:w-[360px]">
                <Search className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={labels.search_placeholder}
                  className="h-12 rounded-2xl border-divider-strong bg-white/88 pr-11 text-[15px] shadow-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="hidden h-12 w-12 rounded-2xl border-divider-strong bg-white/88 text-fg-secondary sm:inline-flex"
                aria-label="Layout"
              >
                <LayoutGrid className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="h-12 rounded-2xl bg-accent px-5 text-[15px] font-semibold text-white shadow-[0_18px_32px_-18px_rgba(15,184,180,0.85)] hover:bg-accent/90"
              >
                <Plus className="h-5 w-5" />
                {labels.new_trip}
              </Button>
            </div>
          </div>

          <SyncBanner
            lang={lang}
            isSignedIn={isSignedIn}
            draft={draft}
            labels={labels}
            onRetry={retrySync}
          />

          <div className="mt-7 space-y-3">
            {!hydrated && <TripSkeleton />}
            {hydrated && visibleDraft && (
              <TripRow
                draft={visibleDraft}
                lang={lang}
                isSignedIn={isSignedIn}
                labels={labels}
              />
            )}
            {hydrated && !visibleDraft && (
              <EmptyState
                labels={labels}
                onCreate={() => setEditorOpen(true)}
              />
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-5">
          <SidePanel labels={labels} />
        </aside>
      </div>

      {editorOpen && (
        <DraftEditor
          draft={draft}
          lang={lang}
          isSignedIn={isSignedIn}
          labels={labels}
          onCancel={() => setEditorOpen(false)}
          onSave={saveDraft}
        />
      )}
    </div>
  );
}

function SyncBanner({
  lang,
  isSignedIn,
  draft,
  labels,
  onRetry,
}: {
  lang: string;
  isSignedIn: boolean;
  draft: LocalTripDraft | null;
  labels: LocalTripsLabels;
  onRetry: () => void;
}) {
  if (!draft) return null;

  const next = encodeURIComponent(`/${lang}/trips`);
  const syncState = draft.syncState ?? "local";
  const bodyText = !isSignedIn
    ? labels.sync.signed_out_body
    : syncState === "synced"
      ? labels.sync.synced
      : syncState === "error"
        ? labels.sync.error
        : labels.sync.syncing;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-divider bg-surface/86 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          {isSignedIn ? (
            syncState === "syncing" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )
          ) : (
            <LockKeyhole className="h-5 w-5" />
          )}
        </span>
        <div>
          <p className="text-[14px] font-semibold text-fg">
            {isSignedIn ? syncText(syncState, labels) : labels.sync.signed_out_title}
          </p>
          <p className="mt-1 max-w-[640px] text-[13px] leading-6 text-fg-muted">
            {bodyText}
          </p>
        </div>
      </div>
      {!isSignedIn && (
        <Button asChild className="h-10 rounded-xl bg-fg px-4 text-white">
          <Link href={`/${lang}/login?next=${next}`}>
            {labels.sync.sign_in}
          </Link>
        </Button>
      )}
      {isSignedIn && syncState === "error" ? (
        <Button
          type="button"
          onClick={onRetry}
          className="h-10 rounded-xl bg-fg px-4 text-white"
        >
          {labels.sync.retry}
        </Button>
      ) : null}
    </div>
  );
}

function TripRow({
  draft,
  lang,
  isSignedIn,
  labels,
}: {
  draft: LocalTripDraft;
  lang: string;
  isSignedIn: boolean;
  labels: LocalTripsLabels;
}) {
  const days = tripDays(draft.startDate, draft.endDate);
  const dateLabel =
    draft.startDate && draft.endDate
      ? `${draft.startDate} - ${draft.endDate} (${days} ${labels.card.date_fallback})`
      : labels.card.date_fallback;
  const progressColor =
    draft.progress >= 80
      ? "text-accent"
      : draft.progress >= 50
        ? "text-[#4b91c9]"
      : "text-[#e67932]";
  const syncState = draft.syncState ?? "local";
  const serverTripId = draft.syncedTripId;
  const waitingForSync = isSignedIn && !serverTripId;
  const href = `/${lang}/trips/${serverTripId ?? draft.id}`;

  return (
    <article className="grid min-h-[160px] overflow-hidden rounded-[22px] border border-divider bg-white shadow-[0_16px_44px_-32px_rgba(32,41,46,0.45)] sm:grid-cols-[250px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="relative min-h-[190px] bg-accent-softer sm:min-h-0">
        <Image
          src={draft.cover}
          alt=""
          fill
          sizes="(min-width: 1024px) 300px, 250px"
          className="object-cover"
          priority
        />
        <span className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-white/92 text-accent shadow-sm backdrop-blur">
          <CalendarDays className="h-5 w-5" />
        </span>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_170px] md:items-center">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
                {labels.local_badge}
              </span>
              <h2 className="mt-3 truncate text-[26px] font-semibold tracking-[-0.02em] text-fg">
                {draft.title}
              </h2>
            </div>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-surface-hover"
              aria-label="More"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 flex items-center gap-2 text-[15px] font-medium text-fg-secondary">
            <MapPin className="h-4 w-4" />
            {draft.destination || labels.card.destination_fallback}
          </p>
          <p className="mt-6 flex items-center gap-2 text-[15px] text-fg-muted">
            <CalendarDays className="h-4 w-4" />
            {dateLabel}
          </p>
          <div className="mt-5 flex items-center gap-2">
            <AvatarStack />
            <span className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-fg-muted">
              {labels.card.companion_count}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-5 md:flex-col md:items-end">
          <div className="flex items-center gap-3">
            <ProgressRing value={draft.progress} className={progressColor} />
            <div>
              <p className="text-[22px] font-semibold text-fg">
                {draft.progress}%
              </p>
              <p className={cn("text-[13px] font-semibold", progressColor)}>
                {labels.card.planned}
              </p>
            </div>
          </div>
          {waitingForSync ? (
            <Button
              type="button"
              variant="outline"
              disabled
              className="h-11 min-w-[142px] rounded-xl border-accent/30 bg-white text-[14px] font-semibold text-accent"
            >
              {syncState === "syncing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {syncState === "error" ? labels.sync.error : labels.sync.syncing}
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              className="h-11 min-w-[142px] rounded-xl border-accent/40 bg-white text-[14px] font-semibold text-accent hover:bg-accent-soft"
            >
              <Link href={href}>
                {draft.progress > 0 ? labels.card.continue : labels.card.open}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function DraftEditor({
  draft,
  lang,
  isSignedIn,
  labels,
  onCancel,
  onSave,
}: {
  draft: LocalTripDraft | null;
  lang: string;
  isSignedIn: boolean;
  labels: LocalTripsLabels;
  onCancel: () => void;
  onSave: (input: {
    title: string;
    destination: string;
    location?: LocationSelection | null;
    startDate: string;
    endDate: string;
    sourcePrompt?: string;
    lumiDraft?: LocalLumiDraft | null;
    progress?: number;
  }) => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [mode, setMode] = useState<"manual" | "lumi">("manual");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [location, setLocation] = useState<LocationSelection | null>(
    draft?.location ?? findLocationByText(draft?.destination ?? "", lang),
  );
  const [startDate, setStartDate] = useState(draft?.startDate ?? today);
  const [endDate, setEndDate] = useState(draft?.endDate ?? today);
  const [prompt, setPrompt] = useState(draft?.sourcePrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(labels.form.lumi_generating);
  const [anonymousLumiUsed, setAnonymousLumiUsed] = useState(false);
  const [lumiError, setLumiError] = useState<string | null>(null);
  const lumiAvatar = getLumiAvatar("classic");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || isSignedIn) return;
      setAnonymousLumiUsed(
        window.localStorage.getItem(ANONYMOUS_LUMI_TRIP_USED_KEY) === "true",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

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
    if (mode === "manual") {
      const cleanTitle = title.trim();
      if (!cleanTitle || !location) return;
      onSave({
        title: cleanTitle,
        destination: location.label,
        location,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
      });
      return;
    }

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;
    if (isSignedIn) {
      openLumiTripChat(cleanPrompt);
      onCancel();
      return;
    }
    if (!isSignedIn && anonymousLumiUsed) {
      setLumiError(labels.form.lumi_once_used);
      return;
    }
    setThinkingPhrase(firstTripCreationMurmur(labels.form));
    setBusy(true);
    setLumiError(null);
    try {
      const lumiDraft = await requestLumiDraft(cleanPrompt, { isSignedIn });
      if (!lumiDraft) {
        setLumiError(labels.form.lumi_error);
        return;
      }
      if (!isSignedIn) setAnonymousLumiUsed(true);
      const next = draftInputFromPrompt({
        prompt: cleanPrompt,
        lumiDraft,
        lang,
      });
      onSave(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/38 px-4 pb-4 pt-24 backdrop-blur-sm sm:items-center sm:pb-24">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={labels.form.cancel}
        onClick={onCancel}
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-[520px] rounded-[26px] border border-white/60 bg-white p-5 shadow-2xl"
      >
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
          {labels.form.title}
        </h2>
        <div className="mt-4 grid grid-cols-2 rounded-2xl bg-surface p-1">
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
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-semibold text-fg-secondary">
                    {labels.form.start_date}
                  </span>
                  <Input
                    required
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
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
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-2 h-11 rounded-xl"
                  />
                </label>
              </div>
            </>
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
              {!isSignedIn && (
                <span className="mt-2 block text-[12px] leading-5 text-fg-muted">
                  {anonymousLumiUsed
                    ? labels.form.lumi_once_used
                    : labels.form.lumi_signed_out_hint}
                </span>
              )}
              {busy && (
                <span className="mt-3 flex w-fit max-w-full items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-[12.5px] font-medium text-fg-secondary">
                  <LumiAvatarChip avatar={lumiAvatar} size={24} />
                  <BouncingMurmur text={thinkingPhrase} />
                </span>
              )}
              {lumiError && (
                <span className="mt-2 block rounded-xl bg-[rgba(220,38,38,0.08)] px-3 py-2 text-[12px] leading-5 text-[#b91c1c]">
                  {lumiError}
                </span>
              )}
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            onClick={onCancel}
          >
            {labels.form.cancel}
          </Button>
          <Button
            type="submit"
            disabled={
              busy ||
              (mode === "manual" && (!title.trim() || !location)) ||
              (mode === "lumi" && (!prompt.trim() || (!isSignedIn && anonymousLumiUsed)))
            }
            className="h-11 min-w-[136px] rounded-xl bg-fg text-white disabled:opacity-55"
          >
            {busy && mode === "lumi" ? (
              <BouncingMurmur text={thinkingPhrase} />
            ) : busy ? (
              labels.form.lumi_generating
            ) : (
              labels.form.save
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SidePanel({ labels }: { labels: LocalTripsLabels }) {
  return (
    <>
      <section className="rounded-[24px] border border-white/72 bg-white/80 p-5 shadow-[0_22px_64px_-48px_rgba(32,41,46,0.55)] backdrop-blur-xl">
        <PanelTitle title={labels.side.recommendations_title} action={labels.side.view_all} />
        <div className="mt-4 grid grid-cols-3 gap-4">
          {RECOMMENDATION_IMAGES.map((src, index) => (
            <article key={src} className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-accent-softer">
                <Image src={src} alt="" fill sizes="112px" className="object-cover" />
              </div>
              <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-5 text-fg">
                {index === 0
                  ? "Northern lights"
                  : index === 1
                    ? "Kyoto culture"
                    : "Gion festival"}
              </p>
              <p className="mt-1 text-[12px] text-fg-muted">3 - 4 mo.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/72 bg-white/80 p-5 shadow-[0_22px_64px_-48px_rgba(32,41,46,0.55)] backdrop-blur-xl">
        <PanelTitle title={labels.side.articles_title} action={labels.side.view_all} />
        <div className="mt-4 space-y-4">
          {[
            ["/illustrations/cities/kyoto.jpg", "Ten cities worth building a first route around", "Destinations"],
            ["/illustrations/cities/new-york.jpg", "How to keep a flexible budget before tickets lock", "Budget"],
            ["/illustrations/cities/singapore.jpg", "What to prepare before a dense city trip", "Checklist"],
          ].map(([src, title, tag]) => (
            <article key={title} className="flex gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-accent-softer">
                <Image src={src} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[14px] font-semibold leading-5 text-fg">
                  {title}
                </p>
                <p className="mt-1 text-[12px] text-fg-muted">
                  {tag} · 5 {labels.side.read_time}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/72 bg-white/80 p-5 shadow-[0_22px_64px_-48px_rgba(32,41,46,0.55)] backdrop-blur-xl">
        <PanelTitle title={labels.side.weather_title} action={labels.side.weather_link} />
        <div className="mt-4 flex items-center gap-4">
          <CloudSun className="h-12 w-12 text-accent" />
          <div>
            <p className="text-[28px] font-semibold tracking-[-0.02em]">18°C</p>
            <p className="text-[13px] text-fg-muted">Mostly clear · 11°C / 22°C</p>
          </div>
        </div>
      </section>
    </>
  );
}

function PanelTitle({ title, action }: { title: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-fg">
        {title}
      </h2>
      <button type="button" className="text-[13px] font-semibold text-accent">
        {action}
      </button>
    </div>
  );
}

function EmptyState({
  labels,
  onCreate,
}: {
  labels: LocalTripsLabels;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[22px] border border-dashed border-divider-strong bg-white/70 px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Compass className="h-7 w-7" />
      </span>
      <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">
        {labels.empty.title}
      </h2>
      <p className="mt-2 max-w-[420px] text-[14px] leading-6 text-fg-muted">
        {labels.empty.body}
      </p>
      <Button
        type="button"
        onClick={onCreate}
        className="mt-5 h-11 rounded-xl bg-accent px-5 text-white"
      >
        <Plus className="h-4 w-4" />
        {labels.empty.cta}
      </Button>
    </div>
  );
}

function TripSkeleton() {
  return (
    <div className="h-[190px] animate-pulse rounded-[22px] border border-divider bg-white/70" />
  );
}

function AvatarStack() {
  return (
    <div className="flex -space-x-2">
      {[0, 1, 2].map((item) => (
        <span
          key={item}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[11px] font-semibold text-white",
            item === 0 && "bg-[#2c7188]",
            item === 1 && "bg-[#c37f61]",
            item === 2 && "bg-[#3a8f78]",
          )}
        >
          <Users className="h-3.5 w-3.5" />
        </span>
      ))}
    </div>
  );
}

function ProgressRing({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("grid h-14 w-14 place-items-center rounded-full", className)}
      style={{
        background: `conic-gradient(currentColor ${safeValue * 3.6}deg, rgba(31,41,55,0.08) 0deg)`,
      }}
    >
      <div className="h-10 w-10 rounded-full bg-white" />
    </div>
  );
}

function readLocalDraft(): LocalTripDraft | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_TRIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalTripDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.title || !parsed.destination) return null;
    return {
      id: parsed.id,
      title: parsed.title,
      destination: parsed.destination,
      location: parsed.location ?? null,
      startDate: parsed.startDate || new Date().toISOString().slice(0, 10),
      endDate: parsed.endDate || parsed.startDate || new Date().toISOString().slice(0, 10),
      cover: parsed.cover || coverForDestination(parsed.destination),
      progress: typeof parsed.progress === "number" ? parsed.progress : 30,
      sourcePrompt: parsed.sourcePrompt,
      lumiDraft: parsed.lumiDraft ?? null,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      syncedTripId: parsed.syncedTripId,
      syncState: parsed.syncState === "synced" ? "synced" : "local",
    };
  } catch {
    return null;
  }
}

function persistDraft(draft: LocalTripDraft) {
  window.localStorage.setItem(LOCAL_TRIP_KEY, JSON.stringify(draft));
}

async function syncDraft(draft: LocalTripDraft): Promise<string> {
  const storedLumiDraft = draft.lumiDraft;
  const lumiPayload = storedLumiDraft
    ? {
        title: storedLumiDraft.title,
        start_date: storedLumiDraft.start_date,
        end_date:
          storedLumiDraft.end_date < storedLumiDraft.start_date
            ? storedLumiDraft.start_date
            : storedLumiDraft.end_date,
        days: storedLumiDraft.days,
        checklist: (storedLumiDraft.checklist ?? []).map((item) => ({
          text: item.text,
          description: item.description ?? null,
          kind: item.kind,
          start_date: item.start_date ?? null,
          phase: item.phase ?? null,
          group_label: item.group_label ?? null,
          subtasks: item.subtasks ?? [],
          shortcut: item.kind === "esim" ? "shop" : null,
          shop_filter: item.shop_filter ?? null,
          done: false,
          suggested: item.suggested ?? true,
          suggested_by: item.suggested === false ? undefined : "Lumi",
          due_date: item.start_date ?? storedLumiDraft.start_date,
        })),
      }
    : null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  const response = await fetch("/api/trips", {
    method: "POST",
    signal: controller.signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: lumiPayload?.title ?? draft.title,
      cover: null,
      start_date: lumiPayload?.start_date ?? draft.startDate,
      end_date:
        lumiPayload?.end_date ??
        (draft.endDate < draft.startDate ? draft.startDate : draft.endDate),
      status: "upcoming",
      metadata: {
        draft: true,
        source: draft.lumiDraft ? "local_storage_lumi" : "local_storage",
        local_draft_id: draft.id,
        location: draft.location ?? null,
        source_prompt: draft.sourcePrompt ?? null,
      },
      days: lumiPayload?.days ?? [
        {
          day_date: draft.startDate,
          city: draft.destination,
          note: "",
        },
      ],
      checklist: lumiPayload?.checklist ?? [
        {
          text: "Confirm eSIM coverage",
          kind: "esim",
          phase: "before_trip",
          group_label: "Connectivity",
          suggested: true,
          suggested_by: "Roam",
          due_date: draft.startDate,
        },
      ],
    }),
  }).finally(() => window.clearTimeout(timeout));
  if (!response.ok) throw new Error(`sync failed: ${response.status}`);
  const payload = (await response.json()) as { trip?: { id?: string } };
  if (!payload.trip?.id) throw new Error("missing trip id");
  return payload.trip.id;
}

async function requestLumiDraft(
  prompt: string,
  { isSignedIn }: { isSignedIn: boolean },
): Promise<LocalLumiDraft | null> {
  try {
    const response = await fetch(
      isSignedIn ? "/api/lumi/chat" : "/api/lumi/public-trip-draft",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          ...(isSignedIn ? { history: [] } : {}),
          context: {
            current_date: new Date().toISOString().slice(0, 10),
          },
        }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      trip_draft?: LocalLumiDraft | null;
    };
    if (!isSignedIn && payload.trip_draft) {
      window.localStorage.setItem(ANONYMOUS_LUMI_TRIP_USED_KEY, "true");
    }
    return payload.trip_draft ?? null;
  } catch {
    return null;
  }
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

function draftInputFromPrompt({
  prompt,
  lumiDraft,
  lang,
}: {
  prompt: string;
  lumiDraft: LocalLumiDraft | null;
  lang: string;
}) {
  if (lumiDraft) {
    const destination = destinationFromLumiDraft(lumiDraft);
    return {
      title: lumiDraft.title,
      destination,
      location: findLocationByText(destination, lang),
      startDate: lumiDraft.start_date,
      endDate: lumiDraft.end_date,
      sourcePrompt: prompt,
      lumiDraft,
      progress: 60,
    };
  }

  const inferredLocation = findLocationByText(prompt, lang);
  const startDate = addDays(new Date(), 30);
  const endDate = addDays(new Date(), 34);
  return {
    title: titleFromPrompt(prompt),
    destination: inferredLocation?.label ?? prompt.slice(0, 32),
    location: inferredLocation,
    startDate,
    endDate,
    sourcePrompt: prompt,
    lumiDraft: null,
    progress: 15,
  };
}

function destinationFromLumiDraft(draft: LocalLumiDraft): string {
  const cities = Array.from(
    new Set(draft.days.map((day) => day.city.trim()).filter(Boolean)),
  );
  return cities.slice(0, 3).join(" · ") || draft.title;
}

function titleFromPrompt(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  return cleaned.length > 34 ? `${cleaned.slice(0, 34)}...` : cleaned;
}

function addDays(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function coverForDestination(destination: string): string {
  return (
    COVER_BY_DESTINATION.find((item) => item.match.test(destination))?.src ??
    "/illustrations/cities/paris.jpg"
  );
}

function tripDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diff = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(diff / 86_400_000) + 1;
}

function syncText(syncState: SyncState, labels: LocalTripsLabels): string {
  if (syncState === "syncing") return labels.sync.syncing;
  if (syncState === "error") return labels.sync.error;
  return labels.sync.synced;
}

function firstTripCreationMurmur(labels: LocalTripsLabels["form"]): string {
  const phrases = labels.lumi_thinking_phrases.length
    ? labels.lumi_thinking_phrases
    : [labels.lumi_generating];
  return phrases[Math.floor(Math.random() * phrases.length)] ?? labels.lumi_generating;
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
