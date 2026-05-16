"use client";

import dynamic from "next/dynamic";

import { Reveal } from "./reveal";
import { TravelerBadge } from "./traveler-badge";
import type { Dictionary } from "@/app/[lang]/dictionaries";

/* CollectionMap pulls in d3-geo + topojson-client + world-atlas (~150KB).
   Lazy-load so it stays out of the initial bundle and only ships when the
   user scrolls into the section. SSR off because the map is purely visual
   eye candy — no SEO value to render at SSR time. */
const CollectionMap = dynamic(
  () =>
    import("./collection-map").then((m) => ({
      default: m.CollectionMap,
    })),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

export function TravelLog({ dict }: { dict: Dictionary["journey"] }) {
  return (
    <section
      id="travel-log"
      className="r-section"
      style={{ padding: "64px 24px 96px", scrollMarginTop: 80 }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        {/* Section heading — full-width above the two cards. */}
        <div
          className="r-section-head"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 620 }}>
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
                {dict.titleLead}{" "}
                <span
                  style={{
                    fontStyle: "italic",
                    fontWeight: 500,
                    color: "var(--accent)",
                  }}
                >
                  {dict.titleAccent}
                </span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.16}>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.55,
                color: "var(--fg-secondary)",
                maxWidth: 380,
                textWrap: "pretty",
              }}
            >
              {dict.subtitle}
            </p>
          </Reveal>
        </div>

        {/* Two-card grid */}
        <div
          className="r-journey-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.82fr) minmax(0, 1.18fr)",
            gap: 28,
            alignItems: "stretch",
          }}
        >
          <Reveal delay={0.05} y={28}>
            <TravelerBadge dict={dict.traveler} />
          </Reveal>
          <Reveal delay={0.15} y={28}>
            <CollectionMap dict={dict.map} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function MapSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        height: "100%",
        minHeight: 420,
        borderRadius: 24,
        background:
          "linear-gradient(160deg, #fdfaf2 0%, #f6efe1 100%)",
        boxShadow: "inset 0 0 0 1px rgba(80,60,30,0.08)",
      }}
    />
  );
}
