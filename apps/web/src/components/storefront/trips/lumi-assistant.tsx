"use client";

// Lumi floating assistant. Rendered once at the storefront layout level
// so it's available on every storefront tab in the same position. The
// component:
//   * detects the current trip from the URL (matches /:lang/trips/:uuid)
//     and uses it as the conversation's trip_id
//   * persists every turn to Postgres via POST /api/trips/:id/lumi
//   * shows past conversations in a switchable list (filtered to the
//     active trip when on a trip page, or showing everything otherwise)
//   * refreshes the current route after a successful edit so the trip
//     page reflects the new days/cities Lumi just wrote

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Send,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import {
  getLumiAvatar,
  LumiAvatarChip,
} from "@/components/storefront/lumi-avatar";
import { MotionButton, popIn } from "@/components/storefront/motion";
import type { LumiContext } from "@/lib/lumi-context";
import { markDaysUnread } from "@/lib/lumi-unread";
import { buildShopHref } from "@/lib/shop-link";
import { refreshTrip } from "@/lib/trip-cache";
import { cn } from "@/lib/utils";

export interface LumiAssistantLabels {
  name: string;
  placeholder: string;
  open: string;
  close: string;
  send: string;
  thinking: string;
  thinking_phrases: string[];
  no_trip_hint: string;
  history_title: string;
  new_chat: string;
  delete_chat: string;
  empty_history: string;
  draft_days_unit: string;
  draft_create: string;
  draft_creating: string;
  draft_created: string;
  change_days: string;
  change_stops: string;
  change_companions: string;
  change_checklist: string;
  change_draft_days: string;
}

interface ChangeSummary {
  days?: number;
  stops?: number;
  companions?: number;
  checklist?: number;
  draftDays?: number;
}

interface TripDraftStop {
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
}

interface TripDraft {
  title: string;
  start_date: string;
  end_date: string;
  cover?: string | null;
  days: {
    day_date: string;
    city: string;
    note: string;
    /* Lumi may emit a per-day stops list (Wanderlog-style). Optional for
       backwards compat with older drafter outputs that only set `city`. */
    stops?: TripDraftStop[];
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
}

interface EsimSuggestionPlan {
  country: string;
  days?: number | null;
  gb?: number | null;
  label?: string | null;
}
interface EsimSuggestion {
  plans: EsimSuggestionPlan[];
  rationale?: string | null;
}

interface Message {
  id: string;
  role: "user" | "lumi";
  content: string;
  pending?: boolean;
  trip_draft?: TripDraft;
  trip_draft_created_id?: string | null;
  changes?: ChangeSummary;
  esim_suggestion?: EsimSuggestion;
}

interface Conversation {
  id: string;
  trip_id: string | null;
  title: string;
  updated_at: string;
}

export interface LumiTurn {
  role: "user" | "assistant";
  content: string;
}

const TRIP_PATH = /^\/(?:en|zh-TW)\/trips\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/;

export function LumiAssistant({
  labels,
  avatarId,
}: {
  labels: LumiAssistantLabels;
  avatarId?: string;
}) {
  const pathname = usePathname();
  const tripId = pathname?.match(TRIP_PATH)?.[1] ?? null;
  const lang = pathname?.match(/^\/(en|zh-TW)(?:\/|$)/)?.[1] ?? "zh-TW";

  const avatar = getLumiAvatar(avatarId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [view, setView] = useState<"messages" | "history">("messages");
  const [expanded, setExpanded] = useState(false);
  // Collapsed by default: only the circular avatar shows. Tapping the
  // avatar opens the input pill.
  const [inputOpen, setInputOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(labels.thinking);
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { data: context } = useSWR<LumiContext | null>(
    "lumi-context",
    fetchLumiContext,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );

  // Reset chat state when the user navigates to a different trip / leaves trip view.
  const lastTripRef = useRef<string | null>(tripId);
  useEffect(() => {
    if (lastTripRef.current !== tripId) {
      lastTripRef.current = tripId;
      setMessages([]);
      setActiveConversationId(null);
      setView("messages");
    }
  }, [tripId]);

  // Auto-scroll to the latest message when the panel is open.
  useEffect(() => {
    if (!expanded || view !== "messages") return;
    const t = window.setTimeout(() => {
      if (scrollerRef.current) {
        scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      }
    }, 30);
    return () => window.clearTimeout(t);
  }, [expanded, view, messages]);

  /* Cycle through playful "thinking" phrases while a request is in
     flight. Each phrase is shown in full and its characters bob up and
     down in a staggered wave (rendered in Bubble). Cycling index-wise
     (not random) avoids the same phrase repeating back-to-back. */
  useEffect(() => {
    if (!busy) return;
    const phrases = labels.thinking_phrases?.length
      ? labels.thinking_phrases
      : [labels.thinking];
    let i = Math.floor(Math.random() * phrases.length);
    const interval = window.setInterval(() => {
      i = (i + 1) % phrases.length;
      setThinkingPhrase(phrases[i] ?? labels.thinking);
    }, 2800);
    return () => window.clearInterval(interval);
  }, [busy, labels.thinking, labels.thinking_phrases]);

  async function loadConversations() {
    const params = tripId ? `?trip_id=${tripId}` : "";
    const res = await fetch(`/api/lumi/conversations${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as { conversations: Conversation[] };
    setConversations(data.conversations);
  }

  async function openConversation(id: string) {
    setView("messages");
    setActiveConversationId(id);
    const res = await fetch(`/api/lumi/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: { id: string; role: "user" | "assistant"; content: string }[];
    };
    setMessages(
      data.messages.map((m) => ({
        id: m.id,
        role: m.role === "user" ? "user" : "lumi",
        content: m.content,
      })),
    );
  }

  function startNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setView("messages");
    inputRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    const res = await fetch(`/api/lumi/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) startNewChat();
  }

  async function handleSend() {
    const prompt = value.trim();
    if (!prompt || busy) return;

    const history: LumiTurn[] = messages
      .filter((m) => !m.pending)
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

    const userMsgId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pendingId = `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: prompt },
      /* `content` here is a fallback for when rotation isn't running
         (e.g. busy=false race). The live phrase is injected by Bubble. */
      { id: pendingId, role: "lumi", content: labels.thinking, pending: true },
    ]);
    setValue("");
    setThinkingPhrase(firstThinkingPhrase(labels));
    setBusy(true);
    setExpanded(true);
    setInputOpen(true);
    setView("messages");

    try {
      const res = await fetch(`/api/lumi/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          history,
          // Both fields are optional on the API; only include when set so
          // the zod `.uuid().optional()` accepts the payload.
          ...(activeConversationId ? { conversation_id: activeConversationId } : {}),
          ...(tripId ? { current_trip_id: tripId } : {}),
          context: context ?? undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        summary?: string;
        days?: unknown;
        cities?: unknown;
        companions?: unknown;
        trip_draft?: TripDraft | null;
        esim_suggestion?: EsimSuggestion | null;
        conversation_id?: string;
        message?: string;
        error?: string;
      };
      const text =
        payload.summary ??
        payload.message ??
        payload.error ??
        (res.ok ? "✓" : `Lumi 失敗 (HTTP ${res.status})`);
      const changes = res.ok ? summarizeChanges(payload) : undefined;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: text,
                pending: false,
                trip_draft: payload.trip_draft ?? undefined,
                esim_suggestion: payload.esim_suggestion ?? undefined,
                changes,
              }
            : m,
        ),
      );
      if (payload.conversation_id) {
        setActiveConversationId(payload.conversation_id);
      }
      if (res.ok && (payload.days || payload.companions)) {
        /* Lumi just changed the active trip's itinerary. Mark every
           returned day as "unread" so the Day<n> tab shows a yellow
           dot until the user looks. */
        if (tripId && Array.isArray(payload.days)) {
          markDaysUnread(
            tripId,
            (payload.days as unknown[]).map((_, i) => i),
          );
        }
        /* SPA-style update: revalidate just the SWR entry for this
           trip. The trip page subscribes via `useTripDetail` and will
           re-render with the new days/companions/cities — no RSC
           re-render, no full-page refresh. */
        if (tripId) void refreshTrip(tripId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, content: msg, pending: false } : m,
        ),
      );
    } finally {
      setBusy(false);
      setThinkingPhrase(labels.thinking);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (
        composingRef.current ||
        e.nativeEvent.isComposing ||
        e.keyCode === 229
      ) {
        return;
      }
      e.preventDefault();
      void handleSend();
    }
  }

  const panelOpen = expanded;
  const showMessages = panelOpen && view === "messages" && messages.length > 0;
  const showHistory = panelOpen && view === "history";

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-[calc(8.25rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-2 md:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
    >
      <AnimatePresence>
        {(showMessages || showHistory) && (
        <motion.div
          className="pointer-events-auto w-[min(86vw,360px)] overflow-hidden rounded-2xl border border-divider bg-white/95 shadow-xl backdrop-blur"
          {...popIn}
        >
          <div className="flex items-center justify-between gap-2 border-b border-divider px-3.5 py-2">
            <MotionButton
              type="button"
              onClick={() =>
                setView((v) => (v === "history" ? "messages" : "history"))
              }
              onMouseDown={(e) => {
                // Pre-fetch conversations the instant the user reaches for
                // the toggle so the list renders without a flicker.
                if (view !== "history") void loadConversations();
                e.stopPropagation();
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <LumiAvatarChip avatar={avatar} size={22} />
              <span className="truncate text-[12px] font-semibold tracking-tight text-fg">
                {view === "history" ? labels.history_title : labels.name}
              </span>
            </MotionButton>
            <MotionButton
              type="button"
              onClick={startNewChat}
              aria-label={labels.new_chat}
              title={labels.new_chat}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-fg-muted hover:bg-[rgba(0,0,0,0.04)]"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </MotionButton>
            <MotionButton
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={labels.close}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-fg-muted hover:bg-[rgba(0,0,0,0.04)]"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </MotionButton>
          </div>

          {showHistory ? (
            <div className="max-h-[55vh] overflow-y-auto px-2 py-2">
              {conversations.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-fg-muted">
                  {labels.empty_history}
                </div>
              ) : (
                <ul className="flex flex-col">
                  {conversations.map((c) => {
                    const active = c.id === activeConversationId;
                    return (
                      <li key={c.id} className="flex items-stretch">
                        <MotionButton
                          type="button"
                          onClick={() => void openConversation(c.id)}
                          className={cn(
                            "flex min-w-0 flex-1 flex-col gap-0.5 rounded-l-xl px-3 py-2 text-left text-[12.5px] transition-colors",
                            active
                              ? "bg-accent-soft text-fg"
                              : "text-fg hover:bg-[rgba(0,0,0,0.03)]",
                          )}
                        >
                          <span className="line-clamp-1">{c.title}</span>
                          <span className="text-[10.5px] text-fg-muted">
                            {new Date(c.updated_at).toLocaleString()}
                          </span>
                        </MotionButton>
                        <MotionButton
                          type="button"
                          onClick={() => void deleteConversation(c.id)}
                          aria-label={labels.delete_chat}
                          className="inline-flex w-8 shrink-0 items-center justify-center rounded-r-xl text-fg-muted hover:bg-[rgba(0,0,0,0.04)] hover:text-[#b91c1c]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </MotionButton>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div
              ref={scrollerRef}
              className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto px-3.5 py-3"
            >
              {messages.map((m) => (
                <Bubble
                  key={m.id}
                  message={m}
                  labels={labels}
                  lang={lang}
                  pendingPhrase={thinkingPhrase}
                  onCreated={(messageId, newTripId) => {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === messageId
                          ? { ...msg, trip_draft_created_id: newTripId }
                          : msg,
                      ),
                    );
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        className={cn(
          "pointer-events-auto flex items-center overflow-hidden rounded-full bg-white/95 shadow-lg backdrop-blur transition-[width,border-color,padding] duration-300 ease-out",
          inputOpen
            ? "w-[min(86vw,360px)] gap-2 border border-divider pl-2 pr-1.5"
            : "w-12 gap-0 border border-transparent p-0",
        )}
        style={{ height: 48 }}
      >
        <MotionButton
          type="button"
          onClick={() => {
            if (inputOpen) {
              setInputOpen(false);
              setExpanded(false);
            } else {
              setInputOpen(true);
              window.setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          aria-label={inputOpen ? labels.close : labels.open}
          className={cn(
            "shrink-0 rounded-full transition-transform duration-500 ease-out",
            inputOpen ? "rotate-[360deg]" : "rotate-0",
          )}
        >
          <LumiAvatarChip avatar={avatar} size={inputOpen ? 36 : 44} />
        </MotionButton>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          disabled={busy || !inputOpen}
          tabIndex={inputOpen ? 0 : -1}
          placeholder={busy ? thinkingPhrase : labels.placeholder}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-muted disabled:opacity-60 transition-opacity duration-200",
            inputOpen ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        />
        <MotionButton
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded && view === "history") void loadConversations();
          }}
          aria-label={expanded ? labels.close : labels.open}
          aria-expanded={expanded}
          tabIndex={inputOpen ? 0 : -1}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)]",
            inputOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </MotionButton>
        <MotionButton
          type="button"
          onClick={() => void handleSend()}
          disabled={busy || value.trim().length === 0 || !inputOpen}
          tabIndex={inputOpen ? 0 : -1}
          aria-label={labels.send}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200",
            "bg-gradient-to-br from-accent to-[#0a8e8a]",
            (busy || value.trim().length === 0) && "opacity-40",
            !inputOpen && "pointer-events-none opacity-0",
          )}
        >
          <Send className="h-3.5 w-3.5" />
        </MotionButton>
      </motion.div>
    </div>
  );
}

function firstThinkingPhrase(labels: LumiAssistantLabels): string {
  const phrases = labels.thinking_phrases?.length
    ? labels.thinking_phrases
    : [labels.thinking];
  return phrases[Math.floor(Math.random() * phrases.length)] ?? labels.thinking;
}

async function fetchLumiContext(): Promise<LumiContext | null> {
  const res = await fetch("/api/lumi/context", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { context?: LumiContext | null };
  return data.context ?? null;
}

function Bubble({
  message,
  labels,
  lang,
  pendingPhrase,
  onCreated,
}: {
  message: Message;
  labels: LumiAssistantLabels;
  lang: string;
  pendingPhrase: string;
  onCreated: (messageId: string, tripId: string) => void;
}) {
  const isUser = message.role === "user";
  const isPending = !isUser && !!message.pending;
  return (
    <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug",
          isUser
            ? "rounded-br-md bg-accent text-white"
            : "rounded-bl-md bg-[rgba(0,0,0,0.05)] text-fg",
        )}
      >
        {isPending ? (
          <BouncingText text={pendingPhrase} />
        ) : (
          message.content
        )}
      </div>
      {!isUser && message.changes && (
        <ChangeBadges changes={message.changes} labels={labels} />
      )}
      {!isUser && message.trip_draft && (
        <TripDraftCard
          messageId={message.id}
          draft={message.trip_draft}
          createdTripId={message.trip_draft_created_id ?? null}
          labels={labels}
          lang={lang}
          onCreated={onCreated}
        />
      )}
      {!isUser && message.esim_suggestion && (
        <EsimSuggestionCard
          suggestion={message.esim_suggestion}
          lang={lang}
        />
      )}
    </div>
  );
}

function EsimSuggestionCard({
  suggestion,
  lang,
}: {
  suggestion: EsimSuggestion;
  lang: string;
}) {
  const plans = suggestion.plans ?? [];
  if (plans.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {suggestion.rationale ? (
        <div className="text-[11px] text-fg-muted leading-snug">
          {suggestion.rationale}
        </div>
      ) : null}
      {plans.map((p, i) => (
        <EsimSuggestionLink key={i} plan={p} lang={lang} />
      ))}
    </div>
  );
}

function EsimSuggestionLink({
  plan,
  lang,
}: {
  plan: EsimSuggestionPlan;
  lang: string;
}) {
  const days = plan.days ?? undefined;
  const gb = plan.gb ?? undefined;
  const href = buildShopHref(lang, {
    country: plan.country,
    days,
    gb,
  });
  const label =
    plan.label ??
    `${plan.country}${days ? ` · ${days} 天` : ""}${
      gb ? ` · ${gb} GB` : ""
    }`;
  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-between gap-2 rounded-xl bg-accent-softer px-3 py-2.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent-soft"
    >
      <span className="flex items-center gap-2">
        <ShoppingBag className="h-4 w-4" />
        {label}
      </span>
      <span className="inline-flex items-center gap-0.5 text-[12px]">
        去買
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

function ChangeBadges({
  changes,
  labels,
}: {
  changes: ChangeSummary;
  labels: LumiAssistantLabels;
}) {
  const entries: { key: string; text: string }[] = [];
  const tpl = (template: string, n: number) =>
    template.replace("{n}", String(n));
  if (changes.draftDays != null) {
    entries.push({
      key: "draft",
      text: tpl(labels.change_draft_days, changes.draftDays),
    });
  }
  if (changes.days != null) {
    entries.push({ key: "days", text: tpl(labels.change_days, changes.days) });
  }
  if (changes.stops != null) {
    entries.push({ key: "stops", text: tpl(labels.change_stops, changes.stops) });
  }
  if (changes.companions != null) {
    entries.push({
      key: "comp",
      text: tpl(labels.change_companions, changes.companions),
    });
  }
  if (changes.checklist != null) {
    entries.push({
      key: "list",
      text: tpl(labels.change_checklist, changes.checklist),
    });
  }
  if (entries.length === 0) return null;
  return (
    <div className="flex max-w-[85%] flex-wrap gap-1">
      {entries.map((e) => (
        <span
          key={e.key}
          className="inline-flex items-center rounded-full bg-[rgba(15,184,180,0.10)] px-2 py-[2px] text-[10.5px] font-medium text-accent"
        >
          {e.text}
        </span>
      ))}
    </div>
  );
}

function summarizeChanges(payload: {
  days?: unknown;
  companions?: unknown;
  trip_draft?: TripDraft | null;
}): ChangeSummary | undefined {
  const out: ChangeSummary = {};
  if (Array.isArray(payload.days)) {
    out.days = payload.days.length;
    let stops = 0;
    for (const d of payload.days as Array<{ stops?: unknown }>) {
      if (Array.isArray(d?.stops)) stops += d.stops.length;
    }
    if (stops > 0) out.stops = stops;
  }
  if (Array.isArray(payload.companions)) {
    out.companions = payload.companions.length;
  }
  if (payload.trip_draft && Array.isArray(payload.trip_draft.days)) {
    out.draftDays = payload.trip_draft.days.length;
    const checklistLen = payload.trip_draft.checklist?.length ?? 0;
    if (checklistLen > 0) out.checklist = checklistLen;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/* Each character bobs up and down with a staggered delay so the whole
   phrase reads as a wave. Re-keying on the phrase string restarts the
   animation cleanly when the rotation advances. Spaces use a literal
   non-breaking-space-equivalent ( ) so they preserve width inside
   the inline-block spans without collapsing. */
function BouncingText({ text }: { text: string }) {
  const chars = Array.from(text);
  return (
    <span key={text} className="inline-flex" aria-label={text}>
      {chars.map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block"
          style={{
            animation: "roam-lumi-bounce 1.1s ease-in-out infinite",
            animationDelay: `${i * 80}ms`,
            whiteSpace: "pre",
          }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
      <style>{`
        @keyframes roam-lumi-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-3px); }
        }
      `}</style>
    </span>
  );
}

function TripDraftCard({
  messageId,
  draft,
  createdTripId,
  labels,
  lang,
  onCreated,
}: {
  messageId: string;
  draft: TripDraft;
  createdTripId: string | null;
  labels: LumiAssistantLabels;
  lang: string;
  onCreated: (messageId: string, tripId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // First 5 cities, de-duped in order — gives the user a single-glance preview.
  const cities = (() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const d of draft.days) {
      const key = d.city.trim();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(key);
      }
    }
    return list.slice(0, 5);
  })();

  async function create() {
    if (busy || createdTripId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          cover: draft.cover ?? null,
          start_date: draft.start_date,
          end_date: draft.end_date,
          status: "upcoming",
          days: draft.days,
          checklist: (draft.checklist ?? []).map((c) => ({
            text: c.text,
            description: c.description ?? null,
            kind: c.kind,
            start_date: c.start_date ?? null,
            phase: c.phase ?? null,
            group_label: c.group_label ?? null,
            subtasks: c.subtasks ?? [],
            shortcut: c.kind === "esim" ? "shop" : null,
            shop_filter: c.shop_filter ?? null,
            done: false,
            suggested: c.suggested ?? true,
            suggested_by: c.suggested ? "Lumi" : undefined,
          })),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { trip: { id: string } };
      /* Brand-new trip — every day is fresh news. Seed the unread set so
         every Day<n> tab lights up until the user clicks through. */
      markDaysUnread(
        data.trip.id,
        draft.days.map((_, i) => i),
      );
      onCreated(messageId, data.trip.id);
      router.push(`/${lang}/trips/${data.trip.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[300px] rounded-2xl border border-divider bg-white p-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          {draft.cover ?? draft.title.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold tracking-tight text-fg">
            {draft.title}
          </div>
          <div
            className="truncate text-[11px] text-fg-muted"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {draft.start_date} → {draft.end_date} · {draft.days.length}{" "}
            {labels.draft_days_unit}
          </div>
        </div>
      </div>
      {cities.length > 0 && (
        <div className="mt-2 truncate text-[11.5px] text-fg-secondary">
          {cities.join(" · ")}
        </div>
      )}
      {error && (
        <div className="mt-2 rounded-md bg-[rgba(220,38,38,0.08)] px-2 py-1 text-[11px] text-[#b91c1c]">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy || !!createdTripId}
        className={cn(
          "mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl text-[12.5px] font-semibold text-white transition-opacity",
          "bg-gradient-to-br from-accent to-[#0a8e8a]",
          (busy || createdTripId) && "opacity-60",
        )}
      >
        {createdTripId
          ? labels.draft_created
          : busy
            ? labels.draft_creating
            : labels.draft_create}
      </button>
    </div>
  );
}
