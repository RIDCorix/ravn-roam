// Single chat bubble — user bubbles align right with a dark fill, assistant
// bubbles align left with a soft surface fill. Ports the visual shape from
// design/app/components/Lumi.jsx → LumiMessage.

import Link from "next/link";
import { ArrowUpRight, Signal, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import { ItineraryCard } from "./itinerary-card";
import { parseAssistantMessage } from "./parse";
import type { ChatMessage, EsimCtaData } from "./types";

export interface ChatBubbleLabels {
  itineraryTitle: string;
  esimCtaFallback: string;
}

export function ChatBubble({
  message,
  lang,
  labels,
}: {
  message: ChatMessage;
  lang: string;
  labels: ChatBubbleLabels;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.5] text-white",
          )}
          style={{ background: "#111", borderTopRightRadius: 6 }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const { prose, cards } = parseAssistantMessage(message.content);
  const esimCard = cards.find((c) => c.type === "esim_cta") as
    | EsimCtaData
    | undefined;
  const itineraryCards = cards.filter((c) => c.type === "itinerary");

  return (
    <div className="flex items-start gap-2.5">
      <LumiAvatar />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {prose && (
          <div
            className="inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.6] text-fg"
            style={{
              background: "var(--surface)",
              boxShadow: "var(--shadow-xs)",
              borderTopLeftRadius: 6,
            }}
          >
            {prose}
          </div>
        )}
        {itineraryCards.map((card, i) => (
          <ItineraryCard
            key={`itin-${i}`}
            days={card.type === "itinerary" ? card.days : []}
            title={labels.itineraryTitle}
          />
        ))}
        {esimCard && (
          <EsimCtaButton
            data={esimCard}
            lang={lang}
            fallbackLabel={labels.esimCtaFallback}
          />
        )}
      </div>
    </div>
  );
}

function EsimCtaButton({
  data,
  lang,
  fallbackLabel,
}: {
  data: EsimCtaData;
  lang: string;
  fallbackLabel: string;
}) {
  const params = new URLSearchParams();
  params.set("country", data.country);
  if (data.days != null) params.set("days", String(data.days));
  if (data.gb != null) params.set("gb", String(data.gb));
  const href = `/${lang}/shop?${params.toString()}`;
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <Signal className="h-3 w-3" />
      {data.label || fallbackLabel}
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  );
}

function LumiAvatar() {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
      style={{
        background: "linear-gradient(135deg, #0FB8B4 0%, #6E8CF7 100%)",
      }}
      aria-hidden="true"
    >
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  );
}
