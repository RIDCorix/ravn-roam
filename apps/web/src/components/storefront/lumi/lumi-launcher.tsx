"use client";

// Cross-view Lumi launcher. A floating button (avatar) sits bottom-right
// across the whole storefront — clicking opens a slide-up sheet (mobile)
// or right-side panel (desktop) that hosts the chat. Lumi reads the user's
// trips from the mock catalog and detects the currently-viewed trip via
// pathname, so a question like "what's my next trip?" works on any page.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";

import type { Trip } from "@/lib/mock/consumer";
import { TRIPS } from "@/lib/mock/consumer";
import { cn } from "@/lib/utils";

import { LumiChat, type LumiChatLabels } from "./lumi-chat";

export interface LumiLauncherLabels extends LumiChatLabels {
  launcherLabel: string;
  sheetTitle: string;
  sheetSubtitle: string;
  close: string;
}

export interface LumiLauncherCopy {
  launcherLabel: string;
  sheetTitle: string;
  sheetSubtitle: string;
  close: string;
  introDefault: string;
  introTripTemplate: string;
  greetingDefault: string;
  greetingTripTemplate: string;
  composerPlaceholder: string;
  suggestionsDefault: string[];
  suggestionsTrip: string[];
  errorPrefix: string;
  itineraryTitle: string;
  esimCtaFallback: string;
}

type SheetPhase = "closed" | "open" | "closing";

export function LumiLauncher({
  lang,
  copy,
}: {
  lang: string;
  copy: LumiLauncherCopy;
}) {
  const [phase, setPhase] = useState<SheetPhase>("closed");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname() ?? "";
  const currentTrip = findCurrentTrip(pathname, lang, TRIPS);
  const visible = phase !== "closed";

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPhase("open");
  };
  const close = () => {
    setPhase("closing");
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Match the longest exit animation in globals.css (.lumi-sheet[data-state=closed]).
    closeTimer.current = setTimeout(() => setPhase("closed"), 260);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Close on Escape while the sheet is mounted.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  // Lock background scroll while the sheet is mounted.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const intro = currentTrip
    ? copy.introTripTemplate.replace("{title}", currentTrip.title)
    : copy.introDefault;
  const greeting = currentTrip
    ? copy.greetingTripTemplate.replace("{title}", currentTrip.title)
    : copy.greetingDefault;
  const suggestions = currentTrip
    ? copy.suggestionsTrip
    : copy.suggestionsDefault;

  const chatLabels: LumiChatLabels = {
    intro,
    composerPlaceholder: copy.composerPlaceholder,
    suggestions,
    errorPrefix: copy.errorPrefix,
    itineraryTitle: copy.itineraryTitle,
    esimCtaFallback: copy.esimCtaFallback,
  };

  const dataState = phase === "open" ? "open" : "closed";

  return (
    <>
      <button
        type="button"
        aria-label={copy.launcherLabel}
        onClick={open}
        className={cn(
          "lumi-launcher-fab",
          "fixed z-30 inline-flex h-14 w-14 items-center justify-center rounded-full text-white",
          "right-4 md:right-6",
          // On mobile the bottom nav reserves ~64px; sit above it. On desktop
          // there's no bottom nav, drop to the corner.
          "bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6",
          "transition-transform duration-150 ease-out hover:scale-105 active:scale-95",
        )}
        style={{
          background: "linear-gradient(135deg, #0FB8B4 0%, #6E8CF7 100%)",
          boxShadow:
            "0 10px 24px -8px rgba(15,184,180,0.6), 0 4px 10px -2px rgba(0,0,0,0.15)",
        }}
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {visible && (
        <LumiSheet
          title={copy.sheetTitle}
          subtitle={copy.sheetSubtitle}
          closeLabel={copy.close}
          state={dataState}
          onClose={close}
        >
          <LumiChat
            trips={TRIPS}
            currentTrip={currentTrip}
            lang={lang}
            labels={chatLabels}
            greeting={greeting}
          />
        </LumiSheet>
      )}
    </>
  );
}

function LumiSheet({
  title,
  subtitle,
  closeLabel,
  state,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  closeLabel: string;
  state: "open" | "closed";
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-stretch md:items-end md:justify-stretch"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="lumi-backdrop absolute inset-0 cursor-default"
        data-state={state}
        style={{ background: "rgba(15,17,23,0.45)" }}
      />

      <div
        className={cn(
          "lumi-sheet relative flex flex-col overflow-hidden bg-bg shadow-2xl",
          // Mobile: slide up, take ~85vh from the bottom.
          "mt-auto h-[85vh] w-full rounded-t-2xl",
          // Desktop: anchor to the right, full height.
          "md:mt-0 md:h-full md:w-[420px] md:rounded-none md:rounded-l-2xl",
        )}
        data-state={state}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-divider px-4 py-3">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
            style={{
              background: "linear-gradient(135deg, #0FB8B4 0%, #6E8CF7 100%)",
            }}
            aria-hidden="true"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">
              {title}
            </div>
            <div className="truncate text-[11px] text-fg-muted">{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-fg-secondary hover:bg-[rgba(0,0,0,0.04)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function findCurrentTrip(
  pathname: string,
  lang: string,
  trips: Trip[],
): Trip | undefined {
  const prefix = `/${lang}/trips/`;
  if (!pathname.startsWith(prefix)) return undefined;
  const after = pathname.slice(prefix.length);
  if (!after) return undefined;
  const id = after.split("/")[0];
  if (!id) return undefined;
  return trips.find((t) => t.id === id);
}
