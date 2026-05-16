"use client";

import type { Dictionary } from "@/app/[lang]/dictionaries";

/* Continuous left-scrolling marquee — no controls, no slide-by-slide.
   Items are rendered twice; CSS animates the track from 0 → -50%, which
   lands exactly at the start of the duplicate copy, so the loop is seamless.
   Edges are masked so cards fade in/out instead of clipping hard. */

const LOOP_SECONDS = 50;

export function ReviewsCarousel({
  items,
}: {
  items: Dictionary["reviews"]["items"];
}) {
  /* Duplicate items so the loop is seamless. Aria-hide the second copy
     since it's purely visual filler — screen readers see one set. */
  return (
    <div className="r-reviews-mask">
      <div className="r-reviews-marquee">
        {items.map((item, i) => (
          <ReviewCard key={`a-${i}`} item={item} />
        ))}
        {items.map((item, i) => (
          <ReviewCard key={`b-${i}`} item={item} ariaHidden />
        ))}
      </div>

      <style>{`
        @keyframes r-reviews-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .r-reviews-mask {
          overflow: hidden;
          mask-image: linear-gradient(
            to right,
            transparent 0,
            black 64px,
            black calc(100% - 64px),
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0,
            black 64px,
            black calc(100% - 64px),
            transparent 100%
          );
        }
        .r-reviews-marquee {
          display: flex;
          gap: 20px;
          width: max-content;
          animation: r-reviews-marquee ${LOOP_SECONDS}s linear infinite;
          will-change: transform;
        }
        /* Pause on hover so people can read a card that catches their eye. */
        .r-reviews-mask:hover .r-reviews-marquee {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .r-reviews-marquee { animation: none; }
        }
      `}</style>
    </div>
  );
}

function ReviewCard({
  item,
  ariaHidden = false,
}: {
  item: Dictionary["reviews"]["items"][number];
  ariaHidden?: boolean;
}) {
  return (
    <article
      aria-hidden={ariaHidden || undefined}
      style={{
        flex: "0 0 auto",
        width: "min(380px, 82vw)",
        background: "var(--surface)",
        border: "1px solid rgba(17,17,32,0.06)",
        borderRadius: 20,
        padding: "24px 24px 22px",
        boxShadow:
          "0 8px 24px rgba(17,17,32,0.06), 0 2px 6px rgba(17,17,32,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "5px 10px 5px 6px",
          background: "var(--accent-softer)",
          color: "var(--accent)",
          borderRadius: 999,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: "0.04em",
          width: "fit-content",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--accent)",
          }}
        />
        {item.from} → {item.to}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.55,
          color: "var(--fg)",
          textWrap: "pretty",
          letterSpacing: "-0.005em",
        }}
      >
        &ldquo;{item.quote}&rdquo;
      </p>
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingTop: 12,
          borderTop: "1px solid rgba(17,17,32,0.06)",
        }}
      >
        {/* Avatar placeholder — soft teal disc with the first character of
            the name. Works for both CJK and Latin names. */}
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, var(--accent-soft) 0%, var(--accent-softer) 100%)",
            boxShadow: "inset 0 0 0 1px rgba(15,184,180,0.22)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: "-0.01em",
          }}
        >
          {firstChar(item.name)}
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--fg)",
            }}
          >
            {item.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            {item.role}
          </div>
        </div>
      </div>
    </article>
  );
}

/* Grab the first non-whitespace character of a name for the avatar disc.
   Works for CJK (first character is meaningful) and Latin (first letter,
   uppercased). Returns empty string for empty input so the disc just sits
   as a blank chip instead of crashing. */
function firstChar(name: string): string {
  if (!name) return "";
  const ch = Array.from(name.trim())[0] ?? "";
  return ch.toUpperCase();
}
