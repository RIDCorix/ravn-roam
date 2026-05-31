import {
  Flower2,
  Leaf,
  Snowflake,
  Sun,
  type LucideIcon,
} from "lucide-react";

import type { SeasonKey } from "./types";

export function seasonVisual(season: SeasonKey): {
  Icon: LucideIcon;
  bg: string;
  headerBg: string;
  horizon: string;
  text: string;
  dot: string;
  line: string;
} {
  switch (season) {
    case "spring":
      return {
        Icon: Flower2,
        bg: "bg-gradient-to-b from-rose-100/88 via-pink-50/76 to-rose-50/58",
        headerBg: "bg-gradient-to-b from-rose-50 to-pink-50/92",
        horizon: "bg-gradient-to-r from-rose-200/55 via-rose-100/50 to-stone-100/45",
        text: "text-rose-600",
        dot: "border-rose-300",
        line: "bg-rose-200",
      };
    case "summer":
      return {
        Icon: Sun,
        bg: "bg-gradient-to-b from-emerald-100/78 via-teal-50/76 to-cyan-50/52",
        headerBg: "bg-gradient-to-b from-emerald-50 to-teal-50/92",
        horizon: "bg-gradient-to-r from-sky-200/45 via-cyan-100/50 to-emerald-100/45",
        text: "text-teal-700",
        dot: "border-sky-300",
        line: "bg-sky-200",
      };
    case "autumn":
      return {
        Icon: Leaf,
        bg: "bg-gradient-to-b from-orange-100/86 via-amber-100/74 to-orange-50/62",
        headerBg: "bg-gradient-to-b from-orange-50 to-amber-50/92",
        horizon: "bg-gradient-to-r from-amber-200/55 via-orange-100/50 to-stone-100/45",
        text: "text-orange-700",
        dot: "border-amber-300",
        line: "bg-amber-200",
      };
    case "winter":
      return {
        Icon: Snowflake,
        bg: "bg-gradient-to-b from-sky-100/82 via-blue-50/78 to-white/60",
        headerBg: "bg-gradient-to-b from-sky-50 to-blue-50/92",
        horizon: "bg-gradient-to-r from-blue-200/45 via-slate-100/55 to-zinc-100/50",
        text: "text-blue-600",
        dot: "border-blue-300",
        line: "bg-blue-200",
      };
  }
}

export function eventStickerRotation(slug: string): number {
  const angles = [-18, -11, 9, 15, -7, 12, -14, 6];
  const hash = Array.from(slug).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return angles[hash % angles.length];
}

export function eventStickerSide(slug: string): "left" | "right" {
  const hash = Array.from(slug).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return hash % 3 === 0 ? "right" : "left";
}

export function eventTimelineVisual(
  slug: string,
  eventType: string,
): { bar: string } {
  if (slug.includes("fuji-rock")) {
    return {
      bar: "border-purple-200/80 bg-gradient-to-r from-purple-400/78 via-violet-300/78 to-purple-200/84 text-purple-950",
    };
  }
  if (slug.includes("gion")) {
    return {
      bar: "border-red-200/80 bg-gradient-to-r from-red-400/78 via-orange-300/82 to-amber-200/84 text-red-950",
    };
  }
  if (slug.includes("obon")) {
    return {
      bar: "border-red-200/80 bg-gradient-to-r from-red-400/76 via-rose-300/78 to-red-200/84 text-red-950",
    };
  }
  if (slug.includes("korankei") || slug.includes("autumn")) {
    return {
      bar: "border-red-200/80 bg-gradient-to-r from-red-500/72 via-orange-400/78 to-amber-300/82 text-red-950",
    };
  }
  if (slug.includes("marathon")) {
    return {
      bar: "border-amber-200/80 bg-gradient-to-r from-amber-300/84 via-yellow-300/76 to-amber-200/84 text-amber-950",
    };
  }

  switch (eventType) {
    case "seasonal":
      return {
        bar: "border-rose-200/80 bg-gradient-to-r from-rose-300/82 via-pink-300/78 to-rose-200/82 text-rose-950",
      };
    case "music":
      return {
        bar: "border-purple-200/80 bg-gradient-to-r from-purple-400/78 via-violet-300/78 to-purple-200/84 text-purple-950",
      };
    case "sports":
      return {
        bar: "border-amber-200/80 bg-gradient-to-r from-amber-300/84 via-yellow-300/76 to-amber-200/84 text-amber-950",
      };
    case "food":
    case "festival":
    case "carnival":
      return {
        bar: "border-orange-200/80 bg-gradient-to-r from-orange-300/84 via-amber-300/82 to-orange-200/82 text-orange-950",
      };
    case "religious":
      return {
        bar: "border-violet-200/80 bg-gradient-to-r from-violet-300/78 via-purple-300/76 to-violet-200/82 text-violet-950",
      };
    case "cultural":
      return {
        bar: "border-amber-200/80 bg-gradient-to-r from-amber-300/82 via-yellow-300/72 to-amber-200/82 text-amber-950",
      };
    default:
      return {
        bar: "border-teal-200/80 bg-gradient-to-r from-teal-300/82 via-emerald-300/76 to-teal-200/82 text-teal-950",
      };
  }
}

export function eventVisual(eventType: string): {
  pill: string;
  bar: string;
  badge: string;
  button: string;
  icon: string;
} {
  switch (eventType) {
    case "seasonal":
      return {
        pill: "border-rose-200 bg-rose-50/88 group-hover:bg-rose-100/80",
        bar: "border-rose-200/80 bg-rose-300/82 text-rose-950",
        badge: "border-rose-300 bg-rose-400/92",
        button: "border-rose-300 bg-rose-50 hover:bg-rose-100",
        icon: "text-rose-500",
      };
    case "music":
      return {
        pill: "border-sky-200 bg-sky-50/88 group-hover:bg-sky-100/80",
        bar: "border-sky-200/80 bg-sky-300/82 text-sky-950",
        badge: "border-sky-300 bg-sky-500/92",
        button: "border-sky-300 bg-sky-50 hover:bg-sky-100",
        icon: "text-sky-500",
      };
    case "sports":
      return {
        pill: "border-cyan-200 bg-cyan-50/88 group-hover:bg-cyan-100/80",
        bar: "border-cyan-200/80 bg-cyan-300/82 text-cyan-950",
        badge: "border-cyan-300 bg-cyan-500/92",
        button: "border-cyan-300 bg-cyan-50 hover:bg-cyan-100",
        icon: "text-cyan-600",
      };
    case "food":
      return {
        pill: "border-orange-200 bg-orange-50/88 group-hover:bg-orange-100/80",
        bar: "border-orange-200/80 bg-orange-300/84 text-orange-950",
        badge: "border-orange-300 bg-orange-500/92",
        button: "border-orange-300 bg-orange-50 hover:bg-orange-100",
        icon: "text-orange-500",
      };
    case "religious":
    case "cultural":
      return {
        pill: "border-amber-200 bg-amber-50/88 group-hover:bg-amber-100/80",
        bar: "border-amber-200/80 bg-amber-300/84 text-amber-950",
        badge: "border-amber-300 bg-amber-500/92",
        button: "border-amber-300 bg-amber-50 hover:bg-amber-100",
        icon: "text-amber-600",
      };
    case "festival":
    case "carnival":
      return {
        pill: "border-orange-200 bg-orange-50/88 group-hover:bg-orange-100/80",
        bar: "border-orange-200/80 bg-orange-300/84 text-orange-950",
        badge: "border-orange-300 bg-orange-500/92",
        button: "border-orange-300 bg-orange-50 hover:bg-orange-100",
        icon: "text-orange-500",
      };
    default:
      return {
        pill: "border-teal-200 bg-teal-50/88 group-hover:bg-teal-100/80",
        bar: "border-teal-200/80 bg-teal-300/82 text-teal-950",
        badge: "border-teal-300 bg-teal-500/92",
        button: "border-teal-300 bg-teal-50 hover:bg-teal-100",
        icon: "text-accent",
      };
  }
}

export function eventIconSrc(eventType: string, slug?: string): string {
  if (slug?.includes("korankei") || slug?.includes("autumn")) {
    return "/illustrations/event-icons/icon-03.png";
  }
  if (slug?.includes("gion")) {
    return "/illustrations/event-icons/icon-18.png";
  }
  if (slug?.includes("obon")) {
    return "/illustrations/event-icons/icon-13.png";
  }
  if (slug?.includes("fuji-rock")) {
    return "/illustrations/event-icons/icon-21.png";
  }
  if (slug?.includes("marathon")) {
    return "/illustrations/event-icons/icon-55.png";
  }

  switch (eventType) {
    case "seasonal":
      return "/illustrations/event-icons/icon-01.png";
    case "religious":
      return "/illustrations/event-icons/icon-11.png";
    case "music":
      return "/illustrations/event-icons/icon-21.png";
    case "sports":
      return "/illustrations/event-icons/icon-55.png";
    case "food":
      return "/illustrations/event-icons/icon-29.png";
    case "festival":
    case "carnival":
      return "/illustrations/event-icons/icon-18.png";
    case "cultural":
      return "/illustrations/event-icons/icon-27.png";
    default:
      return "/illustrations/event-icons/icon-45.png";
  }
}
