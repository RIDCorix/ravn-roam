"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";

const AUTO_MS = 6000;

export function ReviewsCarousel({
  items,
  controls,
}: {
  items: Dictionary["reviews"]["items"];
  controls: Dictionary["reviews"]["controls"];
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[i] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, items.length]);

  useEffect(() => {
    scrollTo(index);
  }, [index, scrollTo]);

  // Track scroll → keep index in sync when user swipes manually
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const children = Array.from(track.children) as HTMLElement[];
        const center = track.scrollLeft + track.offsetWidth / 2;
        const nearest = children.reduce(
          (acc, el, i) => {
            const elCenter = el.offsetLeft + el.offsetWidth / 2;
            const d = Math.abs(elCenter - center);
            return d < acc.d ? { i, d } : acc;
          },
          { i: 0, d: Infinity },
        );
        setIndex(nearest.i);
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: "flex",
          gap: 20,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          paddingBottom: 4,
        }}
        className="r-reviews-track"
      >
        {items.map((item, i) => (
          <article
            key={`${item.from}-${item.to}-${i}`}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${items.length}`}
            style={{
              flex: "0 0 min(420px, 86%)",
              scrollSnapAlign: "center",
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
                flexDirection: "column",
                gap: 2,
                paddingTop: 12,
                borderTop: "1px solid rgba(17,17,32,0.06)",
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
          </article>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${controls.goTo} ${i + 1}`}
              onClick={() => setIndex(i)}
              style={{
                width: i === index ? 22 : 6,
                height: 6,
                borderRadius: 999,
                border: 0,
                padding: 0,
                background:
                  i === index ? "var(--fg)" : "rgba(17,17,32,0.18)",
                cursor: "pointer",
                transition:
                  "width 220ms var(--ease-out-soft), background 220ms var(--ease-out-soft)",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <CarouselButton
            aria-label={controls.prev}
            onClick={() => setIndex((prev) => (prev - 1 + items.length) % items.length)}
          >
            ←
          </CarouselButton>
          <CarouselButton
            aria-label={controls.next}
            onClick={() => setIndex((prev) => (prev + 1) % items.length)}
          >
            →
          </CarouselButton>
        </div>
      </div>

      <style>{`
        .r-reviews-track::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function CarouselButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: "1px solid rgba(17,17,32,0.10)",
        background: "var(--surface)",
        color: "var(--fg)",
        fontSize: 16,
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
        transition:
          "border-color 180ms var(--ease-out-soft), background 180ms var(--ease-out-soft)",
      }}
    >
      {children}
    </button>
  );
}
