"use client";

// Tweaks panel — floating right-edge designer affordance. Lets the operator
// switch accent colour, toggle the ambient bloom, swap row density, and
// pick a display currency without touching dictionary defaults. State
// persists to localStorage so the same settings ride along across reloads.
//
// Ported from the Lume design prototype's tweaks-panel.jsx, simplified to
// the four controls the prototype's `TWEAK_DEFAULTS` exposed. The accent /
// density overrides write to CSS variables on <html> / <body> so any
// component that consumes `var(--accent)` or `var(--row-pad)` picks them
// up automatically — no per-component theming.

import * as React from "react";
import { Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface TweaksDict {
  title: string;
  appearance: string;
  accent: string;
  ambient: string;
  density: string;
  density_options: { comfortable: string; compact: string };
  display: string;
  currency: string;
}

interface TweakState {
  accent: string;
  ambient: boolean;
  density: "comfortable" | "compact";
  currency: "USD" | "TWD";
}

const DEFAULTS: TweakState = {
  accent: "#0FB8B4",
  ambient: true,
  density: "comfortable",
  currency: "TWD",
};

const STORAGE_KEY = "roam.admin.tweaks";

const ACCENT_SWATCHES = ["#0FB8B4", "#5B7CFA", "#10A37F", "#D9994E", "#111111"];

function loadState(): TweakState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TweakState>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function TweaksPanel({ dict }: { dict: TweaksDict }) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<TweakState>(DEFAULTS);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.style.setProperty("--accent", state.accent);
    document.documentElement.style.setProperty(
      "--accent-soft",
      withAlpha(state.accent, 0.12),
    );
    document.documentElement.style.setProperty(
      "--accent-ring",
      withAlpha(state.accent, 0.32),
    );
    document.body.style.setProperty(
      "--row-pad",
      state.density === "compact" ? "6px" : "12px",
    );
    document.body.dataset.ambient = state.ambient ? "on" : "off";
    document.body.dataset.density = state.density;
    document.body.dataset.currency = state.currency;
  }, [state, hydrated]);

  function patch<K extends keyof TweakState>(key: K, value: TweakState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  return (
    <>
      <button
        type="button"
        aria-label={dict.title}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed right-4 bottom-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-md border border-divider text-fg-secondary hover:text-fg transition-colors",
        )}
      >
        <Settings2 className="h-4 w-4" />
      </button>
      {open ? (
        <aside
          className={cn(
            "fixed right-4 bottom-16 z-40 w-72 rounded-2xl bg-surface border border-divider shadow-lg p-4 space-y-4",
          )}
        >
          <header className="flex items-center justify-between">
            <h3 className="t-eyebrow">{dict.title}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-fg-muted hover:text-fg text-xs"
              aria-label="close"
            >
              ×
            </button>
          </header>

          <section className="space-y-3">
            <h4 className="t-eyebrow text-fg-muted">{dict.appearance}</h4>
            <div>
              <label className="block text-xs text-fg-secondary mb-2">
                {dict.accent}
              </label>
              <div className="flex gap-2">
                {ACCENT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => patch("accent", swatch)}
                    aria-label={swatch}
                    style={{ background: swatch }}
                    className={cn(
                      "h-7 w-7 rounded-full transition-transform",
                      state.accent === swatch
                        ? "ring-2 ring-offset-2 ring-offset-surface ring-fg scale-110"
                        : "hover:scale-110",
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs text-fg-secondary">
                {dict.ambient}
              </label>
              <button
                type="button"
                onClick={() => patch("ambient", !state.ambient)}
                role="switch"
                aria-checked={state.ambient}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  state.ambient ? "bg-accent" : "bg-divider-strong",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                    state.ambient ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            <div>
              <label className="block text-xs text-fg-secondary mb-2">
                {dict.density}
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-divider p-1">
                {(["comfortable", "compact"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => patch("density", d)}
                    className={cn(
                      "rounded text-xs py-1 transition-colors",
                      state.density === d
                        ? "bg-surface-sunken text-fg"
                        : "text-fg-secondary hover:text-fg",
                    )}
                  >
                    {dict.density_options[d]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="t-eyebrow text-fg-muted">{dict.display}</h4>
            <div>
              <label className="block text-xs text-fg-secondary mb-2">
                {dict.currency}
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-divider p-1">
                {(["TWD", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch("currency", c)}
                    className={cn(
                      "rounded text-xs py-1 transition-colors",
                      state.currency === c
                        ? "bg-surface-sunken text-fg"
                        : "text-fg-secondary hover:text-fg",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </aside>
      ) : null}
    </>
  );
}
