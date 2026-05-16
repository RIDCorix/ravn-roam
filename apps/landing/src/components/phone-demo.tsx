"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion, type Transition } from "motion/react";

import { Icon, RoamLogo } from "./icons";
import type { Dictionary } from "@/app/[lang]/dictionaries";

type DemoDict = NonNullable<Dictionary["hero"]["demo"]>;

const STEP_COUNT = 7;
const STEP_MS = 2800;

const ENTER_EASE = [0.22, 0.61, 0.36, 1] as const;

/* Phone is "held up" for app-interaction steps; "set aside" in the corner
   for movement steps so the plane / skyline can act on the full canvas. */
type PhonePose = "held" | "asideRight" | "asideLeft";

const POSES: Record<PhonePose, { scale: number; x: number; y: number; rotate: number }> = {
  held: { scale: 1, x: 0, y: 0, rotate: -2 },
  asideRight: { scale: 0.5, x: 110, y: 90, rotate: 10 },
  asideLeft: { scale: 0.5, x: -110, y: 90, rotate: -10 },
};

const POSE_BY_STEP: PhonePose[] = [
  "held",         // 1. Open Roam
  "held",         // 2. Pick a plan
  "held",         // 3. Download
  "asideRight",   // 4. Board flight  → plane flies across
  "asideLeft",    // 5. Land          → skyline rises
  "held",         // 6. Activate
  "held",         // 7. Connected
];

const POSE_SPRING: Transition = {
  type: "spring",
  stiffness: 130,
  damping: 18,
  mass: 0.9,
};

export function PhoneDemo({ dict }: { dict: DemoDict }) {
  const [step, setStep] = useState(0);
  const reducedMotion = useReducedMotion();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    /* Respect `prefers-reduced-motion`: keep the first frame visible instead
       of auto-cycling. Also pause when the tab is hidden so we stop burning
       CPU (INP / battery / Core Web Vitals). */
    if (reducedMotion) return;

    const start = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        setStep((s) => (s + 1) % STEP_COUNT);
      }, STEP_MS);
    };
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reducedMotion]);

  const labels = useMemo(
    () => [
      dict.step1,
      dict.step2,
      dict.step3,
      dict.step4,
      dict.step5,
      dict.step6,
      dict.step7,
    ],
    [dict],
  );

  const pose = POSE_BY_STEP[step];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 600,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* atmospheric ambient — no edges, blends into the page */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-40px -10% -40px -10%",
          background:
            "radial-gradient(ellipse 60% 50% at 50% 42%, rgba(15,184,180,0.10), transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* scene atmosphere — soft radial blobs, no rectangle edges */}
      <AnimatePresence>
        {step === 3 && (
          <m.div
            key="sky-boarding"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            style={{
              position: "absolute",
              inset: "-20% -20% -20% -20%",
              background:
                "radial-gradient(ellipse 70% 55% at 50% 30%, rgba(180,210,225,0.55), transparent 65%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
        {step === 4 && (
          <m.div
            key="sky-landed"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            style={{
              position: "absolute",
              inset: "-20% -20% -20% -20%",
              background:
                "radial-gradient(ellipse 75% 60% at 50% 75%, rgba(255,210,160,0.45), transparent 65%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* stage — phone + scene actors share this space */}
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        {/* Scene overlays — full-stage actors for movement steps */}
        <AnimatePresence>
          {step === 3 && <PlaneFlyAcross key="plane" />}
          {step === 4 && <SkylineRise key="skyline" dict={dict} />}
        </AnimatePresence>

        {/* Phone — pose driven by step */}
        <m.div
          animate={POSES[pose]}
          transition={POSE_SPRING}
          style={{
            position: "relative",
            zIndex: 2,
            transformOrigin: "center center",
          }}
        >
          {/* gentle float when held */}
          <m.div
            animate={
              pose === "held"
                ? { y: [0, -5, 0] }
                : { y: 0 }
            }
            transition={
              pose === "held"
                ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.4 }
            }
          >
            <PhoneFrame>
              <AnimatePresence mode="wait">
                {step === 0 && <OpenRoamScreen key="s0" />}
                {step === 1 && <BuyPlanScreen key="s1" dict={dict} />}
                {step === 2 && <DownloadScreen key="s2" dict={dict} />}
                {step === 3 && <AirplaneModeScreen key="s3" />}
                {step === 4 && <LandedMiniScreen key="s4" dict={dict} />}
                {step === 5 && <ActivateScreen key="s5" dict={dict} />}
                {step === 6 && <ConnectedScreen key="s6" dict={dict} />}
              </AnimatePresence>
            </PhoneFrame>
          </m.div>
        </m.div>
      </div>

      <StepIndicator step={step} label={labels[step]} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Phone frame                                                            */
/* ────────────────────────────────────────────────────────────────────── */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: 256,
        height: 520,
        borderRadius: 44,
        background: "linear-gradient(180deg, #1a1a1c 0%, #0e0e10 100%)",
        padding: 10,
        boxShadow:
          "0 30px 60px -20px rgba(0,0,0,0.45), 0 8px 24px -8px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 34,
          background: "#fbfaf7",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 80,
            height: 22,
            borderRadius: 14,
            background: "#0e0e10",
            zIndex: 3,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 22px 0",
            fontSize: 10.5,
            fontWeight: 600,
            color: "#111",
            letterSpacing: "-0.01em",
            position: "relative",
            zIndex: 2,
          }}
        >
          <span>9:41</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, opacity: 0.65 }}>
            <Icon name="signal" size={10} />
            <Icon name="wifi" size={10} />
          </span>
        </div>
        <div style={{ flex: 1, position: "relative", paddingTop: 8 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Step indicator                                                         */
/* ────────────────────────────────────────────────────────────────────── */

function StepIndicator({ step, label }: { step: number; label: string }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 4,
        marginTop: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <AnimatePresence mode="wait">
        <m.span
          key={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--fg)",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </m.span>
      </AnimatePresence>
      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <span
            key={i}
            style={{
              width: i === step ? 18 : 6,
              height: 6,
              borderRadius: 999,
              background: i === step ? "var(--accent)" : "rgba(0,0,0,0.14)",
              transition: "width 360ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Scene actors — break out of the phone view                             */
/* ────────────────────────────────────────────────────────────────────── */

function PlaneFlyAcross() {
  return (
    <m.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      style={{
        position: "absolute",
        inset: "-10% -15%",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      {/* faint contrail — enters with the plane, dissipates as it leaves */}
      <m.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: [0, 0.6, 0] }}
        exit={{ opacity: 0, scaleX: 1.1 }}
        transition={{ duration: 2.2, ease: "easeOut" }}
        style={{
          position: "absolute",
          top: "32%",
          left: "0%",
          width: "100%",
          height: 2,
          transformOrigin: "left center",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(15,184,180,0.0) 8%, rgba(15,184,180,0.45) 60%, rgba(15,184,180,0) 100%)",
          filter: "blur(0.5px)",
        }}
      />
      {/* clouds drift past */}
      {[
        { top: "18%", left: "12%", size: 8, delay: 0.1 },
        { top: "55%", left: "70%", size: 12, delay: 0.35 },
        { top: "70%", left: "22%", size: 6, delay: 0.5 },
      ].map((c, i) => (
        <m.span
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: [0, 0.55, 0], x: 30 }}
          exit={{ opacity: 0, x: 60 }}
          transition={{ duration: 2.4, delay: c.delay, ease: "easeOut" }}
          style={{
            position: "absolute",
            top: c.top,
            left: c.left,
            width: c.size,
            height: c.size,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.85)",
            filter: "blur(2px)",
          }}
        />
      ))}
      {/* the plane — enters from left and climbs out to the right;
          if step ends early, exit continues the arc off-screen */}
      <m.div
        initial={{ x: "-30%", y: 60, rotate: -8, opacity: 0 }}
        animate={{
          x: ["-30%", "50%", "130%"],
          y: [60, -10, -60],
          rotate: [-8, -2, 8],
          opacity: [0, 1, 0.9],
        }}
        exit={{ x: "180%", y: -120, rotate: 14, opacity: 0 }}
        transition={{ duration: 2.5, ease: [0.4, 0.05, 0.4, 1], times: [0, 0.55, 1] }}
        style={{
          position: "absolute",
          top: "40%",
          left: 0,
          color: "var(--accent)",
          filter: "drop-shadow(0 6px 12px rgba(15,184,180,0.35))",
        }}
      >
        <Icon name="plane" size={68} strokeWidth={1.4} />
      </m.div>
    </m.div>
  );
}

function SkylineRise({ dict }: { dict: DemoDict }) {
  return (
    <m.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1, transition: { duration: 0.95 } }}
      style={{
        position: "absolute",
        /* Bottom extended past the demo container so the skyline sits well
           below the StepIndicator at the bottom of the card. Otherwise the
           tallest building spires reach into the indicator's text area. */
        inset: "-10% -15% -30% -15%",
        pointerEvents: "none",
        zIndex: 3,
        overflow: "hidden",
      }}
    >
      {/* sun / horizon glow — rises with the skyline, sinks with it */}
      <m.div
        initial={{ opacity: 0, y: 40, scale: 0.7 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.8 }}
        transition={{ duration: 0.9, ease: ENTER_EASE }}
        style={{
          position: "absolute",
          bottom: "30%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,200,140,0.5) 0%, rgba(255,200,140,0) 70%)",
        }}
      />

      {/* welcome label — drops in from above, flies up on exit */}
      <m.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -32 }}
        transition={{ delay: 0.2, duration: 0.55, ease: ENTER_EASE }}
        style={{
          position: "absolute",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--fg)",
            letterSpacing: "-0.02em",
          }}
        >
          {dict.landedLabel}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-secondary)",
            marginTop: 4,
            letterSpacing: "0.06em",
          }}
        >
          UTC+9 · 14:08
        </div>
      </m.div>

      {/* skyline — three parallax building layers (varied silhouettes) */}
      <CitySkyline />
    </m.div>
  );
}

function CitySkyline() {
  return (
    <>
      {/* FAR: warm cream silhouettes, hazy */}
      <m.svg
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0, transition: { duration: 0.85 } }}
        transition={{ duration: 1.0, ease: ENTER_EASE }}
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 110,
        }}
      >
        <g fill="#cdbf9e" opacity="0.85">
          {/* flat */}
          <rect x="-4" y="62" width="20" height="40" />
          {/* sloped roof */}
          <path d="M16 100 L16 56 L34 44 L34 100 Z" />
          <rect x="34" y="60" width="14" height="40" />
          {/* pointed */}
          <path d="M50 100 L50 60 L62 48 L74 60 L74 100 Z" />
          <rect x="76" y="56" width="16" height="44" />
          <path d="M94 100 L94 58 L108 58 L108 50 L114 50 L114 100 Z" />
          <rect x="118" y="66" width="12" height="34" />
          {/* dome */}
          <rect x="132" y="60" width="16" height="40" />
          <ellipse cx="140" cy="60" rx="8" ry="4" />
          {/* sloped */}
          <path d="M150 100 L150 64 L168 52 L168 100 Z" />
          <rect x="172" y="62" width="14" height="38" />
          <rect x="200" y="58" width="18" height="42" />
          <path d="M220 100 L220 60 L228 50 L236 60 L236 100 Z" />
          <rect x="240" y="64" width="14" height="36" />
          <path d="M258 100 L258 56 L274 56 L274 50 L282 50 L282 100 Z" />
          <rect x="288" y="62" width="20" height="38" />
          {/* spire */}
          <path d="M312 100 L312 56 L322 42 L322 100 Z" />
          <rect x="324" y="60" width="14" height="40" />
          <path d="M342 100 L342 62 L352 50 L362 62 L362 100 Z" />
          <rect x="366" y="64" width="20" height="36" />
          <rect x="388" y="58" width="16" height="42" />
        </g>
      </m.svg>

      {/* MID: steel blue */}
      <m.svg
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0, transition: { duration: 0.9 } }}
        transition={{ duration: 0.95, delay: 0.1, ease: ENTER_EASE }}
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 110,
        }}
      >
        <g fill="#7986a3">
          {/* sloped */}
          <path d="M-4 100 L-4 60 L18 46 L18 100 Z" />
          <rect x="14" y="52" width="18" height="48" />
          {/* spire */}
          <path d="M34 100 L34 50 L42 38 L42 100 Z" />
          <rect x="44" y="56" width="16" height="44" />
          {/* pointed */}
          <path d="M64 100 L64 48 L78 32 L92 48 L92 100 Z" />
          <rect x="94" y="58" width="14" height="42" />
          {/* stepped */}
          <path d="M114 100 L114 46 L130 46 L130 38 L140 38 L140 100 Z" />
          <rect x="142" y="56" width="14" height="44" />
          {/* slim w/ antenna */}
          <rect x="160" y="42" width="10" height="58" />
          <line x1="165" y1="42" x2="165" y2="28" stroke="#7986a3" strokeWidth="1.5" />
          {/* dome */}
          <rect x="180" y="50" width="20" height="50" />
          <ellipse cx="190" cy="50" rx="10" ry="5" />
          {/* tall pointed */}
          <path d="M208 100 L208 38 L220 24 L232 38 L232 100 Z" />
          <rect x="234" y="48" width="16" height="52" />
          {/* sloped right */}
          <path d="M254 100 L254 56 L278 42 L278 100 Z" />
          <rect x="278" y="52" width="16" height="48" />
          {/* stepped */}
          <path d="M298 100 L298 50 L312 50 L312 42 L320 42 L320 100 Z" />
          <rect x="324" y="58" width="14" height="42" />
          {/* spire */}
          <path d="M342 100 L342 46 L350 34 L350 100 Z" />
          <rect x="352" y="54" width="20" height="46" />
          {/* dome */}
          <rect x="376" y="50" width="20" height="50" />
          <ellipse cx="386" cy="50" rx="10" ry="5" />
        </g>
      </m.svg>

      {/* FRONT: deep slate-blue silhouettes — most detailed shapes */}
      <m.svg
        initial={{ y: 130, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 150, opacity: 0, transition: { duration: 0.95 } }}
        transition={{ duration: 0.95, delay: 0.2, ease: ENTER_EASE }}
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 100,
        }}
      >
        <g fill="#384459">
          {/* leftmost stepped block */}
          <path d="M-4 100 L-4 70 L20 70 L20 58 L34 58 L34 100 Z" />
          {/* spire roof */}
          <path d="M30 100 L30 56 L42 42 L42 100 Z" />
          {/* slim w/ antenna */}
          <rect x="44" y="56" width="10" height="44" />
          <line x1="49" y1="56" x2="49" y2="38" stroke="#384459" strokeWidth="1.6" />
          {/* hipped roof */}
          <path d="M54 100 L54 58 L66 50 L78 58 L78 100 Z" />
          {/* short */}
          <rect x="78" y="74" width="16" height="26" />
          {/* tall pointed */}
          <path d="M96 100 L96 44 L110 28 L124 44 L124 100 Z" />
          {/* mid */}
          <rect x="124" y="60" width="14" height="40" />
          {/* dome */}
          <rect x="140" y="56" width="20" height="44" />
          <ellipse cx="150" cy="56" rx="10" ry="5" />
          {/* tall slim w/ stepped */}
          <path d="M164 100 L164 40 L176 40 L176 32 L182 32 L182 100 Z" />
          {/* spire w/ antenna */}
          <path d="M186 100 L186 48 L196 34 L196 100 Z" />
          <line x1="195" y1="34" x2="195" y2="18" stroke="#384459" strokeWidth="1.6" />
          {/* pointed wide */}
          <path d="M200 100 L200 52 L216 36 L232 52 L232 100 Z" />
          {/* mid sloped */}
          <path d="M232 100 L232 64 L252 50 L252 100 Z" />
          {/* short flat */}
          <rect x="252" y="64" width="16" height="36" />
          {/* tall stepped */}
          <path d="M270 100 L270 46 L286 46 L286 38 L294 38 L294 100 Z" />
          {/* slim w/ antenna */}
          <rect x="296" y="58" width="10" height="42" />
          <line x1="301" y1="58" x2="301" y2="40" stroke="#384459" strokeWidth="1.6" />
          {/* hipped */}
          <path d="M310 100 L310 60 L324 48 L338 60 L338 100 Z" />
          {/* tall pointed */}
          <path d="M338 100 L338 42 L350 28 L362 42 L362 100 Z" />
          {/* short dome */}
          <rect x="362" y="64" width="16" height="36" />
          <ellipse cx="370" cy="64" rx="8" ry="3.5" />
          {/* end stepped */}
          <path d="M380 100 L380 56 L394 56 L394 48 L404 48 L404 100 Z" />
        </g>
      </m.svg>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Phone screens                                                          */
/* ────────────────────────────────────────────────────────────────────── */

function Screen({
  children,
  enter,
  exit,
}: {
  children: React.ReactNode;
  enter?: { opacity?: number; y?: number; scale?: number; x?: number };
  exit?: { opacity?: number; y?: number; scale?: number; x?: number };
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 14, ...enter }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, y: -16, ...exit }}
      transition={{ duration: 0.5, ease: ENTER_EASE }}
      style={{
        position: "absolute",
        inset: 0,
        padding: "20px 18px 18px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </m.div>
  );
}

function OpenRoamScreen() {
  return (
    <Screen exit={{ scale: 0.7, opacity: 0 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <m.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <RoamLogo size={56} />
        </m.div>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          style={{ fontSize: 11, color: "var(--fg-secondary)", letterSpacing: "0.02em" }}
        >
          Wherever you go.
        </m.div>
      </div>
    </Screen>
  );
}

function BuyPlanScreen({ dict }: { dict: DemoDict }) {
  return (
    <Screen exit={{ y: -50, opacity: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--fg-muted)",
          marginBottom: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Destination
      </div>

      {/* country chips — selected one slides in highlighted */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflow: "hidden" }}>
        {[
          { label: "🇯🇵 Japan", selected: true },
          { label: "🇰🇷 Korea", selected: false },
          { label: "🇸🇬 SG", selected: false },
        ].map((c, i) => (
          <m.span
            key={c.label}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 + i * 0.08, duration: 0.35 }}
            style={{
              fontSize: 10,
              padding: "5px 9px",
              borderRadius: 999,
              background: c.selected ? "var(--fg)" : "rgba(0,0,0,0.04)",
              color: c.selected ? "#fff" : "var(--fg-secondary)",
              fontWeight: c.selected ? 600 : 500,
              whiteSpace: "nowrap",
            }}
          >
            {c.label}
          </m.span>
        ))}
      </div>

      {/* selected plan card */}
      <m.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.45 }}
        style={{
          borderRadius: 14,
          background: "#fff",
          boxShadow:
            "0 8px 22px rgba(0,0,0,0.06), inset 0 0 0 1.5px var(--accent)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          position: "relative",
        }}
      >
        {/* selected tag */}
        <m.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.3 }}
          style={{
            position: "absolute",
            top: -7,
            right: 10,
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            background: "var(--accent)",
            color: "#fff",
            padding: "2px 7px",
            borderRadius: 999,
          }}
        >
          POPULAR
        </m.span>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>
              {dict.planName}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--fg-secondary)",
                marginTop: 2,
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <span>{dict.planSize}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>4G/5G</span>
            </div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em" }}>
            {dict.planPrice}
          </div>
        </div>

        {/* Buy button with ripple */}
        <div style={{ position: "relative" }}>
          <m.button
            animate={{ scale: [1, 1, 0.94, 1] }}
            transition={{
              duration: STEP_MS / 1000,
              times: [0, 0.55, 0.62, 0.7],
              ease: "easeOut",
            }}
            style={{
              width: "100%",
              border: 0,
              borderRadius: 10,
              background: "#111",
              color: "#fff",
              padding: "10px 0",
              fontSize: 12,
              fontWeight: 600,
              cursor: "default",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {dict.buyCta}
            {/* ripple */}
            <m.span
              initial={{ scale: 0, opacity: 0.45 }}
              animate={{ scale: [0, 0, 4], opacity: [0.45, 0.45, 0] }}
              transition={{
                duration: STEP_MS / 1000,
                times: [0, 0.6, 0.85],
                ease: "easeOut",
              }}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 30,
                height: 30,
                marginLeft: -15,
                marginTop: -15,
                borderRadius: "50%",
                background: "rgba(15,184,180,0.7)",
                pointerEvents: "none",
              }}
            />
          </m.button>

          {/* animated tap cursor — drifts in, taps, fades */}
          <m.div
            initial={{ x: 60, y: -90, opacity: 0, scale: 1 }}
            animate={{
              x: [60, 10, 10, 10, 60],
              y: [-90, -10, -10, -10, -90],
              opacity: [0, 1, 1, 1, 0],
              scale: [1, 1, 0.7, 1, 1],
            }}
            transition={{
              duration: STEP_MS / 1000,
              times: [0, 0.5, 0.6, 0.7, 0.95],
              ease: "easeInOut",
            }}
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "rgba(17,17,17,0.85)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
              pointerEvents: "none",
              transformOrigin: "50% 50%",
            }}
          />
        </div>
      </m.div>

      {/* faded second plan */}
      <m.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 0.55 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        style={{
          marginTop: 8,
          borderRadius: 14,
          background: "rgba(255,255,255,0.55)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
          padding: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "var(--fg-muted)",
        }}
      >
        <span>Japan · 15 days · 10 GB</span>
        <span style={{ fontWeight: 600 }}>$22</span>
      </m.div>
    </Screen>
  );
}

function DownloadScreen({ dict }: { dict: DemoDict }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    /* Flip to "done" just before the step ends, so the celebration has a beat
       of its own before the next step takes over. */
    const id = setTimeout(() => setDone(true), STEP_MS - 700);
    return () => clearTimeout(id);
  }, []);

  return (
    <Screen exit={{ scale: 1.15, opacity: 0 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        {/* progress ring → success disc */}
        <div
          style={{
            position: "relative",
            width: 64,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AnimatePresence mode="wait">
            {!done ? (
              <m.div
                key="ring"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                animate={{ rotate: 360 }}
                transition={{
                  rotate: { duration: 1.6, repeat: Infinity, ease: "linear" },
                  opacity: { duration: 0.25 },
                  scale: { duration: 0.3 },
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "3px solid rgba(15,184,180,0.18)",
                  borderTopColor: "var(--accent)",
                }}
              />
            ) : (
              <m.div
                key="disc"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 18 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 0 8px rgba(15,184,180,0.18)",
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!done ? (
              <m.div
                key="dl"
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0, scale: 0.6 }}
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 12,
                  mass: 0.7,
                  delay: 0.15,
                }}
                style={{ position: "relative", zIndex: 1, lineHeight: 0 }}
              >
                <m.svg
                  animate={{ y: [0, 4, 0] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.6,
                  }}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 4v12" />
                  <path d="M6 12l6 6 6-6" />
                  <path d="M5 20h14" />
                </m.svg>
              </m.div>
            ) : (
              <m.svg
                key="check"
                initial={{ scale: 0.2, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 14,
                  mass: 0.7,
                  delay: 0.12,
                }}
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: "relative", zIndex: 1 }}
              >
                <m.path
                  d="M5 12.5l5 5L19 7"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.22, ease: "easeOut" }}
                />
              </m.svg>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <m.div
            key={done ? "done" : "downloading"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: "center" }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>
              {done ? dict.installedLabel : dict.downloadingLabel}
            </div>
            <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 4 }}>
              eSIM · 2.4 MB
            </div>
          </m.div>
        </AnimatePresence>

        <div
          style={{
            width: "70%",
            height: 4,
            borderRadius: 999,
            background: "rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <m.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: (STEP_MS - 700) / 1000, ease: "easeOut" }}
            style={{ height: "100%", background: "var(--accent)" }}
          />
        </div>
      </div>
    </Screen>
  );
}

/* Phone is in the corner — keep this minimal so it reads at a glance */
function AirplaneModeScreen() {
  return (
    <Screen exit={{ x: 60, opacity: 0 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <m.div
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ color: "var(--fg-muted)" }}
        >
          <Icon name="plane" size={40} strokeWidth={1.5} />
        </m.div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--fg-secondary)",
            letterSpacing: "0.04em",
          }}
        >
          AIRPLANE MODE
        </div>
      </div>
    </Screen>
  );
}

function LandedMiniScreen({ dict }: { dict: DemoDict }) {
  return (
    <Screen exit={{ scale: 0.7, opacity: 0 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <m.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ color: "var(--accent)" }}
        >
          <Icon name="map" size={32} strokeWidth={1.6} />
        </m.div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)" }}>Tokyo</div>
          <div style={{ fontSize: 9.5, color: "var(--fg-muted)", marginTop: 3 }}>
            {dict.carrierLabel}
          </div>
        </div>
      </div>
    </Screen>
  );
}

function ActivateScreen({ dict }: { dict: DemoDict }) {
  return (
    <Screen exit={{ y: 40, opacity: 0 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 50 }}>
          {[10, 20, 32, 46].map((h, i) => (
            <m.span
              key={i}
              initial={{ height: 4, opacity: 0.3 }}
              animate={{ height: h, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.18, duration: 0.45, ease: "easeOut" }}
              style={{
                width: 9,
                borderRadius: 3,
                background: "var(--accent)",
                display: "block",
              }}
            />
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>
            {dict.activatingLabel}
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 4 }}>
            {dict.carrierLabel}
          </div>
        </div>
      </div>
    </Screen>
  );
}

function ConnectedScreen({ dict }: { dict: DemoDict }) {
  /* 1.6 GB used out of 5 GB → 32% used / 68% remaining. */
  const USED_PCT = 32;

  return (
    <Screen exit={{ scale: 1.15, opacity: 0 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          paddingTop: 8,
        }}
      >
        {/* small check + connected status */}
        <m.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1.4, 0.36, 1] }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px 5px 6px",
            borderRadius: 999,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="check" size={11} strokeWidth={3.5} />
          </span>
          {dict.connectedLabel} · {dict.carrierLabel}
        </m.div>

        {/* usage card — the highlight */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          style={{
            width: "82%",
            borderRadius: 16,
            background: "#fff",
            boxShadow:
              "0 12px 30px -10px rgba(15,184,180,0.18), inset 0 0 0 1px rgba(0,0,0,0.05)",
            padding: "14px 14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10,
              color: "var(--fg-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            <span>{dict.usageLabel}</span>
            <m.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 8.5,
                color: "var(--accent)",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--accent)",
                }}
              />
              LIVE
            </m.span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <m.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: "var(--fg)",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {dict.usageRemaining}
            </m.span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-secondary)" }}>
              GB
            </span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--fg-muted)" }}>
              {dict.usageOf}
            </span>
          </div>

          {/* progress: USED portion fills */}
          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: "rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}
          >
            <m.div
              initial={{ width: "0%" }}
              animate={{ width: `${USED_PCT}%` }}
              transition={{ delay: 0.55, duration: 0.95, ease: "easeOut" }}
              style={{ height: "100%", background: "var(--accent)" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--fg-muted)",
            }}
          >
            <span>{dict.usageDaysLeft}</span>
            <span>{dict.carrierLabel}</span>
          </div>
        </m.div>
      </div>
    </Screen>
  );
}
