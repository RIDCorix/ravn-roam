"use client";

// Lumi journey studio (V2 planning flow). The server enforces the step
// order — frame (window + cities) → anchors (highlights) → days (one city
// block at a time) — while Lumi authors every conclusion and every
// traveler-facing question. The studio renders a different canvas per step
// on a real world map: pins paint in as the frame settles, the camera flies
// into each city while its days are planned, then pulls back to the full
// route.

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ListChecks,
  MapPinned,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";

import {
  getLumiAvatar,
  LumiAvatarChip,
} from "@/components/storefront/lumi-avatar";
import { appEase, MotionButton, softSpring } from "@/components/storefront/motion";
import {
  createTripFromDraft,
  type TripDraft,
} from "@/components/storefront/trips/lumi-assistant";
import type { JourneyMapCity } from "@/components/storefront/trips/journey-stage-map";
import { cn } from "@/lib/utils";

const JourneyStageMapDyn = dynamic(
  () =>
    import("@/components/storefront/trips/journey-stage-map").then(
      (mod) => mod.JourneyStageMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#dff4f2,#efe7d9)]" />
    ),
  },
);

// ── Wire types (mirror services/api/src/lumi/journey.ts) ───────────────

export type JourneyStepId = "frame" | "anchors" | "days";

export interface JourneyQA {
  step: JourneyStepId;
  question: string;
  answer: string;
}

export interface JourneyCityStay {
  name: string;
  country_code?: string | null;
  nights: number;
  reason?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface JourneyFrame {
  title: string;
  origin?: string | null;
  start_date: string;
  end_date: string;
  cities: JourneyCityStay[];
}

export interface JourneyAnchorItem {
  name: string;
  place_name: string;
  kind?: string;
  note?: string;
}

export interface JourneyCityAnchors {
  city: string;
  anchors: JourneyAnchorItem[];
}

export interface JourneyDay {
  day_date: string;
  city: string;
  cities?: string[];
  note: string;
  stops?: {
    name: string;
    kind?: string;
    note?: string;
    arrival_time?: string | null;
  }[];
}

export interface JourneyStepPayload {
  prompt: string;
  current_date: string;
  qa: JourneyQA[];
  frame: JourneyFrame | null;
  anchors: JourneyCityAnchors[] | null;
  days: JourneyDay[];
}

export type JourneyStepResponse =
  | { step: JourneyStepId; status: "question"; question: { text: string; options: string[] } }
  | { step: "frame"; status: "complete"; frame: JourneyFrame }
  | { step: "anchors"; status: "complete"; anchors: JourneyCityAnchors[] }
  | {
      step: "days";
      status: "complete";
      days: JourneyDay[];
      block_city: string;
      finished: boolean;
      trip_draft: TripDraft | null;
    };

export type JourneyStepFetcher = (
  payload: JourneyStepPayload,
) => Promise<JourneyStepResponse>;

export interface JourneyStudioLabels {
  title: string;
  subtitle: string;
  prompt_placeholder: string;
  start: string;
  prompt_label: string;
  steps: Record<JourneyStepId, string>;
  working: string;
  pending: string;
  speech: {
    frame: string;
    anchors: string;
    days: string;
    question: string;
    ready: string;
    creating: string;
    created: string;
    failed: string;
  };
  question_hint: string;
  answer_placeholder: string;
  send: string;
  anchors_title: string;
  days_title: string;
  nights_unit: string;
  days_unit: string;
  create: string;
  creating: string;
  created: string;
  open_trip: string;
  retry: string;
  failed_title: string;
}

type StudioPhase =
  | "intro"
  | "running"
  | "question"
  | "ready"
  | "creating"
  | "created"
  | "failed";

interface StudioQuestion {
  step: JourneyStepId;
  text: string;
  options: string[];
}

async function defaultStepFetcher(
  payload: JourneyStepPayload,
): Promise<JourneyStepResponse> {
  const res = await fetch("/api/lumi/journey/step", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => null)) as
    | (JourneyStepResponse & { error?: string; message?: string })
    | null;
  if (!res.ok || !data || "error" in (data ?? {})) {
    throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  }
  return data;
}

/* Client copy of the server's block planner, used only to aim the camera
   at the city Lumi is about to plan. */
function nextBlock(
  frame: JourneyFrame,
  days: JourneyDay[],
): { city: string } | null {
  const dates: string[] = [];
  const cursor = new Date(`${frame.start_date}T00:00:00.000Z`);
  const end = new Date(`${frame.end_date}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime() && dates.length <= 60) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const planned = new Set(days.map((day) => day.day_date));
  let index = 0;
  for (const [cityIndex, city] of frame.cities.entries()) {
    const isLast = cityIndex === frame.cities.length - 1;
    const span = isLast
      ? dates.length - index
      : Math.max(
          1,
          Math.min(
            city.nights,
            dates.length - index - (frame.cities.length - 1 - cityIndex),
          ),
        );
    const blockDates = dates.slice(index, index + span);
    if (blockDates.some((date) => !planned.has(date))) {
      return { city: city.name };
    }
    index += span;
  }
  return null;
}

export function JourneyStudio({
  lang,
  labels,
  initialPrompt = "",
  stepFetcher = defaultStepFetcher,
  createTrip = createTripFromDraft,
}: {
  lang: string;
  labels: JourneyStudioLabels;
  initialPrompt?: string;
  stepFetcher?: JourneyStepFetcher;
  createTrip?: (draft: TripDraft) => Promise<string>;
}) {
  const [phase, setPhase] = useState<StudioPhase>("intro");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [question, setQuestion] = useState<StudioQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [frame, setFrame] = useState<JourneyFrame | null>(null);
  const [anchors, setAnchors] = useState<JourneyCityAnchors[] | null>(null);
  const [days, setDays] = useState<JourneyDay[]>([]);
  const [focusCity, setFocusCity] = useState<string | null>(null);
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runToken = useRef(0);
  const avatar = getLumiAvatar(undefined);

  const advance = useCallback(
    async (snapshot: {
      prompt: string;
      qa: JourneyQA[];
      frame: JourneyFrame | null;
      anchors: JourneyCityAnchors[] | null;
      days: JourneyDay[];
    }) => {
      const token = ++runToken.current;
      setPhase("running");
      setQuestion(null);
      setError(null);
      let { frame, anchors, days } = snapshot;
      const { prompt, qa } = snapshot;
      try {
        for (let guard = 0; guard < 24; guard++) {
          if (frame && anchors) {
            const block = nextBlock(frame, days);
            setFocusCity(block?.city ?? null);
          }
          const response = await stepFetcher({
            prompt,
            current_date: new Date().toISOString().slice(0, 10),
            qa,
            frame,
            anchors,
            days,
          });
          if (runToken.current !== token) return;
          if (response.status === "question") {
            setQuestion({
              step: response.step,
              text: response.question.text,
              options: response.question.options ?? [],
            });
            setFocusCity(null);
            setPhase("question");
            return;
          }
          if (response.step === "frame") {
            frame = response.frame;
            setFrame(frame);
            continue;
          }
          if (response.step === "anchors") {
            anchors = response.anchors;
            setAnchors(anchors);
            continue;
          }
          if (response.step === "days") {
            days = [...days, ...response.days].sort((a, b) =>
              a.day_date.localeCompare(b.day_date),
            );
            setDays(days);
            if (response.finished) {
              setFocusCity(null);
              setDraft(response.trip_draft ?? null);
              setPhase("ready");
              return;
            }
            continue;
          }
        }
        throw new Error("journey did not converge");
      } catch (err) {
        if (runToken.current !== token) return;
        setFocusCity(null);
        setError(err instanceof Error ? err.message : "journey_failed");
        setPhase("failed");
      }
    },
    [stepFetcher],
  );

  const [qa, setQa] = useState<JourneyQA[]>([]);

  const handleStart = useCallback(() => {
    const clean = prompt.trim();
    if (!clean) return;
    setFrame(null);
    setAnchors(null);
    setDays([]);
    setDraft(null);
    setQa([]);
    setCreatedTripId(null);
    void advance({ prompt: clean, qa: [], frame: null, anchors: null, days: [] });
  }, [advance, prompt]);

  const handleAnswer = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean || !question) return;
      const nextQa = [
        ...qa,
        { step: question.step, question: question.text, answer: clean },
      ];
      setQa(nextQa);
      setAnswer("");
      void advance({ prompt: prompt.trim(), qa: nextQa, frame, anchors, days });
    },
    [advance, anchors, days, frame, prompt, qa, question],
  );

  const handleRetry = useCallback(() => {
    void advance({ prompt: prompt.trim(), qa, frame, anchors, days });
  }, [advance, anchors, days, frame, prompt, qa]);

  const handleCreate = useCallback(async () => {
    if (!draft) return;
    setPhase("creating");
    try {
      const tripId = await createTrip(draft);
      setCreatedTripId(tripId);
      setPhase("created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "create_failed");
      setPhase("failed");
    }
  }, [createTrip, draft]);

  const isWorking = phase === "running" || phase === "creating";
  const mapCities: JourneyMapCity[] = useMemo(
    () =>
      (frame?.cities ?? []).flatMap((city, index) =>
        typeof city.lat === "number" && typeof city.lng === "number"
          ? [
              {
                name: city.name,
                lat: city.lat,
                lng: city.lng,
                nights: city.nights,
                order: index + 1,
              },
            ]
          : [],
      ),
    [frame],
  );
  const focus = useMemo(() => {
    if (!focusCity) return null;
    const city = mapCities.find((c) => c.name === focusCity);
    return city ? { name: city.name, lat: city.lat, lng: city.lng } : null;
  }, [focusCity, mapCities]);

  const speech =
    phase === "question"
      ? question?.text ?? labels.speech.question
      : phase === "ready"
        ? labels.speech.ready
        : phase === "creating"
          ? labels.speech.creating
          : phase === "created"
            ? labels.speech.created
            : phase === "failed"
              ? labels.speech.failed
              : !frame
                ? labels.speech.frame
                : !anchors
                  ? labels.speech.anchors
                  : labels.speech.days.replace("{city}", focusCity ?? "");

  const stepState = (step: JourneyStepId): "done" | "active" | "pending" => {
    if (step === "frame") {
      return frame ? "done" : phase === "intro" ? "pending" : "active";
    }
    if (step === "anchors") {
      return anchors ? "done" : frame ? "active" : "pending";
    }
    return draft || phase === "ready" || phase === "created" || phase === "creating"
      ? "done"
      : anchors
        ? "active"
        : "pending";
  };

  const stepSummary = (step: JourneyStepId): string | null => {
    if (step === "frame" && frame) {
      return `${frame.start_date.slice(5).replace("-", "/")} - ${frame.end_date.slice(5).replace("-", "/")} · ${frame.cities.map((city) => city.name).join("、")}`;
    }
    if (step === "anchors" && anchors) {
      return anchors
        .map((city) => `${city.city} ${city.anchors.length}`)
        .join(" · ");
    }
    if (step === "days" && days.length > 0) {
      return `${days.length} ${labels.days_unit}`;
    }
    return null;
  };

  const anchorCities = anchors ?? [];
  const createdHref = createdTripId ? `/${lang}/trips/${createdTripId}` : null;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[linear-gradient(180deg,var(--background)_0%,var(--surface)_100%)] px-4 pb-36 pt-6 text-fg sm:px-6">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/illustrations/lumi-drafting-background.png')] bg-cover bg-center" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--background) 90%, transparent) 0%, color-mix(in srgb, var(--background) 64%, transparent) 42%, color-mix(in srgb, var(--background) 48%, transparent) 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[960px]">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/76 px-3 py-1.5 text-[12px] font-semibold text-accent shadow-sm backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" />
          Lumi
        </div>

        {phase === "intro" ? (
          <div className="mt-6">
            <h1 className="max-w-[720px] text-[36px] font-semibold leading-[1.04] tracking-[-0.02em] [text-wrap:balance] sm:text-[48px]">
              {labels.title}
            </h1>
            <p className="mt-3 max-w-[600px] text-[15px] leading-7 text-fg-secondary">
              {labels.subtitle}
            </p>
            <div className="mt-6 max-w-[680px] rounded-[24px] border border-white/72 bg-white/85 p-3 shadow-[0_24px_70px_-52px_rgba(32,41,46,0.55)] backdrop-blur-xl">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={labels.prompt_placeholder}
                rows={3}
                className="w-full resize-none rounded-2xl border-0 bg-transparent px-3 py-2 text-[15px] leading-7 text-fg outline-none placeholder:text-fg-muted"
              />
              <div className="flex justify-end">
                <MotionButton
                  type="button"
                  onClick={handleStart}
                  disabled={!prompt.trim()}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white shadow-[0_18px_32px_-18px_rgba(15,184,180,0.85)]",
                    !prompt.trim() && "cursor-not-allowed opacity-50",
                  )}
                >
                  {labels.start}
                  <ArrowRight className="h-4 w-4" />
                </MotionButton>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-5 text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[32px]">
              {frame?.title ?? labels.title}
            </h1>
            <p
              className="mt-2 max-w-[680px] truncate text-[13px] leading-6 text-fg-muted"
              title={prompt}
            >
              <span className="font-semibold text-fg-secondary">
                {labels.prompt_label}
              </span>
              <span aria-hidden> · </span>
              {prompt}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {(["frame", "anchors", "days"] as const).map((step) => {
                const state = stepState(step);
                const summary = stepSummary(step);
                return (
                  <div
                    key={step}
                    className={cn(
                      "min-w-0 rounded-2xl border px-3.5 py-2.5 backdrop-blur transition-colors duration-500",
                      state === "done"
                        ? "border-accent/25 bg-white/82 shadow-sm"
                        : state === "active"
                          ? "border-accent/40 bg-white/72"
                          : "border-white/60 bg-white/52",
                    )}
                  >
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">
                      <span className="truncate">{labels.steps[step]}</span>
                      {state === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                      ) : state === "active" && isWorking ? (
                        <ThinkingDots />
                      ) : null}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-[12px]",
                        summary ? "font-medium text-fg-secondary" : "text-fg-muted",
                      )}
                    >
                      {summary ??
                        (state === "active" ? labels.working : labels.pending)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-start gap-3">
              <div className={cn("relative shrink-0", isWorking && "animate-pulse")}>
                <LumiAvatarChip avatar={avatar} size={48} active />
              </div>
              <motion.div
                key={speech}
                className="relative max-w-[620px] overflow-hidden rounded-[22px] rounded-tl-md bg-fg px-4 py-3 text-[14px] font-medium leading-6 text-white shadow-[0_18px_44px_-32px_rgba(32,41,46,0.9)]"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={softSpring}
              >
                {speech}
              </motion.div>
            </div>

            <div
              className={cn(
                "relative mt-5 aspect-[2/1] max-h-[440px] w-full overflow-hidden rounded-[32px] border border-white/72 bg-white/40 shadow-[0_32px_80px_-56px_rgba(32,41,46,0.6)] backdrop-blur-xl",
                phase === "question" && "min-h-[440px] sm:min-h-0",
              )}
            >
              <JourneyStageMapDyn
                cities={mapCities}
                focus={focus}
                drawRoute={days.length > 0 || phase === "ready" || phase === "created" || phase === "creating"}
              />
              <AnimatePresence>
                {phase === "question" && question ? (
                  <motion.div
                    key="question"
                    className="absolute inset-0 z-[500] flex items-center justify-center bg-[rgba(247,247,245,0.55)] p-4 backdrop-blur-[3px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: appEase }}
                  >
                    <motion.div
                      className="w-full max-w-[480px] rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_32px_80px_-40px_rgba(32,41,46,0.5)]"
                      initial={{ opacity: 0, y: 14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: appEase }}
                    >
                      <p className="text-[12px] font-semibold text-accent">
                        {labels.steps[question.step]}
                      </p>
                      <h2 className="mt-2 text-[20px] font-semibold leading-7 tracking-[-0.01em] text-fg [text-wrap:balance]">
                        {question.text}
                      </h2>
                      {question.options.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {question.options.map((option) => (
                            <MotionButton
                              key={option}
                              type="button"
                              onClick={() => handleAnswer(option)}
                              className="rounded-full border border-accent/30 bg-accent-softer px-4 py-2 text-[13px] font-semibold text-fg hover:border-accent/60"
                            >
                              {option}
                            </MotionButton>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-4 text-[12px] text-fg-muted">
                        {labels.question_hint}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                              event.preventDefault();
                              handleAnswer(answer);
                            }
                          }}
                          placeholder={labels.answer_placeholder}
                          className="h-11 min-w-0 flex-1 rounded-full border border-divider bg-white px-4 text-[14px] text-fg outline-none placeholder:text-fg-muted focus:border-accent/50"
                        />
                        <MotionButton
                          type="button"
                          aria-label={labels.send}
                          onClick={() => handleAnswer(answer)}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white"
                        >
                          <Send className="h-4 w-4" />
                        </MotionButton>
                      </div>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {anchorCities.length > 0 ? (
              <section className="mt-8">
                <div className="flex items-center gap-2">
                  <MapPinned className="h-4.5 w-4.5 text-accent" />
                  <h2 className="text-[18px] font-semibold tracking-[-0.01em]">
                    {labels.anchors_title}
                  </h2>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {anchorCities.map((city, index) => (
                    <motion.div
                      key={city.city}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...softSpring, delay: index * 0.08 }}
                      className="rounded-[24px] border border-white/70 bg-white/86 p-5 shadow-[0_18px_50px_-40px_rgba(32,41,46,0.6)] backdrop-blur"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="truncate text-[16px] font-semibold text-fg">
                          {city.city}
                        </h3>
                        {frame ? (
                          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                            {frame.cities.find((c) => c.name === city.city)?.nights ?? 0}{" "}
                            {labels.nights_unit}
                          </span>
                        ) : null}
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {city.anchors.map((anchor) => (
                          <li
                            key={anchor.name}
                            className="flex min-w-0 gap-2 text-[13px] leading-6"
                          >
                            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-fg">{anchor.name}</span>
                              {anchor.note ? (
                                <span className="text-fg-muted">（{anchor.note}）</span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>
              </section>
            ) : null}

            {days.length > 0 ? (
              <section className="mt-8">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4.5 w-4.5 text-accent" />
                    <h2 className="text-[18px] font-semibold tracking-[-0.01em]">
                      {labels.days_title}
                    </h2>
                  </div>
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent">
                    {days.length} {labels.days_unit}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {days.map((day, index) => (
                    <motion.article
                      key={day.day_date}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={softSpring}
                      className="rounded-[24px] border border-white/70 bg-white/86 p-5 shadow-[0_18px_50px_-40px_rgba(32,41,46,0.6)] backdrop-blur"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[12px] font-semibold text-accent">
                          Day {index + 1}
                        </p>
                        <p className="font-mono text-[11.5px] text-fg-muted">
                          {day.day_date}
                        </p>
                      </div>
                      <h3 className="mt-1 truncate text-[17px] font-semibold tracking-[-0.01em] text-fg">
                        {day.city}
                      </h3>
                      {day.note ? (
                        <p className="mt-0.5 line-clamp-1 text-[13px] leading-6 text-fg-secondary">
                          {day.note}
                        </p>
                      ) : null}
                      {day.stops?.length ? (
                        <ul className="mt-3 space-y-1.5">
                          {day.stops.slice(0, 4).map((stop) => (
                            <li
                              key={`${day.day_date}-${stop.name}`}
                              className="flex min-w-0 gap-2 text-[13px] leading-6"
                            >
                              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                              <span className="min-w-0 truncate">
                                <span className="font-medium text-fg">{stop.name}</span>
                                {stop.note ? (
                                  <span className="text-fg-muted">（{stop.note}）</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                          {day.stops.length > 4 ? (
                            <li className="pl-3.5 text-[12px] font-semibold text-accent">
                              +{day.stops.length - 4}
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </motion.article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      {phase !== "intro" ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[600] flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-[600px] items-center gap-3 rounded-full border border-white/10 bg-fg/92 py-2 pl-5 pr-2 text-white shadow-[0_28px_64px_-28px_rgba(17,17,32,0.6)] backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">
                {phase === "failed"
                  ? labels.failed_title
                  : phase === "question"
                    ? labels.steps[question?.step ?? "frame"]
                    : draft
                      ? labels.speech.ready
                      : labels.working}
              </p>
              <p className="truncate text-[11.5px] text-white/65">
                {phase === "failed"
                  ? error ?? labels.speech.failed
                  : draft
                    ? `${draft.title} · ${draft.start_date} - ${draft.end_date}`
                    : speech}
              </p>
            </div>
            {isWorking ? <ThinkingDots /> : null}
            {phase === "failed" ? (
              <MotionButton
                type="button"
                onClick={handleRetry}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-fg"
              >
                <RefreshCw className="h-4 w-4" />
                {labels.retry}
              </MotionButton>
            ) : createdHref ? (
              <Link
                href={createdHref}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white"
              >
                {labels.open_trip}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <MotionButton
                type="button"
                onClick={() => void handleCreate()}
                disabled={!draft || phase === "creating"}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white shadow-[0_18px_32px_-18px_rgba(15,184,180,0.85)]",
                  (!draft || phase === "creating") && "cursor-not-allowed opacity-55",
                )}
              >
                {phase === "creating" ? labels.creating : labels.create}
              </MotionButton>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
          style={{ animationDelay: `${dot * 170}ms`, animationDuration: "1.1s" }}
        />
      ))}
    </span>
  );
}
