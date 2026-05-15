// Shared types for the Lumi chat tab. The assistant emits inline ```json```
// fences with these shapes so the client can render rich cards / CTAs
// without using OpenAI function calling.

export interface ItineraryDay {
  date: string;
  city: string;
  sub?: string;
}

export interface ItineraryCardData {
  type: "itinerary";
  days: ItineraryDay[];
}

export interface EsimCtaData {
  type: "esim_cta";
  country: string;
  days?: number;
  gb?: number;
  label?: string;
}

export type LumiCard = ItineraryCardData | EsimCtaData;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
