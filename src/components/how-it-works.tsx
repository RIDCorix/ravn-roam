import { Icon, type IconName } from "./icons";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const stepIcons: IconName[] = ["map", "qr", "plane"];

export function HowItWorks({ dict }: { dict: Dictionary["howItWorks"] }) {
  return (
    <section className="r-section" style={{ padding: "64px 24px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          className="r-section-head"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
            marginBottom: 40,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 620 }}>
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
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4.2vw, 52px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 1.04,
                color: "var(--fg)",
                textWrap: "balance",
              }}
            >
              {dict.title}
            </h2>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--fg-secondary)",
              maxWidth: 360,
              textWrap: "pretty",
            }}
          >
            {dict.subtitle}
          </p>
        </div>

        <div
          className="r-grid-3"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 8,
          }}
        >
          {dict.steps.map((s, idx) => {
            const number = String(idx + 1).padStart(2, "0");
            return (
              <div
                key={number}
                style={{
                  position: "relative",
                  padding: "32px 8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  minHeight: 220,
                  borderTop: "1px solid rgba(17,17,32,0.08)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 14 }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-muted)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {number}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: "var(--accent-softer)",
                      color: "var(--accent)",
                    }}
                  >
                    <Icon name={stepIcons[idx] ?? "map"} size={16} />
                  </span>
                </div>

                <div>
                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: "var(--fg)",
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14.5,
                      lineHeight: 1.55,
                      color: "var(--fg-secondary)",
                      textWrap: "pretty",
                      maxWidth: 320,
                    }}
                  >
                    {s.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
