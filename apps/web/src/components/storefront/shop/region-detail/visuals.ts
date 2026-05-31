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
  activeRing: string;
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
        activeRing: "border-rose-400 ring-rose-300/45",
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
        activeRing: "border-teal-500 ring-teal-300/45",
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
        activeRing: "border-orange-500 ring-orange-300/45",
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
        activeRing: "border-blue-500 ring-blue-300/45",
        line: "bg-blue-200",
      };
  }
}

export function seasonCardImageSrc(season: SeasonKey): string {
  switch (season) {
    case "spring":
      return "/illustrations/timeline/seasons/spring.png";
    case "summer":
      return "/illustrations/timeline/seasons/summer.png";
    case "autumn":
      return "/illustrations/timeline/seasons/autumn.png";
    case "winter":
      return "/illustrations/timeline/seasons/winter.png";
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

export function eventTimelineVisual(index: number): { bar: string } {
  const palette = [
    "border-rose-200/70 bg-gradient-to-r from-rose-200/92 via-pink-100/92 to-rose-100/94 text-rose-950",
    "border-emerald-200/70 bg-gradient-to-r from-emerald-200/90 via-teal-100/84 to-teal-50/94 text-emerald-950",
    "border-sky-200/70 bg-gradient-to-r from-sky-200/90 via-cyan-100/86 to-blue-100/92 text-sky-950",
    "border-violet-200/70 bg-gradient-to-r from-violet-200/90 via-purple-100/88 to-fuchsia-100/90 text-violet-950",
    "border-amber-200/70 bg-gradient-to-r from-amber-200/92 via-yellow-100/90 to-orange-100/88 text-amber-950",
    "border-orange-200/70 bg-gradient-to-r from-orange-200/90 via-amber-100/86 to-rose-100/88 text-orange-950",
  ];

  return {
    bar: palette[index % palette.length],
  };
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
