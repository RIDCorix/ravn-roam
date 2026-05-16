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

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Send,
  Trash2,
} from "lucide-react";

import {
  getLumiAvatar,
  LumiAvatarChip,
} from "@/components/storefront/lumi-avatar";
import type { LumiContext } from "@/lib/lumi-context";
import { cn } from "@/lib/utils";

export interface LumiAssistantLabels {
  name: string;
  placeholder: string;
  open: string;
  close: string;
  send: string;
  thinking: string;
  no_trip_hint: string;
  history_title: string;
  new_chat: string;
  delete_chat: string;
  empty_history: string;
  draft_days_unit: string;
  draft_create: string;
  draft_creating: string;
  draft_created: string;
}

interface TripDraftStop {
  name: string;
  kind?: string;
  arrival_time?: string | null;
  duration_min?: number | null;
  note?: string;
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
  checklist?: { text: string; kind: string; suggested?: boolean }[];
}

interface Message {
  id: string;
  role: "user" | "lumi";
  content: string;
  pending?: boolean;
  trip_draft?: TripDraft;
  trip_draft_created_id?: string | null;
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
  context,
}: {
  labels: LumiAssistantLabels;
  avatarId?: string;
  context: LumiContext | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tripId = pathname?.match(TRIP_PATH)?.[1] ?? null;
  const lang = pathname?.match(/^\/(en|zh-TW)(?:\/|$)/)?.[1] ?? "zh-TW";

  const avatar = getLumiAvatar(avatarId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [view, setView] = useState<"messages" | "history">("messages");
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

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
      { id: pendingId, role: "lumi", content: labels.thinking, pending: true },
    ]);
    setValue("");
    setBusy(true);
    setExpanded(true);
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
        conversation_id?: string;
        message?: string;
        error?: string;
      };
      const text =
        payload.summary ??
        payload.message ??
        payload.error ??
        (res.ok ? "✓" : `Lumi 失敗 (HTTP ${res.status})`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: text,
                pending: false,
                trip_draft: payload.trip_draft ?? undefined,
              }
            : m,
        ),
      );
      if (payload.conversation_id) {
        setActiveConversationId(payload.conversation_id);
      }
      if (res.ok && (payload.days || payload.companions)) {
        // The trip page reads everything from the server — revalidate so
        // the map / timeline / companion strip pick up Lumi's edits
        // without a full reload.
        router.refresh();
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
      className="pointer-events-none fixed right-4 z-30 flex flex-col items-end gap-2"
      style={{
        bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
      }}
    >
      {(showMessages || showHistory) && (
        <div className="pointer-events-auto w-[min(86vw,360px)] overflow-hidden rounded-2xl border border-divider bg-white/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-divider px-3.5 py-2">
            <button
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
            </button>
            <button
              type="button"
              onClick={startNewChat}
              aria-label={labels.new_chat}
              title={labels.new_chat}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-fg-muted hover:bg-[rgba(0,0,0,0.04)]"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={labels.close}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-fg-muted hover:bg-[rgba(0,0,0,0.04)]"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
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
                        <button
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
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteConversation(c.id)}
                          aria-label={labels.delete_chat}
                          className="inline-flex w-8 shrink-0 items-center justify-center rounded-r-xl text-fg-muted hover:bg-[rgba(0,0,0,0.04)] hover:text-[#b91c1c]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
        </div>
      )}

      <div
        className="pointer-events-auto flex w-[min(86vw,360px)] items-center gap-2 rounded-full border border-divider bg-white/95 pl-2 pr-1.5 shadow-lg backdrop-blur"
        style={{ height: 48 }}
      >
        <LumiAvatarChip avatar={avatar} size={36} />
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
          disabled={busy}
          placeholder={busy ? labels.thinking : labels.placeholder}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-muted disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded && view === "history") void loadConversations();
          }}
          aria-label={expanded ? labels.close : labels.open}
          aria-expanded={expanded}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-[rgba(0,0,0,0.04)]"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={busy || value.trim().length === 0}
          aria-label={labels.send}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity",
            "bg-gradient-to-br from-accent to-[#0a8e8a]",
            (busy || value.trim().length === 0) && "opacity-40",
          )}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Bubble({
  message,
  labels,
  lang,
  onCreated,
}: {
  message: Message;
  labels: LumiAssistantLabels;
  lang: string;
  onCreated: (messageId: string, tripId: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug",
          isUser
            ? "rounded-br-md bg-accent text-white"
            : "rounded-bl-md bg-[rgba(0,0,0,0.05)] text-fg",
          message.pending && "animate-pulse",
        )}
      >
        {message.content}
      </div>
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
    </div>
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
            kind: c.kind,
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
