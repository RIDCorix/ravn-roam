"use client";

// Lumi floating assistant. Rendered once at the storefront layout level
// so it's available on every storefront tab in the same position. The
// component:
//   * detects the current trip from the URL (matches /:lang/trips/:uuid)
//     and uses it as the conversation's trip_id
//   * persists every turn to Postgres via POST /api/trips/:id/lumi
//   * shows past conversations in a switchable list (filtered to the
//     active trip when on a trip page, or showing everything otherwise)
//   * refreshes the current trip cache after a successful edit so the trip
//     page reflects the new days/cities Lumi just wrote

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  ListChecks,
  MapPinned,
  PencilLine,
  Plus,
  MessageSquarePlus,
  RefreshCw,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  getLumiAvatar,
  LumiAvatarChip,
} from "@/components/storefront/lumi-avatar";
import {
  appEase,
  MotionButton,
  popIn,
  softSpring,
} from "@/components/storefront/motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  empty_chat: string;
  history_title: string;
  new_chat: string;
  delete_chat: string;
  empty_history: string;
  load_more: string;
  loading_more: string;
  draft_days_unit: string;
  draft_create: string;
  draft_creating: string;
  draft_created: string;
  change_days: string;
  change_stops: string;
  change_companions: string;
  change_checklist: string;
  change_draft_days: string;
  tool_events: {
    update_day: string;
    set_days: string;
    set_flight_details: string;
  };
  progress: {
    analyzing: string;
    finalizing: string;
    update_day: string;
    set_days: string;
    stage_draft_days: string;
    preparing_response: string;
    completed_days: string;
    completed_step: string;
  };
  drafting_canvas: {
    title: string;
    subtitle: string;
    prompt_label: string;
    prompt_empty: string;
    close: string;
    retry: string;
    create: string;
    creating: string;
    created: string;
    open_trip: string;
    days_unit: string;
    route_title: string;
    days_title: string;
    focus_label: string;
    facts: {
      cities: string;
      dates: string;
      stops: string;
      prep: string;
      pending: string;
    };
    route_empty: string;
    prep_title: string;
    prep_empty: string;
    final_title: string;
    error_title: string;
    partial_note: string;
    stages: {
      direction: string;
      time: string;
      places: string;
      route: string;
      prep: string;
    };
    stage_details: {
      direction: string;
      time: string;
      places: string;
      route: string;
      prep: string;
    };
    speech: {
      starting: string;
      analyzing: string;
      places: string;
      route: string;
      prep: string;
      ready: string;
      creating: string;
      created: string;
      failed: string;
    };
    skeleton_days: string[];
  };
  create_confirm: {
    title: string;
    body: string;
    confirm: string;
    cancel: string;
  };
  skills: {
    label: string;
    plan_trip: string;
    create_trip: string;
    edit_trip: string;
    inspiration: string;
  };
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

export interface TripDraft {
  title: string;
  start_date: string;
  end_date: string;
  cover?: string | null;
  flight_details?: {
    leg_key: string;
    departure_date?: string | null;
    departure_time?: string | null;
    flight_number?: string | null;
    terminal?: string | null;
    gate?: string | null;
  }[] | null;
  days: {
    day_date: string;
    city: string;
    cities?: string[];
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

interface LumiToolEvent {
  event: "tool_result";
  tool_name: "update_trip_day" | "create_trip_day" | "set_flight_details";
  tool_call_id?: string | null;
  status: "success" | "error";
  day_date?: string | null;
  day_index?: number | null;
  day_count?: number | null;
  flight_count?: number | null;
  label?: string;
}

interface LumiProgressEvent {
  event: "status" | "tool_call" | "tool_result";
  status?: string;
  tool_name?: string;
  label?: string;
  iteration?: number;
  staged_days?: number | null;
  days_preview?: LiveDayPreview[] | null;
}

/* Compact per-day summary streamed while Lumi is still drafting, so the
   canvas can paint partial results before the final payload lands. */
export interface LiveDayPreview {
  day_date: string;
  city: string;
  cities?: string[];
  stop_names?: string[];
  stop_count?: number;
}

type JourneyDraftStage = "direction" | "time" | "places" | "route" | "prep";
type JourneyDraftStatus =
  | "starting"
  | "drafting"
  | "ready"
  | "creating"
  | "created"
  | "failed";

export interface JourneyDraftSession {
  id: string;
  prompt: string;
  status: JourneyDraftStatus;
  stage: JourneyDraftStage;
  events: LumiProgressEvent[];
  startedAt: string;
  draft?: TripDraft | null;
  createdTripId?: string | null;
  error?: string | null;
  autoCreateTrip?: boolean;
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
  tool_events?: LumiToolEvent[];
  progress_events?: LumiProgressEvent[];
}

interface Conversation {
  id: string;
  trip_id: string | null;
  title: string;
  updated_at: string;
}

interface ConversationPageResponse {
  conversations: Conversation[];
  next_cursor: string | null;
  has_more: boolean;
}

interface LumiChatPayload {
  summary?: string;
  days?: unknown;
  cities?: unknown;
  companions?: unknown;
  checklist?: unknown;
  trip_draft?: TripDraft | null;
  esim_suggestion?: EsimSuggestion | null;
  tool_events?: LumiToolEvent[] | null;
  conversation_id?: string;
  metadata_updated?: boolean;
  message?: string;
  error?: string;
}

export type LumiSkillId =
  | "create-trip"
  | "plan-trip"
  | "edit-trip"
  | "inspiration";

export interface LumiTurn {
  role: "user" | "assistant";
  content: string;
}

const TRIP_PATH = /^\/(?:en|zh-TW)\/trips\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/;
const CONVERSATION_PAGE_SIZE = 10;
export const OPEN_LUMI_ASSISTANT_EVENT = "roam:open-lumi-assistant";

export type OpenLumiAssistantDetail = {
  prompt?: string;
  autoSend?: boolean;
  newConversation?: boolean;
  skill?: LumiSkillId;
  autoCreateTrip?: boolean;
};

export function LumiAssistant({
  labels,
  avatarId,
}: {
  labels: LumiAssistantLabels;
  avatarId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tripId = pathname?.match(TRIP_PATH)?.[1] ?? null;
  const lang = pathname?.match(/^\/(en|zh-TW)(?:\/|$)/)?.[1] ?? "zh-TW";

  const avatar = getLumiAvatar(avatarId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [conversationHasMore, setConversationHasMore] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [view, setView] = useState<"messages" | "history">("messages");
  const [expanded, setExpanded] = useState(false);
  // Collapsed by default: only the circular avatar shows. Tapping the
  // avatar opens the input pill.
  const [inputOpen, setInputOpen] = useState(false);
  const [value, setValue] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<LumiSkillId | null>(null);
  const [busy, setBusy] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(labels.thinking);
  const [pendingCreate, setPendingCreate] = useState<{ prompt: string } | null>(
    null,
  );
  const [creatingTripDraft, setCreatingTripDraft] = useState(false);
  const [draftSession, setDraftSession] =
    useState<JourneyDraftSession | null>(null);
  const composingRef = useRef(false);
  const conversationLoadingRef = useRef(false);
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
      setConversations([]);
      setConversationCursor(null);
      setConversationHasMore(false);
      setActiveConversationId(null);
      setView("messages");
      setSelectedSkill(null);
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

  async function loadConversations(options: { reset?: boolean } = {}) {
    if (conversationLoadingRef.current) return;
    const reset = options.reset ?? false;
    if (!reset && !conversationCursor) return;

    conversationLoadingRef.current = true;
    setConversationLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(CONVERSATION_PAGE_SIZE),
      });
      if (tripId) {
        params.set("trip_id", tripId);
        params.set("include_unscoped", "1");
      }
      if (!reset && conversationCursor) {
        params.set("cursor", conversationCursor);
      }

      const res = await fetch(`/api/lumi/conversations?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as ConversationPageResponse;
      setConversations((current) => {
        if (reset) return data.conversations;
        const seen = new Set(current.map((conversation) => conversation.id));
        return [
          ...current,
          ...data.conversations.filter((conversation) => !seen.has(conversation.id)),
        ];
      });
      setConversationCursor(data.next_cursor ?? null);
      setConversationHasMore(Boolean(data.has_more && data.next_cursor));
    } finally {
      conversationLoadingRef.current = false;
      setConversationLoading(false);
    }
  }

  async function openConversation(id: string) {
    setView("messages");
    setActiveConversationId(id);
    const res = await fetch(`/api/lumi/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: {
        id: string;
        role: "user" | "assistant";
        content: string;
        trip_draft?: TripDraft | null;
        esim_suggestion?: EsimSuggestion | null;
        tool_events?: LumiToolEvent[] | null;
      }[];
    };
    setMessages(
      data.messages.map((m) => ({
        id: m.id,
        role: m.role === "user" ? "user" : "lumi",
        content: m.content,
        trip_draft: m.trip_draft ?? undefined,
        esim_suggestion: m.esim_suggestion ?? undefined,
        tool_events: m.tool_events ?? undefined,
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


  const applyDraftProgress = useCallback((
    sessionId: string,
    event: LumiProgressEvent,
  ) => {
    setDraftSession((current) => {
      if (!current || current.id !== sessionId) return current;
      return {
        ...current,
        status: current.status === "starting" ? "drafting" : current.status,
        stage: stageForProgressEvent(event, current.stage),
        events: [...current.events, event].slice(-16),
        error: null,
      };
    });
  }, []);

  const markDraftReady = useCallback((sessionId: string, draft: TripDraft) => {
    setDraftSession((current) => {
      if (!current || current.id !== sessionId) return current;
      return {
        ...current,
        status: "ready",
        stage: "prep",
        draft,
        error: null,
      };
    });
  }, []);

  const markDraftFailure = useCallback((sessionId: string, error?: string) => {
    setDraftSession((current) => {
      if (!current || current.id !== sessionId) return current;
      return {
        ...current,
        status: "failed",
        error: error ?? labels.drafting_canvas.speech.failed,
      };
    });
  }, [labels.drafting_canvas.speech.failed]);

  const createDraftTripFromCanvas = useCallback(async (session: JourneyDraftSession) => {
    if (!session.draft || session.status === "creating" || session.status === "created") {
      return;
    }
    setDraftSession((current) =>
      current?.id === session.id ? { ...current, status: "creating", error: null } : current,
    );
    try {
      const newTripId = await createTripFromDraft(session.draft);
      markDaysUnread(
        newTripId,
        session.draft.days.map((_, i) => i),
      );
      setDraftSession((current) =>
        current?.id === session.id
          ? {
              ...current,
              status: "created",
              createdTripId: newTripId,
              error: null,
            }
          : current,
      );
      window.setTimeout(() => {
        router.push(`/${lang}/trips/${newTripId}`);
        router.refresh();
      }, 650);
    } catch (err) {
      setDraftSession((current) =>
        current?.id === session.id
          ? {
              ...current,
              status: "ready",
              error: err instanceof Error ? err.message : String(err),
            }
          : current,
      );
    }
  }, [lang, router]);

  const sendPrompt = useCallback(async (
    nextPrompt: string,
    options: {
      newConversation?: boolean;
      skill?: LumiSkillId | null;
      autoCreateTrip?: boolean;
    } = {},
  ) => {
    const prompt = nextPrompt.trim();
    if (!prompt || busy) return;

    const baseMessages = options.newConversation ? [] : messages;
    const conversationIdForRequest = options.newConversation
      ? null
      : activeConversationId;
    const history: LumiTurn[] = baseMessages
      .filter((m) => !m.pending)
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));
    const requestedSkill = options.skill ?? selectedSkill ?? null;
    const isTripCreation = requestedSkill === "create-trip" || !!options.autoCreateTrip;
    if (isTripCreation && !options.autoCreateTrip) {
      /* Trip creation is a two-beat flow: confirm first, then let Lumi
         produce a real draft before the app creates the trip. */
      setPendingCreate({ prompt });
      setValue("");
      setExpanded(true);
      setInputOpen(true);
      setView("messages");
      return;
    }
    const draftSessionId = options.autoCreateTrip
      ? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      : null;
    if (draftSessionId) {
      setDraftSession({
        id: draftSessionId,
        prompt,
        status: "starting",
        stage: "direction",
        events: [],
        startedAt: new Date().toISOString(),
        draft: null,
        createdTripId: null,
        error: null,
        autoCreateTrip: options.autoCreateTrip,
      });
    }

    const userMsgId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pendingId = `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setMessages((prev) => [
      ...(options.newConversation ? [] : prev),
      { id: userMsgId, role: "user", content: prompt },
      /* `content` here is a fallback for when rotation isn't running
         (e.g. busy=false race). The live phrase is injected by Bubble. */
      { id: pendingId, role: "lumi", content: labels.thinking, pending: true },
    ]);
    if (options.newConversation) {
      setActiveConversationId(null);
    }
    setValue("");
    setThinkingPhrase(firstThinkingPhrase(labels));
    setBusy(true);
    setExpanded(true);
    setInputOpen(true);
    setView("messages");

    try {
      const res = await fetch(`/api/lumi/chat/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          history,
          // Both fields are optional on the API; only include when set so
          // the zod `.uuid().optional()` accepts the payload.
          ...(conversationIdForRequest ? { conversation_id: conversationIdForRequest } : {}),
          ...(tripId ? { current_trip_id: tripId } : {}),
          ...(requestedSkill ? { requested_skill: requestedSkill } : {}),
          context: context ?? undefined,
        }),
      });
      const streamed = await readLumiStream(res, (event) => {
        if (draftSessionId) {
          applyDraftProgress(draftSessionId, event);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  content: formatProgressEvent(event, labels),
                  progress_events: [...(m.progress_events ?? []), event],
                }
              : m,
          ),
        );
      });
      const payload = streamed.payload;
      const ok = streamed.status >= 200 && streamed.status < 300;
      let createdTripId: string | null = null;
      let autoCreateError: string | null = null;
      if (ok && options.autoCreateTrip && payload.trip_draft) {
        if (draftSessionId) {
          markDraftReady(draftSessionId, payload.trip_draft);
          setDraftSession((current) =>
            current?.id === draftSessionId
              ? { ...current, status: "creating" }
              : current,
          );
        }
        try {
          createdTripId = await createTripFromDraft(payload.trip_draft);
          markDaysUnread(
            createdTripId,
            payload.trip_draft.days.map((_, i) => i),
          );
          if (draftSessionId) {
            setDraftSession((current) =>
              current?.id === draftSessionId
                ? {
                    ...current,
                    status: "created",
                    createdTripId,
                    error: null,
                  }
                : current,
            );
          }
        } catch (err) {
          autoCreateError = err instanceof Error ? err.message : String(err);
          if (draftSessionId) {
            setDraftSession((current) =>
              current?.id === draftSessionId
                ? {
                    ...current,
                    status: "ready",
                    error: autoCreateError,
                  }
                : current,
            );
          }
        }
      }
      if (ok && draftSessionId && payload.trip_draft && !options.autoCreateTrip) {
        markDraftReady(draftSessionId, payload.trip_draft);
      }
      if (draftSessionId && (!ok || !payload.trip_draft)) {
        markDraftFailure(draftSessionId, payload.error ?? payload.message);
      }
      const text =
        autoCreateError ??
        payload.summary ??
        payload.message ??
        payload.error ??
        (ok ? "✓" : `Lumi 失敗 (HTTP ${streamed.status})`);
      const changes = ok ? summarizeChanges(payload) : undefined;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: text,
                pending: false,
                trip_draft: payload.trip_draft ?? undefined,
                trip_draft_created_id: createdTripId,
                esim_suggestion: payload.esim_suggestion ?? undefined,
                tool_events: payload.tool_events ?? undefined,
                changes,
              }
            : m,
        ),
      );
      if (payload.conversation_id) {
        setActiveConversationId(payload.conversation_id);
      }
      if (ok && tripId && hasTripEditPayload(payload)) {
        /* Lumi just changed the active trip's itinerary. Mark every
           returned day as "unread" so the Day<n> tab shows a yellow
           dot until the user looks. */
        if (Array.isArray(payload.days)) {
          markDaysUnread(
            tripId,
            (payload.days as unknown[]).map((_, i) => i),
          );
        }
        /* SPA-style update: revalidate just the SWR entry for this
           trip. The trip page subscribes via `useTripDetail` and will
           re-render with the new days/companions/cities — no RSC
           re-render, no full-page refresh. */
        await refreshTrip(tripId);
      }
      if (createdTripId) {
        window.setTimeout(() => {
          router.push(`/${lang}/trips/${createdTripId}`);
          router.refresh();
        }, 650);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (draftSessionId) {
        markDraftFailure(draftSessionId, msg);
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: draftSessionId
                  ? labels.drafting_canvas.speech.failed
                  : msg,
                pending: false,
              }
            : m,
        ),
      );
    } finally {
      setBusy(false);
      setThinkingPhrase(labels.thinking);
      inputRef.current?.focus();
    }
  }, [
    activeConversationId,
    applyDraftProgress,
    busy,
    context,
    labels,
    markDraftFailure,
    markDraftReady,
    messages,
    router,
    selectedSkill,
    lang,
    tripId,
  ]);

  async function handleSend() {
    await sendPrompt(value);
  }

  async function handleConfirmCreateTrip() {
    if (!pendingCreate || creatingTripDraft || busy) return;
    const prompt = pendingCreate.prompt;
    setCreatingTripDraft(true);
    setPendingCreate(null);
    try {
      await sendPrompt(prompt, {
        newConversation: true,
        skill: "create-trip",
        autoCreateTrip: true,
      });
    } finally {
      setCreatingTripDraft(false);
    }
  }

  useEffect(() => {
    function handleOpenLumiAssistant(event: Event) {
      const detail = (event as CustomEvent<OpenLumiAssistantDetail>).detail ?? {};
      const prompt = detail.prompt?.trim() ?? "";
      if (detail.skill) {
        setSelectedSkill(detail.skill);
      }
      setInputOpen(true);
      setExpanded(true);
      setView("messages");
      if (detail.newConversation) {
        setActiveConversationId(null);
        setMessages([]);
      }
      if (prompt) {
        if (detail.autoSend) {
          void sendPrompt(prompt, {
            newConversation: detail.newConversation ?? true,
            skill: detail.skill ?? null,
            autoCreateTrip: detail.autoCreateTrip,
          });
        } else {
          setValue(prompt);
          window.setTimeout(() => inputRef.current?.focus(), 50);
        }
      } else {
        window.setTimeout(() => inputRef.current?.focus(), 50);
      }
    }

    window.addEventListener(OPEN_LUMI_ASSISTANT_EVENT, handleOpenLumiAssistant);
    return () => {
      window.removeEventListener(OPEN_LUMI_ASSISTANT_EVENT, handleOpenLumiAssistant);
    };
  }, [sendPrompt]);

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

  function openHistoryView() {
    setInputOpen(true);
    setExpanded(true);
    setView("history");
    void loadConversations({ reset: true });
  }

  const panelOpen = expanded;
  const showMessages = panelOpen && view === "messages";
  const showHistory = panelOpen && view === "history";
  const skillOptions = getSkillOptions(labels, Boolean(tripId));
  const activeSkill = selectedSkill
    ? skillOptions.find((option) => option.id === selectedSkill)
    : null;

  return (
    <>
    <AnimatePresence>
      {draftSession && (
        <JourneyDraftingCanvas
          session={draftSession}
          labels={labels}
          avatar={avatar}
          lang={lang}
          onClose={() => setDraftSession(null)}
          onRetry={(session) => {
            void sendPrompt(session.prompt, {
              newConversation: true,
              skill: "create-trip",
              autoCreateTrip: session.autoCreateTrip,
            });
          }}
          onCreate={(session) => {
            void createDraftTripFromCanvas(session);
          }}
        />
      )}
    </AnimatePresence>

    <div
      className="pointer-events-none fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 flex flex-col items-end gap-2"
    >
      <AnimatePresence>
        {(showMessages || showHistory) && (
        <motion.div
          className="pointer-events-auto w-[min(86vw,360px)] overflow-hidden rounded-2xl border border-divider bg-white/95 shadow-xl backdrop-blur"
          {...popIn}
        >
          <div className="flex items-center justify-between gap-2 border-b border-divider px-3.5 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <LumiAvatarChip avatar={avatar} size={22} />
              <span className="truncate text-[12px] font-semibold tracking-tight text-fg">
                {view === "history" ? labels.history_title : labels.name}
              </span>
            </div>
            <MotionButton
              type="button"
              onClick={openHistoryView}
              aria-label={labels.history_title}
              title={labels.history_title}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-fg-muted hover:bg-[rgba(0,0,0,0.04)]",
                view === "history" && "bg-accent-soft text-accent",
              )}
            >
              <History className="h-3.5 w-3.5" />
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
                  {conversationLoading ? labels.loading_more : labels.empty_history}
                </div>
              ) : (
                <>
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
                  {conversationHasMore ? (
                    <div className="px-2 pb-1 pt-2">
                      <MotionButton
                        type="button"
                        onClick={() => void loadConversations({ reset: false })}
                        disabled={conversationLoading}
                        className="inline-flex h-9 w-full items-center justify-center rounded-full border border-divider bg-white px-3 text-[12px] font-medium text-fg transition-colors hover:bg-[rgba(0,0,0,0.03)] disabled:cursor-wait disabled:opacity-60"
                      >
                        {conversationLoading ? labels.loading_more : labels.load_more}
                      </MotionButton>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div
              ref={scrollerRef}
              className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto px-3.5 py-3"
            >
              {messages.length === 0 ? (
                <div className="px-3 py-8 text-center text-[12px] leading-relaxed text-fg-muted">
                  {tripId ? labels.empty_chat : labels.no_trip_hint}
                </div>
              ) : (
                messages.map((m) => (
                  <Bubble
                    key={m.id}
                    message={m}
                    labels={labels}
                    lang={lang}
                    tripId={tripId}
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
                ))
              )}
              {pendingCreate ? (
                <div className="rounded-2xl border border-accent/25 bg-accent-softer/70 p-3.5">
                  <p className="text-[13px] font-semibold text-fg">
                    {labels.create_confirm.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-fg-secondary">
                    {labels.create_confirm.body}
                  </p>
                  <p className="mt-2 line-clamp-2 rounded-xl bg-white/80 px-2.5 py-1.5 text-[12px] leading-5 text-fg-muted">
                    {pendingCreate.prompt}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <MotionButton
                      type="button"
                      onClick={() => void handleConfirmCreateTrip()}
                      disabled={creatingTripDraft}
                      className={cn(
                        "inline-flex h-9 flex-1 items-center justify-center rounded-full bg-accent px-3 text-[12.5px] font-semibold text-white",
                        creatingTripDraft && "cursor-wait opacity-60",
                      )}
                    >
                      {labels.create_confirm.confirm}
                    </MotionButton>
                    <MotionButton
                      type="button"
                      onClick={() => setPendingCreate(null)}
                      disabled={creatingTripDraft}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-divider bg-white px-3 text-[12.5px] font-semibold text-fg-secondary"
                    >
                      {labels.create_confirm.cancel}
                    </MotionButton>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        className={cn(
          "pointer-events-auto flex items-center overflow-hidden rounded-full bg-white/95 backdrop-blur transition-[width,height,border-color,padding,box-shadow] duration-300 ease-out",
          inputOpen
            ? "w-[min(86vw,360px)] gap-2 border border-divider pl-2 pr-1.5 shadow-lg"
            : "w-[76px] gap-0 border border-accent/30 p-1.5 shadow-[0_18px_46px_-24px_rgba(15,184,180,0.85),0_0_0_8px_rgba(15,184,180,0.08)]",
        )}
        style={{ height: inputOpen ? 56 : 76 }}
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
          <LumiAvatarChip avatar={avatar} size={inputOpen ? 42 : 68} />
        </MotionButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={labels.skills.label}
              title={
                activeSkill
                  ? `${labels.skills.label}: ${activeSkill.label}`
                  : labels.skills.label
              }
              tabIndex={inputOpen ? 0 : -1}
              style={{
                opacity: inputOpen ? 1 : 0,
                pointerEvents: inputOpen ? "auto" : "none",
              }}
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)]",
                activeSkill ? "bg-accent-soft text-accent" : "text-fg-muted",
              )}
            >
              <Plus className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-44 rounded-xl border-divider bg-white p-1.5 shadow-[0_18px_50px_-32px_rgba(32,41,46,0.55)]"
          >
            {skillOptions.map((option) => {
              const Icon = option.Icon;
              const active = option.id === selectedSkill;
              return (
                <DropdownMenuItem
                  key={option.id}
                  onSelect={() => setSelectedSkill(option.id)}
                  className="h-10 rounded-lg px-2.5 text-[13px] font-semibold"
                >
                  <Icon className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {active ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
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
        <button
          type="button"
          onClick={openHistoryView}
          aria-label={labels.history_title}
          title={labels.history_title}
          tabIndex={inputOpen ? 0 : -1}
          style={{
            opacity: inputOpen ? 1 : 0,
            pointerEvents: inputOpen ? "auto" : "none",
          }}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)]",
            view === "history" && expanded && "bg-accent-soft text-accent",
          )}
        >
          <History className="h-4 w-4" />
        </button>
        <MotionButton
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded && view === "history") {
              void loadConversations({ reset: true });
            }
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
    </>
  );
}

function firstThinkingPhrase(labels: LumiAssistantLabels): string {
  const phrases = labels.thinking_phrases?.length
    ? labels.thinking_phrases
    : [labels.thinking];
  return phrases[Math.floor(Math.random() * phrases.length)] ?? labels.thinking;
}

const JOURNEY_STAGES: JourneyDraftStage[] = [
  "direction",
  "time",
  "places",
  "route",
  "prep",
];

function stageForProgressEvent(
  event: LumiProgressEvent,
  current: JourneyDraftStage,
): JourneyDraftStage {
  if (event.event === "tool_result" && event.staged_days != null) {
    return "route";
  }
  if (event.event === "tool_result") {
    return "prep";
  }
  if (event.event === "tool_call") {
    switch (event.tool_name) {
      case "stage_trip_draft_days":
      case "update_trip_day":
      case "create_trip_day":
        return "places";
      case "lumi_response":
        return "prep";
      default:
        return current === "direction" ? "time" : current;
    }
  }
  if (event.status === "finalizing") return "prep";
  return current === "direction" ? "time" : current;
}

function stageIndex(stage: JourneyDraftStage): number {
  return JOURNEY_STAGES.indexOf(stage);
}

export function JourneyDraftingCanvas({
  session,
  labels,
  avatar,
  lang,
  onClose,
  onRetry,
  onCreate,
}: {
  session: JourneyDraftSession;
  labels: LumiAssistantLabels;
  avatar: ReturnType<typeof getLumiAvatar>;
  lang: string;
  onClose: () => void;
  onRetry: (session: JourneyDraftSession) => void;
  onCreate: (session: JourneyDraftSession) => void;
}) {
  const copy = labels.drafting_canvas;
  const activeIndex = stageIndex(session.stage);
  const draft = session.draft ?? null;
  const cities = draft ? draftCities(draft) : [];
  const days = draft?.days ?? [];
  const latestSpeech = speechForDraftSession(session, copy);
  const isWorking =
    session.status === "starting" ||
    session.status === "drafting" ||
    session.status === "creating";
  const settled = session.status === "ready" || session.status === "created";
  const lastEvent = session.events[session.events.length - 1] ?? null;
  const activityLabel = lastEvent
    ? formatProgressEvent(lastEvent, labels)
    : copy.stage_details[session.stage];
  const primaryDisabled =
    session.status === "creating" ||
    session.status === "created" ||
    !session.draft;
  const createdHref = session.createdTripId
    ? `/${lang}/trips/${session.createdTripId}`
    : null;

  /* Partial results streamed while drafting. Once the final draft lands it
     becomes the single source of truth. */
  const liveDays = draft ? [] : liveDaysFromEvents(session.events);
  const lastLive = liveDays[liveDays.length - 1] ?? null;
  const paintedCities = draft ? cities : liveCitiesFromPreviews(liveDays);
  const focusDay =
    !draft && isWorking && session.stage !== "prep" ? lastLive : null;
  const focusIndex = focusDay
    ? liveDays.findIndex((day) => day.day_date === focusDay.day_date) + 1
    : 0;
  const factDates = draft
    ? days.map((day) => day.day_date)
    : liveDays.map((day) => day.day_date);
  const factDayCount = draft ? days.length : liveDays.length;
  const factStops = draft
    ? days.reduce((sum, day) => sum + (day.stops?.length ?? 0), 0)
    : liveDays.reduce((sum, day) => sum + (day.stop_count ?? 0), 0);
  const factPrep = draft?.checklist?.length ?? 0;

  const dockTitle =
    session.status === "failed"
      ? copy.error_title
      : settled
        ? copy.final_title
        : copy.stages[session.stage];
  const dockDetail =
    session.status === "failed"
      ? session.error || copy.speech.failed
      : draft
        ? `${draft.title} · ${draft.start_date} - ${draft.end_date}`
        : activityLabel;

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-[linear-gradient(180deg,var(--background)_0%,var(--surface)_100%)] px-4 pb-36 pt-6 text-fg sm:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: appEase }}
    >
      <JourneyDraftMotionStyles />
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/illustrations/lumi-drafting-background.png')] bg-cover bg-center" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--background) 88%, transparent) 0%, color-mix(in srgb, var(--background) 62%, transparent) 42%, color-mix(in srgb, var(--background) 46%, transparent) 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_22%_8%,rgba(15,184,180,0.14),transparent_38%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-[920px]">
        <header className="flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/76 px-3 py-1.5 text-[12px] font-semibold text-accent shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            {labels.name}
          </div>
          <MotionButton
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            title={copy.close}
            className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-divider bg-white/80 text-fg-muted shadow-sm backdrop-blur hover:bg-white hover:text-fg"
          >
            <X className="h-5 w-5" />
          </MotionButton>
        </header>

        <h1 className="mt-5 max-w-[760px] text-[34px] font-semibold leading-[1.04] tracking-[-0.02em] text-fg [text-wrap:balance] sm:text-[46px] lg:text-[54px]">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-[600px] text-[15px] leading-7 text-fg-secondary">
          {copy.subtitle}
        </p>
        {session.prompt ? (
          <p
            className="mt-3 max-w-[680px] truncate text-[13px] leading-6 text-fg-muted"
            title={session.prompt}
          >
            <span className="font-semibold text-fg-secondary">
              {copy.prompt_label}
            </span>
            <span aria-hidden> · </span>
            {session.prompt}
          </p>
        ) : null}

        <div className="mt-7 flex items-start gap-3">
          <div className={cn("relative shrink-0", isWorking && "roam-lumi-avatar-drift")}>
            {isWorking ? (
              <>
                <span className="roam-lumi-avatar-echo roam-lumi-avatar-echo-a" />
                <span className="roam-lumi-avatar-echo roam-lumi-avatar-echo-b" />
              </>
            ) : null}
            <LumiAvatarChip avatar={avatar} size={56} active />
          </div>
          <motion.div
            key={`${session.status}-${session.stage}`}
            className={cn(
              "relative max-w-[640px] overflow-hidden rounded-[24px] rounded-tl-md bg-fg px-5 py-3.5 text-[15px] font-medium leading-7 text-white shadow-[0_18px_44px_-32px_rgba(32,41,46,0.9)]",
              isWorking && "roam-speech-bubble-live",
            )}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={softSpring}
          >
            <AnimatedSpeechText text={latestSpeech} active={isWorking} />
          </motion.div>
        </div>

        <StageDots
          copy={copy}
          activeIndex={activeIndex}
          settled={settled}
          isWorking={isWorking}
        />

        <FactBoard
          copy={copy}
          cities={paintedCities}
          dates={factDates}
          dayCount={factDayCount}
          stops={factStops}
          prep={factPrep}
        />

        <JourneyRouteMap
          paintedCities={paintedCities}
          dayCount={factDayCount}
          focusDay={focusDay}
          focusIndex={focusIndex}
          copy={copy}
          session={session}
        />

        <section className="mt-9">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-fg">
              {draft ? copy.final_title : copy.days_title}
            </h2>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent">
              {draft
                ? `${days.length} ${copy.days_unit}`
                : liveDays.length > 0
                  ? `${liveDays.length} ${copy.days_unit}`
                  : copy.stages[session.stage]}
            </span>
          </div>
          {draft ? (
            <DraftDayList days={days} copy={copy} />
          ) : (
            <DraftingDayProgress liveDays={liveDays} copy={copy} />
          )}
        </section>

        <PrepStrip draft={draft} copy={copy} />
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-10 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-[600px] items-center gap-3 rounded-full border border-white/10 bg-fg/92 py-2 pl-5 pr-2 text-white shadow-[0_28px_64px_-28px_rgba(17,17,32,0.6)] backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{dockTitle}</p>
            <p className="truncate text-[11.5px] text-white/65">{dockDetail}</p>
          </div>
          {isWorking ? <ThinkingDots /> : null}
          {session.status === "failed" ? (
            <MotionButton
              type="button"
              onClick={() => onRetry(session)}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-fg"
            >
              <RefreshCw className="h-4 w-4" />
              {copy.retry}
            </MotionButton>
          ) : createdHref ? (
            <Link
              href={createdHref}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white"
            >
              {copy.open_trip}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <MotionButton
              type="button"
              onClick={() => onCreate(session)}
              disabled={primaryDisabled}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white shadow-[0_18px_32px_-18px_rgba(15,184,180,0.85)]",
                primaryDisabled && "cursor-not-allowed opacity-55",
              )}
            >
              {session.status === "creating"
                ? copy.creating
                : session.status === "created"
                  ? copy.created
                  : copy.create}
            </MotionButton>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function liveDaysFromEvents(events: LumiProgressEvent[]): LiveDayPreview[] {
  const byDate = new Map<string, LiveDayPreview>();
  for (const event of events) {
    if (event.event !== "tool_result" || !event.days_preview) continue;
    for (const day of event.days_preview) {
      if (day?.day_date) byDate.set(day.day_date, day);
    }
  }
  return Array.from(byDate.values()).sort((a, b) =>
    a.day_date.localeCompare(b.day_date),
  );
}

function liveCitiesFromPreviews(days: LiveDayPreview[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of days) {
    const dayCities = day.cities?.length ? day.cities : [day.city];
    for (const city of dayCities) {
      const clean = city?.trim();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

function StageDots({
  copy,
  activeIndex,
  settled,
  isWorking,
}: {
  copy: LumiAssistantLabels["drafting_canvas"];
  activeIndex: number;
  settled: boolean;
  isWorking: boolean;
}) {
  return (
    <div className="mt-6 flex min-h-[24px] items-center gap-3">
      <div className="flex items-center gap-1.5" aria-hidden>
        {JOURNEY_STAGES.map((stage, index) => {
          const done = settled || index < activeIndex;
          const active = !settled && index === activeIndex;
          return (
            <span
              key={stage}
              className={cn(
                "rounded-full transition-all duration-500",
                done
                  ? "h-1.5 w-5 bg-accent"
                  : active
                    ? "h-1.5 w-8 bg-accent"
                    : "h-1.5 w-1.5 bg-[rgba(17,17,17,0.14)]",
                active && isWorking && "roam-stage-dot-glow",
              )}
            />
          );
        })}
      </div>
      <p className="min-w-0 truncate text-[13px] font-medium text-fg-secondary">
        {settled
          ? copy.final_title
          : `${copy.stages[JOURNEY_STAGES[Math.min(activeIndex, JOURNEY_STAGES.length - 1)]!]} · ${copy.stage_details[JOURNEY_STAGES[Math.min(activeIndex, JOURNEY_STAGES.length - 1)]!]}`}
      </p>
    </div>
  );
}

function FactBoard({
  copy,
  cities,
  dates,
  dayCount,
  stops,
  prep,
}: {
  copy: LumiAssistantLabels["drafting_canvas"];
  cities: string[];
  dates: string[];
  dayCount: number;
  stops: number;
  prep: number;
}) {
  const dateValue =
    dates.length > 0
      ? `${dates[0]!.slice(5).replace("-", "/")} - ${dates[dates.length - 1]!.slice(5).replace("-", "/")} · ${dayCount} ${copy.days_unit}`
      : null;
  const cityValue =
    cities.length > 0
      ? cities.slice(0, 4).join(" · ") +
        (cities.length > 4 ? ` +${cities.length - 4}` : "")
      : null;
  const items = [
    { key: "cities", label: copy.facts.cities, value: cityValue },
    { key: "dates", label: copy.facts.dates, value: dateValue },
    { key: "stops", label: copy.facts.stops, value: stops > 0 ? String(stops) : null },
    { key: "prep", label: copy.facts.prep, value: prep > 0 ? String(prep) : null },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "min-w-0 rounded-2xl border px-3.5 py-2.5 backdrop-blur transition-colors duration-500",
            item.value
              ? "border-accent/25 bg-white/82 shadow-sm"
              : "border-white/60 bg-white/55",
          )}
        >
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
            <span className="truncate">{item.label}</span>
            {item.value ? (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-accent" />
            ) : null}
          </p>
          {item.value ? (
            <motion.p
              key={item.value}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={softSpring}
              className="mt-1 truncate text-[13px] font-semibold text-fg"
            >
              {item.value}
            </motion.p>
          ) : (
            <p className="mt-1 truncate text-[13px] font-medium text-fg-muted">
              {copy.facts.pending}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function DraftingDayProgress({
  liveDays,
  copy,
}: {
  liveDays: LiveDayPreview[];
  copy: LumiAssistantLabels["drafting_canvas"];
}) {
  const skeletonLabels =
    liveDays.length === 0 ? copy.skeleton_days : copy.skeleton_days.slice(0, 2);
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {liveDays.map((day, index) => (
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
            <p className="font-mono text-[11.5px] text-fg-muted">{day.day_date}</p>
          </div>
          <h3 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-fg">
            {day.city || day.day_date}
          </h3>
          {day.stop_names?.length ? (
            <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-fg-secondary">
              {day.stop_names.join(" · ")}
              {(day.stop_count ?? 0) > day.stop_names.length
                ? ` +${(day.stop_count ?? 0) - day.stop_names.length}`
                : ""}
            </p>
          ) : null}
        </motion.article>
      ))}
      {skeletonLabels.map((item, index) => (
        <div
          key={item}
          className="roam-draft-card-live rounded-[24px] border border-white/70 bg-white/72 p-5 backdrop-blur"
          style={{ animationDelay: `${index * 180}ms` }}
        >
          <p className="text-[12px] font-semibold text-accent">
            {liveDays.length + index + 1}
          </p>
          <p className="mt-1.5 text-[15px] font-semibold text-fg">{item}</p>
          <div className="roam-draft-shimmer-line mt-4 h-2 w-full rounded-full bg-divider" />
          <div className="roam-draft-shimmer-line mt-2 h-2 w-3/4 rounded-full bg-divider" />
        </div>
      ))}
    </div>
  );
}

function DraftDayList({
  days,
  copy,
}: {
  days: TripDraft["days"];
  copy: LumiAssistantLabels["drafting_canvas"];
}) {
  const visible = days.slice(0, 6);
  return (
    <div className="mt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((day, index) => (
          <motion.article
            key={`${day.day_date}-${index}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...softSpring, delay: index * 0.07 }}
            className="rounded-[24px] border border-white/70 bg-white/86 p-5 shadow-[0_18px_50px_-40px_rgba(32,41,46,0.6)] backdrop-blur"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-semibold text-accent">
                Day {index + 1}
              </p>
              <p className="font-mono text-[11.5px] text-fg-muted">{day.day_date}</p>
            </div>
            <h3 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-fg">
              {day.city || day.note}
            </h3>
            {day.note && day.city ? (
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
      {days.length > 6 ? (
        <p className="mt-3 rounded-2xl bg-white/72 px-4 py-3 text-[13px] font-medium text-fg-muted backdrop-blur">
          {copy.partial_note}
        </p>
      ) : null}
    </div>
  );
}

/* Hand-tuned waypoint layouts for the route sketch, viewBox 640x320. */
const ROUTE_LAYOUTS: Record<number, Array<[number, number]>> = {
  2: [
    [136, 212],
    [504, 110],
  ],
  3: [
    [112, 218],
    [320, 102],
    [528, 190],
  ],
  4: [
    [100, 222],
    [252, 112],
    [408, 196],
    [548, 98],
  ],
  5: [
    [92, 226],
    [220, 120],
    [364, 202],
    [478, 100],
    [572, 184],
  ],
  6: [
    [88, 230],
    [204, 126],
    [332, 206],
    [436, 108],
    [536, 182],
    [584, 254],
  ],
};

function routePoints(count: number): Array<[number, number]> {
  const clamped = Math.min(6, Math.max(2, count));
  return ROUTE_LAYOUTS[clamped]!;
}

/* Catmull-Rom spline through the waypoints, emitted as cubic beziers. */
function smoothPathD(points: Array<[number, number]>): string {
  if (points.length < 2) return "";
  const d: string[] = [`M ${points[0]![0]} ${points[0]![1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`,
    );
  }
  return d.join(" ");
}

function JourneyRouteMap({
  paintedCities,
  dayCount,
  focusDay,
  focusIndex,
  copy,
  session,
}: {
  paintedCities: string[];
  dayCount: number;
  focusDay: LiveDayPreview | null;
  focusIndex: number;
  copy: LumiAssistantLabels["drafting_canvas"];
  session: JourneyDraftSession;
}) {
  return (
    <div className="relative mt-6 aspect-[2/1] max-h-[420px] w-full overflow-hidden rounded-[32px] border border-white/72 bg-white/40 shadow-[0_32px_80px_-56px_rgba(32,41,46,0.6)] backdrop-blur-xl">
      <AnimatePresence initial={false}>
        {focusDay ? (
          <motion.div
            key={`focus-${focusDay.day_date}`}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.45, ease: appEase }}
          >
            <DayFocusView
              day={focusDay}
              index={focusIndex}
              copy={copy}
              paintedCities={paintedCities}
            />
          </motion.div>
        ) : (
          <motion.div
            key="map"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.12 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.25 }}
            transition={{ duration: 0.45, ease: appEase }}
          >
            <WorldSketchView
              paintedCities={paintedCities}
              dayCount={dayCount}
              copy={copy}
              session={session}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WorldSketchView({
  paintedCities,
  dayCount,
  copy,
  session,
}: {
  paintedCities: string[];
  dayCount: number;
  copy: LumiAssistantLabels["drafting_canvas"];
  session: JourneyDraftSession;
}) {
  const rawId = useId();
  const pathId = `roam-route-${rawId.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const isWorking =
    session.status === "starting" ||
    session.status === "drafting" ||
    session.status === "creating";
  const shown = paintedCities.slice(0, 6);
  const hasRoute = shown.length >= 2;
  const single = shown.length === 1;
  const pts = hasRoute ? routePoints(shown.length) : routePoints(4);
  const d = smoothPathD(pts);
  const nodes: Array<[number, number]> = single ? [[320, 160]] : pts;

  return (
    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,184,180,0.08),rgba(255,255,255,0.78)),linear-gradient(90deg,rgba(31,41,55,0.045)_1px,transparent_1px),linear-gradient(0deg,rgba(31,41,55,0.045)_1px,transparent_1px)] bg-[length:auto,40px_40px,40px_40px]">
      <svg
        viewBox="0 0 640 320"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {hasRoute ? (
          <path
            key={`painted-${shown.length}`}
            d={d}
            pathLength={1}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="1"
            className="roam-route-draw"
          />
        ) : (
          <>
            <path
              d={d}
              fill="none"
              stroke="rgba(17,17,17,0.14)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="4 9"
            />
            {isWorking ? (
              <path
                d={d}
                pathLength={1}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="0.16 0.84"
                className="roam-route-trace"
              />
            ) : null}
            {pts.map(([x, y], index) => (
              <circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r={6}
                fill="white"
                stroke="rgba(15,184,180,0.5)"
                strokeWidth={2.5}
                className="roam-route-ghost-node"
                style={{ animationDelay: `${index * 360}ms` }}
              />
            ))}
            {isWorking ? (
              <>
                <path id={pathId} d={d} fill="none" stroke="none" />
                <circle
                  r={5.5}
                  fill="var(--accent)"
                  className="roam-route-dot"
                  style={{ filter: "drop-shadow(0 4px 8px rgba(15,184,180,0.5))" }}
                >
                  <animateMotion dur="5.5s" repeatCount="indefinite" rotate="0">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              </>
            ) : null}
          </>
        )}
      </svg>
      {hasRoute || single ? (
        <div className="absolute inset-0">
          {nodes.map(([x, y], index) => (
            <div
              key={`${shown[index]}-${index}`}
              className="roam-route-node absolute flex w-[120px] -translate-x-1/2 -translate-y-[16px] flex-col items-center"
              style={{
                left: `${(x / 640) * 100}%`,
                top: `${(y / 320) * 100}%`,
                animationDelay: `${250 + index * 140}ms`,
              }}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-accent text-[11px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(15,184,180,0.9)] sm:h-8 sm:w-8 sm:text-[12px]">
                {index + 1}
              </span>
              <span className="mt-1 hidden max-w-full truncate rounded-full bg-white/92 px-2.5 py-0.5 text-[12px] font-semibold text-fg shadow-sm backdrop-blur sm:block">
                {shown[index]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1 text-[12px] font-semibold text-fg shadow-sm backdrop-blur">
        {copy.route_title}
      </div>
      {(hasRoute || single) && dayCount > 0 ? (
        <div className="absolute right-4 top-4 rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-white shadow-sm">
          {dayCount} {copy.days_unit}
        </div>
      ) : null}
      <p className="absolute bottom-4 left-4 right-4 truncate rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] font-medium text-fg-secondary shadow-sm backdrop-blur">
        {paintedCities.length ? paintedCities.join(" · ") : copy.route_empty}
      </p>
    </div>
  );
}

function DayFocusView({
  day,
  index,
  copy,
  paintedCities,
}: {
  day: LiveDayPreview;
  index: number;
  copy: LumiAssistantLabels["drafting_canvas"];
  paintedCities: string[];
}) {
  const stops = day.stop_names ?? [];
  const extra = Math.max(0, (day.stop_count ?? stops.length) - stops.length);
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_42%,rgba(15,184,180,0.15),transparent_56%),linear-gradient(135deg,rgba(15,184,180,0.05),rgba(255,255,255,0.8)),linear-gradient(90deg,rgba(31,41,55,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(31,41,55,0.05)_1px,transparent_1px)] bg-[length:auto,auto,72px_72px,72px_72px]">
      <div className="flex h-full max-w-[56%] flex-col justify-center px-6 sm:px-9">
        <p className="flex items-center gap-2 text-[12px] font-semibold text-accent">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
            {index}
          </span>
          <span className="truncate">
            {copy.focus_label} · Day {index}
          </span>
        </p>
        <h3 className="mt-2 truncate text-[26px] font-semibold tracking-[-0.02em] text-fg sm:text-[36px]">
          {day.city || day.day_date}
        </h3>
        <p className="mt-1 font-mono text-[12px] text-fg-muted">{day.day_date}</p>
        <div className="mt-4">
          <ThinkingDots />
        </div>
      </div>
      <ul className="absolute right-4 top-1/2 w-[42%] max-w-[300px] -translate-y-1/2 space-y-2 sm:right-6">
        {stops.map((name, stopIndex) => (
          <motion.li
            key={`${day.day_date}-${name}`}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.18 + stopIndex * 0.12 }}
            className="flex min-w-0 items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur"
          >
            <MapPinned className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="truncate text-[12.5px] font-medium text-fg">
              {name}
            </span>
          </motion.li>
        ))}
        {extra > 0 ? (
          <li className="pl-3 text-[12px] font-semibold text-accent">+{extra}</li>
        ) : null}
      </ul>
      <MiniRouteMap
        cities={paintedCities}
        className="absolute left-4 top-4 hidden sm:block"
      />
    </div>
  );
}

function MiniRouteMap({
  cities,
  className,
}: {
  cities: string[];
  className?: string;
}) {
  const shown = cities.slice(0, 6);
  if (shown.length === 0) return null;
  const pts: Array<[number, number]> =
    shown.length >= 2 ? routePoints(shown.length) : [[320, 160]];
  const d = shown.length >= 2 ? smoothPathD(pts) : "";
  return (
    <div
      className={cn(
        "w-[104px] overflow-hidden rounded-xl border border-white/70 bg-white/85 shadow-sm backdrop-blur",
        className,
      )}
    >
      <svg viewBox="0 0 640 320" className="block h-[52px] w-full" aria-hidden>
        {d ? (
          <path
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={8}
            strokeLinecap="round"
            opacity={0.45}
          />
        ) : null}
        {pts.map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r={14} fill="var(--accent)" />
        ))}
      </svg>
    </div>
  );
}

function PrepStrip({
  draft,
  copy,
}: {
  draft: TripDraft | null;
  copy: LumiAssistantLabels["drafting_canvas"];
}) {
  const checklist = draft?.checklist?.slice(0, 6) ?? [];
  if (checklist.length === 0) return null;
  return (
    <section className="mt-9">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4.5 w-4.5 text-accent" />
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-fg">
          {copy.prep_title}
        </h2>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {checklist.map((item, index) => (
          <motion.span
            key={item.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...softSpring, delay: index * 0.05 }}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/70 bg-white/82 px-3.5 py-2 text-[13px] font-medium text-fg-secondary shadow-sm backdrop-blur"
            title={item.description ?? undefined}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">{item.text}</span>
          </motion.span>
        ))}
      </div>
    </section>
  );
}

function speechForDraftSession(
  session: JourneyDraftSession,
  copy: LumiAssistantLabels["drafting_canvas"],
): string {
  if (session.status === "failed") return copy.speech.failed;
  if (session.status === "created") return copy.speech.created;
  if (session.status === "creating") return copy.speech.creating;
  if (session.status === "ready") return copy.speech.ready;
  if (session.status === "starting") return copy.speech.starting;
  if (session.stage === "places") return copy.speech.places;
  if (session.stage === "route") return copy.speech.route;
  if (session.stage === "prep") return copy.speech.prep;
  return copy.speech.analyzing;
}

function draftCities(draft: TripDraft): string[] {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const day of draft.days) {
    const dayCities = day.cities?.length ? day.cities : [day.city];
    for (const city of dayCities) {
      const clean = city.trim();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      cities.push(clean);
    }
  }
  return cities;
}

function AnimatedSpeechText({
  text,
  active,
}: {
  text: string;
  active: boolean;
}) {
  if (!active) return <>{text}</>;
  const words = text.split(/(\s+)/);
  return (
    <span key={text} className="relative z-10 inline-block" aria-label={text}>
      {words.map((word, index) => {
        if (/^\s+$/.test(word)) return word;
        return (
          <span
            key={`${word}-${index}`}
            aria-hidden
            className="roam-speech-word inline-block"
            style={{ animationDelay: `${index * 46}ms` }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}

function ThinkingDots() {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="roam-thinking-dot h-1.5 w-1.5 rounded-full bg-accent"
          style={{ animationDelay: `${dot * 170}ms` }}
        />
      ))}
    </span>
  );
}

function JourneyDraftMotionStyles() {
  return (
    <style>{`
      .roam-speech-bubble-live::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.08) 34%, rgba(255,255,255,0.2) 48%, rgba(255,255,255,0.08) 62%, transparent 100%);
        transform: translateX(-130%);
        animation: roam-draft-speech-sheen 2.6s ease-in-out infinite;
      }

      .roam-speech-bubble-live {
        animation: roam-draft-soft-rock 3.8s ease-in-out infinite;
      }

      .roam-speech-word {
        animation: roam-draft-word-wave 1.85s ease-in-out infinite;
        transform-origin: 50% 70%;
      }

      .roam-lumi-avatar-drift {
        animation: roam-draft-avatar-drift 4.4s ease-in-out infinite;
      }

      .roam-lumi-avatar-echo {
        position: absolute;
        inset: -5px;
        border-radius: 999px;
        border: 1px solid rgba(15,184,180,0.22);
        background: rgba(15,184,180,0.06);
        pointer-events: none;
      }

      .roam-lumi-avatar-echo-a {
        animation: roam-draft-avatar-echo 2.8s ease-out infinite;
      }

      .roam-lumi-avatar-echo-b {
        animation: roam-draft-avatar-echo 2.8s ease-out infinite;
        animation-delay: 1.4s;
      }

      .roam-draft-icon-breathe {
        animation: roam-draft-icon-breathe 1.8s ease-in-out infinite;
      }

      .roam-thinking-dot {
        animation: roam-thinking-dot 1.1s ease-in-out infinite;
      }

      .roam-draft-card-live {
        position: relative;
        overflow: hidden;
        animation: roam-draft-card-breathe 3.6s ease-in-out infinite;
      }

      .roam-draft-card-live::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.7) 45%, transparent 70%);
        transform: translateX(-120%);
        animation: roam-draft-card-scan 2.8s ease-in-out infinite;
      }

      .roam-draft-shimmer-line {
        overflow: hidden;
        background: linear-gradient(90deg, rgba(31,41,55,0.08), rgba(15,184,180,0.18), rgba(31,41,55,0.08));
        background-size: 220% 100%;
        animation: roam-draft-line-shimmer 2.3s ease-in-out infinite;
      }

      .roam-route-draw {
        stroke-dashoffset: 0;
        animation: roam-route-draw 1.1s cubic-bezier(0.32, 0.72, 0, 1) both;
      }

      .roam-route-trace {
        animation: roam-route-trace 2.6s linear infinite;
      }

      .roam-stage-dot-glow {
        animation: roam-stage-dot-glow 1.8s ease-in-out infinite;
      }

      .roam-route-ghost-node {
        animation: roam-route-ghost-node 2.4s ease-in-out infinite;
      }

      .roam-route-node {
        animation: roam-node-pop 0.5s cubic-bezier(0.32, 0.72, 0, 1) backwards;
      }

      @keyframes roam-draft-speech-sheen {
        0%, 18% { transform: translateX(-130%); }
        58%, 100% { transform: translateX(130%); }
      }

      @keyframes roam-draft-soft-rock {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        42% { transform: translateY(-1px) rotate(-0.25deg); }
        70% { transform: translateY(1px) rotate(0.18deg); }
      }

      @keyframes roam-draft-word-wave {
        0%, 72%, 100% { opacity: 0.82; transform: translateY(0); }
        24% { opacity: 1; transform: translateY(-1.5px); }
      }

      @keyframes roam-draft-avatar-drift {
        0%, 100% { transform: translate3d(0, 0, 0); }
        38% { transform: translate3d(1px, -3px, 0); }
        68% { transform: translate3d(-1px, 1px, 0); }
      }

      @keyframes roam-draft-avatar-echo {
        0% { opacity: 0.62; transform: scale(0.92); }
        70%, 100% { opacity: 0; transform: scale(1.35); }
      }

      @keyframes roam-draft-icon-breathe {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(15,184,180,0); }
        50% { transform: scale(1.04); box-shadow: 0 0 0 7px rgba(15,184,180,0.08); }
      }

      @keyframes roam-thinking-dot {
        0%, 70%, 100% { opacity: 0.35; transform: translateY(0); }
        35% { opacity: 1; transform: translateY(-3px); }
      }

      @keyframes roam-draft-card-breathe {
        0%, 100% { transform: translateY(0); border-color: rgba(31,41,55,0.1); }
        50% { transform: translateY(-1px); border-color: rgba(15,184,180,0.18); }
      }

      @keyframes roam-draft-card-scan {
        0%, 12% { transform: translateX(-120%); opacity: 0; }
        38% { opacity: 0.7; }
        74%, 100% { transform: translateX(120%); opacity: 0; }
      }

      @keyframes roam-draft-line-shimmer {
        0% { background-position: 100% 0; }
        100% { background-position: -120% 0; }
      }

      @keyframes roam-route-draw {
        from { stroke-dashoffset: 1; }
        to { stroke-dashoffset: 0; }
      }

      @keyframes roam-route-trace {
        from { stroke-dashoffset: 1; }
        to { stroke-dashoffset: 0; }
      }

      @keyframes roam-stage-dot-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(15,184,180,0.0); }
        50% { box-shadow: 0 0 0 5px rgba(15,184,180,0.16); }
      }

      @keyframes roam-route-ghost-node {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }

      @keyframes roam-node-pop {
        from { opacity: 0; scale: 0.6; }
        to { opacity: 1; scale: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .roam-speech-bubble-live,
        .roam-speech-bubble-live::before,
        .roam-speech-word,
        .roam-lumi-avatar-drift,
        .roam-lumi-avatar-echo,
        .roam-draft-icon-breathe,
        .roam-stage-dot-glow,
        .roam-thinking-dot,
        .roam-draft-card-live,
        .roam-draft-card-live::after,
        .roam-draft-shimmer-line,
        .roam-route-draw,
        .roam-route-trace,
        .roam-route-ghost-node,
        .roam-route-node {
          animation: none !important;
        }

        .roam-route-dot {
          display: none;
        }
      }
    `}</style>
  );
}

function formatProgressEvent(
  event: LumiProgressEvent,
  labels: LumiAssistantLabels,
): string {
  if (event.event === "status") {
    return event.status === "finalizing"
      ? labels.progress.finalizing
      : labels.progress.analyzing;
  }
  if (event.event === "tool_result") {
    if (event.staged_days != null) {
      return labels.progress.completed_days.replace(
        "{n}",
        String(event.staged_days),
      );
    }
    return labels.progress.completed_step;
  }
  switch (event.tool_name) {
    case "update_trip_day":
    case "create_trip_day":
      return labels.progress.update_day;
    case "stage_trip_draft_days":
      return labels.progress.stage_draft_days;
    case "lumi_response":
      return labels.progress.preparing_response;
    default:
      return event.label ?? labels.progress.analyzing;
  }
}

function getSkillOptions(labels: LumiAssistantLabels, hasTrip: boolean) {
  const tripOptions = [
    {
      id: "plan-trip" as const,
      label: labels.skills.plan_trip,
      Icon: Sparkles,
    },
    {
      id: "edit-trip" as const,
      label: labels.skills.edit_trip,
      Icon: PencilLine,
    },
    {
      id: "inspiration" as const,
      label: labels.skills.inspiration,
      Icon: Sparkles,
    },
  ];
  if (hasTrip) return tripOptions;
  return [
    {
      id: "create-trip" as const,
      label: labels.skills.create_trip,
      Icon: Plus,
    },
    {
      id: "edit-trip" as const,
      label: labels.skills.edit_trip,
      Icon: PencilLine,
    },
    {
      id: "inspiration" as const,
      label: labels.skills.inspiration,
      Icon: Sparkles,
    },
  ];
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

async function readLumiStream(
  res: Response,
  onProgress: (event: LumiProgressEvent) => void,
): Promise<{ status: number; payload: LumiChatPayload }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") || !res.body) {
    const payload = (await res.json().catch(() => ({}))) as LumiChatPayload;
    return { status: res.status, payload };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: { status: number; payload: LumiChatPayload } | null = null;

  const handleLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const raw = line.slice("data:".length).trim();
    if (!raw) return;
    const event = JSON.parse(raw) as
      | { event: "progress"; data: LumiProgressEvent }
      | { event: "final"; status: number; data: LumiChatPayload }
      | { event: "error"; status: number; data: LumiChatPayload };
    if (event.event === "progress") {
      onProgress(event.data);
      return;
    }
    final = {
      status: event.status,
      payload: event.data,
    };
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      handleLine(line);
    }
  }
  buffer += decoder.decode();
  for (const line of buffer.split(/\r?\n/)) {
    handleLine(line);
  }

  return final ?? { status: res.status, payload: {} };
}

function Bubble({
  message,
  labels,
  lang,
  tripId,
  pendingPhrase,
  onCreated,
}: {
  message: Message;
  labels: LumiAssistantLabels;
  lang: string;
  tripId: string | null;
  pendingPhrase: string;
  onCreated: (messageId: string, tripId: string) => void;
}) {
  const isUser = message.role === "user";
  const isPending = !isUser && !!message.pending;
  const pendingText =
    isPending && message.progress_events?.length
      ? formatProgressEvent(
          message.progress_events[message.progress_events.length - 1]!,
          labels,
        )
      : pendingPhrase;
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
          <BouncingText text={pendingText} />
        ) : (
          message.content
        )}
      </div>
      {!isUser && message.tool_events && message.tool_events.length > 0 && (
        <ToolEventBadges events={message.tool_events} labels={labels} />
      )}
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
          tripId={tripId}
        />
      )}
    </div>
  );
}

function ToolEventBadges({
  events,
  labels,
}: {
  events: LumiToolEvent[];
  labels: LumiAssistantLabels;
}) {
  const visible = events.filter((event) => event.status === "success").slice(0, 8);
  if (visible.length === 0) return null;

  return (
    <div className="flex max-w-[85%] flex-wrap gap-1">
      {visible.map((event, index) => (
        <span
          key={event.tool_call_id ?? `${event.tool_name}-${index}`}
          className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent-softer px-2 py-[2px] text-[10px] font-medium text-accent"
        >
          <Check className="h-3 w-3" />
          {formatToolEvent(event, labels)}
        </span>
      ))}
    </div>
  );
}

function formatToolEvent(
  event: LumiToolEvent,
  labels: LumiAssistantLabels,
): string {
  if (event.tool_name === "update_trip_day" || event.tool_name === "create_trip_day") {
    return labels.tool_events.update_day.replace(
      "{n}",
      String(event.day_index ?? ""),
    );
  }
  if (event.tool_name === "set_flight_details") {
    return labels.tool_events.set_flight_details;
  }
  return labels.tool_events.update_day.replace(
    "{n}",
    String(event.day_index ?? ""),
  );
}

function EsimSuggestionCard({
  suggestion,
  lang,
  tripId,
}: {
  suggestion: EsimSuggestion;
  lang: string;
  tripId: string | null;
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
        <EsimSuggestionLink key={i} plan={p} lang={lang} tripId={tripId} />
      ))}
    </div>
  );
}

function EsimSuggestionLink({
  plan,
  lang,
  tripId,
}: {
  plan: EsimSuggestionPlan;
  lang: string;
  tripId: string | null;
}) {
  const days = plan.days ?? undefined;
  const gb = plan.gb ?? undefined;
  const href = buildShopHref(lang, {
    country: plan.country,
    days,
    gb,
  }, tripId ? { tripId } : {});
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
          className="inline-flex items-center rounded-full border border-divider bg-white/70 px-2 py-[2px] text-[10px] font-medium text-fg-muted"
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

function hasTripEditPayload(payload: {
  days?: unknown;
  cities?: unknown;
  companions?: unknown;
  checklist?: unknown;
  metadata_updated?: boolean;
}): boolean {
  return Boolean(
    payload.days ||
      payload.cities ||
      payload.companions ||
      payload.checklist ||
      payload.metadata_updated,
  );
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
	      const dayCities = d.cities?.length ? d.cities : [d.city];
	      for (const city of dayCities) {
	        const key = city.trim();
	        if (!key || seen.has(key)) continue;
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
      const tripId = await createTripFromDraft(draft);
      /* Brand-new trip — every day is fresh news. Seed the unread set so
         every Day<n> tab lights up until the user clicks through. */
      markDaysUnread(
        tripId,
        draft.days.map((_, i) => i),
      );
      onCreated(messageId, tripId);
      router.push(`/${lang}/trips/${tripId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

export async function createTripFromDraft(draft: TripDraft): Promise<string> {
  const res = await fetch(`/api/trips`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: draft.title,
      cover: draft.cover ?? null,
      start_date: draft.start_date,
      end_date: draft.end_date,
      status: "upcoming",
      metadata: metadataForTripDraft(draft),
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
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { trip?: { id?: string } };
  if (!data.trip?.id) throw new Error("missing trip id");
  return data.trip.id;
}

function metadataForTripDraft(draft: TripDraft): Record<string, unknown> {
  if (!draft.flight_details?.length) return { source: "lumi" };
  return {
    source: "lumi",
    planning: {
      exploration_flight_details: Object.fromEntries(
        draft.flight_details
          .flatMap((item) => {
            const key = item.leg_key.trim();
            if (!key) return [];
            return [[
              key,
              {
                departureDate: item.departure_date ?? "",
                departureTime: item.departure_time ?? "",
                flightNumber: item.flight_number ?? "",
                terminal: item.terminal ?? "",
                gate: item.gate ?? "",
              },
            ] as const];
          }),
      ),
    },
  };
}
