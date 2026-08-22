import { cn } from "@/lib/utils";

type SceneState = "no-coverage" | "ready" | "error";

export function ConnectivityReadinessScene({ state, title, description, className }: { state: SceneState; title: string; description: string; className?: string }) {
  const active = state === "ready";
  const muted = state === "no-coverage";
  return <div className={cn("grid gap-4 rounded-3xl bg-surface-sunken p-5 sm:grid-cols-[156px_1fr] sm:items-center", className)}>
    <svg viewBox="0 0 200 132" role="img" aria-labelledby="connectivity-scene-title connectivity-scene-desc" className="mx-auto h-auto w-full max-w-[190px]" preserveAspectRatio="xMidYMid meet">
      <title id="connectivity-scene-title">{title}</title><desc id="connectivity-scene-desc">{description}</desc>
      <RouteLine active={active} muted={muted} /><DestinationPin muted={muted} /><EsimCard active={active} muted={muted} /><SignalRings active={active} muted={muted} />{active ? <LumiBeacon /> : null}
    </svg><div className="min-w-0 text-center sm:text-left"><h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">{title}</h2><p className="mt-1 text-[13px] leading-6 text-fg-muted">{description}</p></div>
  </div>;
}
export function DestinationPin({ muted = false }: { muted?: boolean }) { return <path d="M31 18c-9 0-16 7-16 16 0 12 16 27 16 27s16-15 16-27c0-9-7-16-16-16Z" fill="none" stroke="currentColor" strokeWidth="2.5" className={muted ? "text-fg-muted" : "text-fg"} />; }
export function RouteLine({ active, muted }: { active: boolean; muted: boolean }) { return <path d="M39 59C69 102 93 89 117 76c22-12 36-10 50-33" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" className={active ? "text-accent" : muted ? "text-fg-muted/60" : "text-fg-muted"} />; }
export function EsimCard({ active, muted }: { active: boolean; muted: boolean }) { return <g className={active ? "text-accent" : muted ? "text-fg-muted" : "text-fg"}><rect x="90" y="58" width="50" height="38" rx="8" fill="currentColor" fillOpacity={active ? ".13" : ".06"} stroke="currentColor" strokeWidth="2" /><path d="M106 70h18M106 78h12M106 86h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></g>; }
export function SignalRings({ active, muted }: { active: boolean; muted: boolean }) { return <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={active ? "text-accent" : muted ? "text-fg-muted/60" : "text-fg-muted"}><path d="M156 36c11 7 18 19 18 32" /><path d="M148 45c8 5 12 13 12 23" /><path d="M140 54c4 3 6 8 6 14" /><circle cx="138" cy="68" r="2" fill="currentColor" stroke="none" /></g>; }
export function LumiBeacon() { return <g aria-hidden="true" className="text-accent"><circle cx="31" cy="34" r="5" fill="currentColor" /><path d="M31 8v5M31 55v5M5 34h5M52 34h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></g>; }
