"use client";

import { m, useInView } from "motion/react";
import { useRef } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";

const ENTER_EASE = [0.22, 0.61, 0.36, 1] as const;

/* Editorial premium feel: deep ink background, hairline rules, big-but-thin
   numeral typography. No halos, no sparkles, no pulsing — the level itself
   is the hero, treated like a Hermès / Aesop product card. */
export function TravelerBadge({
  dict,
}: {
  dict: Dictionary["journey"]["traveler"];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const xpPct = (dict.xpCurrent / dict.xpNext) * 100;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        height: "100%",
        minHeight: 420,
        borderRadius: 24,
        background:
          "linear-gradient(170deg, #0c1922 0%, #0a1b21 50%, #0c1d22 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(250,245,230,0.06), 0 30px 60px -24px rgba(0,0,0,0.35)",
        padding: "36px 34px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        color: "#faf5e6",
        overflow: "hidden",
      }}
    >
      {/* faint typographic watermark — subtle textural element, restrained */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -12,
          bottom: -32,
          fontSize: 220,
          fontWeight: 200,
          color: "rgba(250,245,230,0.025)",
          letterSpacing: "-0.08em",
          lineHeight: 1,
          pointerEvents: "none",
          fontFamily: "var(--font-inter)",
        }}
      >
        {dict.level}
      </div>

      {/* top eyebrow row */}
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 10.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(250,245,230,0.55)",
          fontWeight: 600,
        }}
      >
        <span>Traveler</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>
          {dict.levelLabel} · {dict.level}
        </span>
      </div>

      {/* Hero block: huge thin numeral + title */}
      <div style={{ position: "relative", flex: "0 0 auto" }}>
        <m.div
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.7, ease: ENTER_EASE }}
          style={{
            fontSize: "clamp(96px, 11vw, 132px)",
            fontWeight: 200,
            letterSpacing: "-0.06em",
            lineHeight: 0.9,
            color: "#fefcf5",
            fontFamily: "var(--font-inter)",
          }}
        >
          {dict.level}
        </m.div>
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.35, duration: 0.5 }}
          style={{
            marginTop: 6,
            fontSize: 17,
            fontWeight: 500,
            color: "rgba(250,245,230,0.78)",
            letterSpacing: "-0.01em",
          }}
        >
          {dict.title}
        </m.div>
      </div>

      {/* hairline */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, rgba(250,245,230,0.14) 0%, rgba(250,245,230,0) 100%)",
        }}
      />

      {/* XP — single thin line, no glow */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: 10.5,
            color: "rgba(250,245,230,0.5)",
            marginBottom: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <span>Experience</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
              color: "rgba(250,245,230,0.72)",
            }}
          >
            {dict.xpCurrent.toLocaleString()} /{" "}
            {dict.xpNext.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            height: 2,
            background: "rgba(250,245,230,0.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <m.div
            initial={{ width: "0%" }}
            animate={inView ? { width: `${xpPct}%` } : {}}
            transition={{ duration: 1.4, delay: 0.6, ease: "easeOut" }}
            style={{
              height: "100%",
              background: "var(--accent)",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "rgba(250,245,230,0.4)",
            letterSpacing: "0.04em",
          }}
        >
          {dict.nextLevelHint}
        </div>
      </div>

      {/* hairline */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, rgba(250,245,230,0.14) 0%, rgba(250,245,230,0) 100%)",
        }}
      />

      {/* Stats — tabular, restrained */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${dict.stats.length}, 1fr)`,
          gap: 8,
          marginTop: "auto",
        }}
      >
        {dict.stats.map((s, i) => (
          <m.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.75 + i * 0.07, duration: 0.45 }}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "#fefcf5",
                letterSpacing: "-0.02em",
                fontFamily: "var(--font-inter)",
              }}
            >
              {s.value}
            </span>
            <span
              style={{
                fontSize: 9.5,
                color: "rgba(250,245,230,0.48)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontWeight: 600,
              }}
            >
              {s.label}
            </span>
          </m.div>
        ))}
      </div>
    </div>
  );
}
