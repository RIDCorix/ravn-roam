"use client";

// Client-side glue for the Lumi tab. Holds the chat transcript, talks to
// /api/lumi via streaming fetch, and shows a streaming assistant bubble that
// updates token-by-token. Persistence and tool calling are explicitly out
// of scope for C-2 (see ROA-102) — this is in-memory only.

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import type { Trip } from "@/lib/mock/consumer";

import { ChatBubble, type ChatBubbleLabels } from "./chat-bubble";
import { Composer } from "./composer";
import type { ChatMessage } from "./types";

export interface LumiChatLabels extends ChatBubbleLabels {
  intro: string;
  composerPlaceholder: string;
  suggestionsTitle?: string;
  suggestions: string[];
  errorPrefix: string;
}

export function LumiChat({
  trip,
  lang,
  labels,
  greeting,
}: {
  trip: Trip;
  lang: string;
  labels: LumiChatLabels;
  greeting: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "greet", role: "assistant", content: greeting },
  ]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    const assistantId = `a-${Date.now()}`;
    const placeholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, userMsg, placeholder]);
    setDraft("");
    setStreaming(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "greet")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/lumi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history,
          trip: {
            id: trip.id,
            title: trip.title,
            start: trip.start,
            end: trip.end,
            days: trip.days,
          },
          lang,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await safeReadError(res);
        appendToAssistant(setMessages, assistantId, `${labels.errorPrefix}${errText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) appendToAssistant(setMessages, assistantId, chunk);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      appendToAssistant(setMessages, assistantId, `${labels.errorPrefix}${msg}`);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
        style={{ background: "rgba(15,184,180,0.06)" }}
      >
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
          style={{
            background: "linear-gradient(135deg, #0FB8B4 0%, #6E8CF7 100%)",
          }}
          aria-hidden="true"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1 text-[12px] text-fg-secondary">
          {labels.intro}
        </div>
      </div>

      <div ref={scrollRef} className="flex flex-col gap-3 py-1">
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} lang={lang} labels={labels} />
        ))}
      </div>

      {labels.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {labels.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft(s)}
              className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] text-fg-secondary transition-colors hover:bg-[rgba(0,0,0,0.04)]"
              style={{
                background: "var(--surface)",
                boxShadow: "inset 0 0 0 1px var(--divider-strong)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <Composer
        draft={draft}
        onChange={setDraft}
        onSubmit={() => send(draft)}
        placeholder={labels.composerPlaceholder}
        disabled={streaming}
      />
    </div>
  );
}

function appendToAssistant(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  id: string,
  chunk: string,
) {
  setMessages((prev) =>
    prev.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m)),
  );
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
