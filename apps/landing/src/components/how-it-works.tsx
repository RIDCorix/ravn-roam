import { Icon, type IconName } from "./icons";
import { Reveal } from "./reveal";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const stepIcons: IconName[] = ["map", "qr", "plane"];

export function HowItWorks({ dict }: { dict: Dictionary["howItWorks"] }) {
  return (
    <section
      id="how-it-works"
      className="r-section"
      style={{ padding: "64px 24px 80px", scrollMarginTop: 80 }}
    >
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
            <Reveal y={12}>
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
                  lineHeight: 1.04,
                  color: "var(--fg)",
                  textWrap: "balance",
                }}
              >
                {dict.title}
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
                maxWidth: 360,
                textWrap: "pretty",
              }}
            >
              {dict.subtitle}
            </p>
          </Reveal>
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
              <Reveal
                key={number}
                delay={0.08 + idx * 0.1}
                y={22}
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: "var(--accent-softer)",
                      color: "var(--accent)",
                      boxShadow:
                        "inset 0 0 0 1px rgba(15, 184, 180, 0.18)",
                    }}
                  >
                    <Icon name={stepIcons[idx] ?? "map"} size={24} />
                  </span>
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
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
