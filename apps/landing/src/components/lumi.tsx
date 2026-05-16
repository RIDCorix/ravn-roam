"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";

/* Direction Lumi's eyes track toward. Offsets are small so the eyes nudge
   rather than dart — character feel, not robot. */
export type LumiLook =
  | "center"
  | "left"
  | "right"
  | "up"
  | "down"
  | "upLeft"
  | "upRight";

/* Discrete expressions. Each maps to specific eye + mouth geometry and
   optional accessories (thought dots, sparkles). */
export type LumiExpression =
  | "neutral"
  | "happy"
  | "thinking"
  | "speaking"
  | "listening";

const LOOK_OFFSET: Record<LumiLook, { x: number; y: number }> = {
  center: { x: 0, y: 0 },
  left: { x: -3, y: 0 },
  right: { x: 3, y: 0 },
  up: { x: 0, y: -2.5 },
  down: { x: 0, y: 2 },
  upLeft: { x: -2.5, y: -2 },
  upRight: { x: 2.5, y: -2 },
};

interface LumiProps {
  size?: number;
  look?: LumiLook;
  expression?: LumiExpression;
  /* Idle animations (bob + occasional blinks). Defaults on. Pass false to
     freeze for static contexts (e.g. og:image, screenshots). */
  idle?: boolean;
}

export function Lumi({
  size = 88,
  look = "center",
  expression = "neutral",
  idle = true,
}: LumiProps) {
  const offset = LOOK_OFFSET[look];
  const [blinking, setBlinking] = useState(false);

  /* Random blinks every 2.5–5s. Cleared on unmount so dev hot-reload doesn't
     stack timers. */
  useEffect(() => {
    if (!idle) return;
    let cancelled = false;
    let nextTimer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = 2500 + Math.random() * 2500;
      nextTimer = setTimeout(() => {
        if (cancelled) return;
        setBlinking(true);
        setTimeout(() => {
          if (cancelled) return;
          setBlinking(false);
          scheduleNext();
        }, 130);
      }, delay);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(nextTimer);
    };
  }, [idle]);

  /* Eye opening factor: 1 = wide, 0 = closed. Happy = squint, blink = closed. */
  const eyeOpenY = blinking ? 0.08 : expression === "happy" ? 0.4 : 1;

  return (
    <m.svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      style={{ overflow: "visible", display: "block" }}
      aria-label="Lumi"
      role="img"
      animate={idle ? { y: [0, -2.5, 0] } : { y: 0 }}
      transition={
        idle
          ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.3 }
      }
    >
      <defs>
        <radialGradient id="lumi-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(15,184,180,0.45)" />
          <stop offset="60%" stopColor="rgba(15,184,180,0.1)" />
          <stop offset="100%" stopColor="rgba(15,184,180,0)" />
        </radialGradient>
        <linearGradient id="lumi-body" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#22d3cf" />
          <stop offset="100%" stopColor="#0a8784" />
        </linearGradient>
        <radialGradient id="lumi-sheen" cx="30%" cy="20%" r="40%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* pulsing halo */}
      <m.circle
        r="44"
        fill="url(#lumi-glow)"
        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.95, 0.55] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* body */}
      <circle r="32" fill="url(#lumi-body)" />

      {/* sheen highlight */}
      <ellipse cx="-9" cy="-13" rx="14" ry="9" fill="url(#lumi-sheen)" />

      {/* eyes & mouth — translated as a group when looking around */}
      <m.g
        animate={{ x: offset.x, y: offset.y }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        {/* left eye */}
        <m.ellipse
          cx="-10"
          cy={expression === "happy" ? -2 : -3}
          rx="3.6"
          animate={{
            ry: 4.2 * eyeOpenY,
            cy: expression === "happy" ? -2 : -3,
          }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          fill="#0a2e2c"
        />
        {/* eye highlight (catchlight) */}
        {!blinking && expression !== "happy" && (
          <circle cx="-9" cy="-4.5" r="0.9" fill="#fff" opacity="0.85" />
        )}

        {/* right eye */}
        <m.ellipse
          cx="10"
          cy={expression === "happy" ? -2 : -3}
          rx="3.6"
          animate={{
            ry: 4.2 * eyeOpenY,
            cy: expression === "happy" ? -2 : -3,
          }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          fill="#0a2e2c"
        />
        {!blinking && expression !== "happy" && (
          <circle cx="11" cy="-4.5" r="0.9" fill="#fff" opacity="0.85" />
        )}

        {/* happy: smile arcs over the eyes */}
        {expression === "happy" && (
          <>
            <path
              d="M -13 -4 Q -10 -7 -7 -4"
              stroke="#0a2e2c"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 7 -4 Q 10 -7 13 -4"
              stroke="#0a2e2c"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
          </>
        )}

        <Mouth expression={expression} />
      </m.g>

      {/* thinking dots floating above the head */}
      <AnimatePresence>
        {expression === "thinking" && (
          <m.g
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {[0, 1, 2].map((i) => (
              <m.circle
                key={i}
                cx={-14 + i * 8}
                cy={-44}
                r={1.4 + i * 0.6}
                fill="rgba(15,184,180,0.85)"
                animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
                transition={{
                  duration: 1.3,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: "easeInOut",
                }}
              />
            ))}
          </m.g>
        )}
      </AnimatePresence>

      {/* speaking: subtle sound-wave arcs to the right */}
      <AnimatePresence>
        {expression === "speaking" && (
          <m.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {[0, 1, 2].map((i) => (
              <m.path
                key={i}
                d={`M ${36 + i * 4} ${-4 + i * 2} q 4 4 0 8`}
                stroke="var(--accent)"
                strokeWidth={1.4 - i * 0.2}
                strokeLinecap="round"
                fill="none"
                animate={{ opacity: [0.15, 0.85, 0.15] }}
                transition={{
                  duration: 1.0,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: "easeInOut",
                }}
              />
            ))}
          </m.g>
        )}
      </AnimatePresence>

      {/* happy: occasional sparkle */}
      <AnimatePresence>
        {expression === "happy" && (
          <m.g
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Sparkle x={28} y={-26} size={5} delay={0} />
            <Sparkle x={-32} y={-18} size={3.5} delay={0.4} />
            <Sparkle x={30} y={22} size={3} delay={0.7} />
          </m.g>
        )}
      </AnimatePresence>
    </m.svg>
  );
}

function Mouth({ expression }: { expression: LumiExpression }) {
  if (expression === "happy") {
    return (
      <path
        d="M -7 5 Q 0 12 7 5"
        stroke="#0a2e2c"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  if (expression === "speaking") {
    return (
      <m.ellipse
        cx="0"
        cy="9"
        rx="4"
        animate={{ ry: [1.2, 4, 1.8, 3.5, 1.2] }}
        transition={{ duration: 0.75, repeat: Infinity, ease: "easeInOut" }}
        fill="#0a2e2c"
      />
    );
  }
  if (expression === "listening") {
    /* small open "o" — taking in what you said */
    return <ellipse cx="0" cy="9" rx="2" ry="1.4" fill="#0a2e2c" />;
  }
  if (expression === "thinking") {
    /* tiny, off-center — distracted */
    return <ellipse cx="-1" cy="9" rx="1.5" ry="0.6" fill="#0a2e2c" />;
  }
  /* neutral: subtle line */
  return (
    <line
      x1="-5"
      y1="9"
      x2="5"
      y2="9"
      stroke="#0a2e2c"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  );
}

function Sparkle({
  x,
  y,
  size,
  delay,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
}) {
  return (
    <m.path
      d={`M ${x} ${y - size} L ${x + size * 0.3} ${y - size * 0.3} L ${x + size} ${y} L ${x + size * 0.3} ${y + size * 0.3} L ${x} ${y + size} L ${x - size * 0.3} ${y + size * 0.3} L ${x - size} ${y} L ${x - size * 0.3} ${y - size * 0.3} Z`}
      fill="var(--accent)"
      animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
      transition={{
        duration: 1.6,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
      style={{ transformOrigin: `${x}px ${y}px`, transformBox: "fill-box" }}
    />
  );
}
