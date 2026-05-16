"use client";

import { m, useInView } from "motion/react";
import { useRef } from "react";

import { Reveal } from "./reveal";
import type { Dictionary } from "@/app/[lang]/dictionaries";

type UsageDict = Dictionary["usage"];

/* The product highlight: live remaining-data visibility.
   Slogan-led layout — text on the left, an oversized animated usage card on
   the right. The whole right card replays its key animation each time the
   section scrolls into view so the "live" feel stays visible. */
export function UsageHighlight({ dict }: { dict: UsageDict }) {
  return (
    <section
      id="live-usage"
      className="r-section"
      style={{ padding: "64px 24px 96px", scrollMarginTop: 80 }}
    >
      <div
        className="r-usage-grid"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 56,
          alignItems: "center",
        }}
      >
        {/* Left: slogan + body */}
        <div style={{ maxWidth: 520 }}>
          <Reveal y={10}>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--fg-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 500,
                marginBottom: 14,
              }}
            >
              {dict.eyebrow}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4.2vw, 52px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 1.06,
                color: "var(--fg)",
                textWrap: "balance",
              }}
            >
              {dict.title}
            </h2>
          </Reveal>

          <Reveal delay={0.18}>
            <p
              style={{
                margin: "20px 0 0",
                fontSize: 16.5,
                lineHeight: 1.6,
                color: "var(--fg-secondary)",
                maxWidth: 460,
                textWrap: "pretty",
              }}
            >
              {dict.subtitle}
            </p>
          </Reveal>
        </div>

        {/* Right: animated usage card mock */}
        <Reveal delay={0.1} y={28}>
          <UsageCard dict={dict.card} />
        </Reveal>
      </div>
    </section>
  );
}

function UsageCard({ dict }: { dict: UsageDict["card"] }) {
  /* 1.6 GB used of 5 GB → 32% used (68% remaining). */
  const USED_PCT = 32;

  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 420,
        marginLeft: "auto",
        borderRadius: 28,
        background:
          "linear-gradient(160deg, #ffffff 0%, #fbfaf7 100%)",
        boxShadow:
          "0 30px 60px -20px rgba(15,184,180,0.18), 0 8px 24px -8px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.04)",
        padding: "26px 26px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* header: plan + LIVE tag */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--fg-secondary)",
            letterSpacing: "0.02em",
          }}
        >
          {dict.planLabel}
        </div>
        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontWeight: 700,
            color: "var(--accent)",
            letterSpacing: "0.1em",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
          {dict.liveTag}
        </m.span>
      </div>

      {/* the headline number */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <m.span
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 0.61, 0.36, 1] }}
            style={{
              fontSize: "clamp(56px, 7vw, 82px)",
              fontWeight: 700,
              color: "var(--fg)",
              letterSpacing: "-0.045em",
              lineHeight: 0.95,
            }}
          >
            {dict.remainingNumber}
          </m.span>
          <m.span
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.35 }}
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "var(--fg-secondary)",
              letterSpacing: "-0.02em",
            }}
          >
            {dict.remainingUnit}
          </m.span>
          <m.span
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.45 }}
            style={{
              marginLeft: "auto",
              fontSize: 13,
              color: "var(--fg-muted)",
              fontWeight: 500,
              alignSelf: "flex-end",
              paddingBottom: 8,
            }}
          >
            {dict.ofTotal}
          </m.span>
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            color: "var(--fg-secondary)",
          }}
        >
          {dict.remainingCaption}
        </div>
      </div>

      {/* progress bar */}
      <div>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <m.div
            initial={{ width: "0%" }}
            animate={inView ? { width: `${USED_PCT}%` } : {}}
            transition={{ duration: 1.0, delay: 0.5, ease: "easeOut" }}
            style={{
              height: "100%",
              background:
                "linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%)",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--fg-muted)",
          }}
        >
          <span>{dict.daysLeft}</span>
          <span>{dict.footnote}</span>
        </div>
      </div>
    </div>
  );
}
