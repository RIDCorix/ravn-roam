import { Icon } from "./icons";
import { Button } from "./button";
import { PhoneDemo } from "./phone-demo";
import { Reveal } from "./reveal";
import type { Dictionary, Locale } from "@/app/[lang]/dictionaries";
import { localized } from "@/lib/href";

export function Hero({
  dict,
  currentLocale,
}: {
  dict: Dictionary["hero"];
  currentLocale: Locale;
}) {
  /* Primary CTA goes to the plans page (conversion intent matches the
     "Get an eSIM" button). Secondary stays on the home anchor for users
     who want to scan coverage before committing. */
  const primaryHref = localized("/plans", currentLocale);
  const secondaryHref = localized("/#coverage", currentLocale);
  return (
    <section
      className="r-hero"
      style={{
        position: "relative",
        padding: "56px 24px 80px",
        overflow: "hidden",
      }}
    >
      <div
        className="r-hero-grid"
        style={{
          position: "relative",
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
          gap: 48,
          alignItems: "center",
        }}
      >
        {/* Left: copy + CTAs */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 26,
          }}
        >

          <Reveal inView={false} delay={0.08}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(40px, 5.6vw, 72px)",
                fontWeight: 700,
                letterSpacing: "-0.045em",
                lineHeight: 0.98,
                color: "var(--fg)",
                maxWidth: 560,
                textWrap: "balance",
              }}
            >
              {dict.headlineLead}{" "}
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 500,
                  color: "var(--accent)",
                }}
              >
                {dict.headlineAccent}
              </span>
            </h1>
          </Reveal>

          <Reveal inView={false} delay={0.18}>
            <p
              style={{
                margin: 0,
                maxWidth: 480,
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--fg-secondary)",
                textWrap: "pretty",
              }}
            >
              {dict.subtitle}
            </p>
          </Reveal>

          <Reveal inView={false} delay={0.28}>
            <div
              className="r-hero-ctas"
              style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}
            >
              <Button size="lg" href={primaryHref}>
                {dict.ctaPrimary}
                <Icon name="arrowRight" size={14} />
              </Button>
              <Button size="lg" variant="ghost" href={secondaryHref}>
                {dict.ctaSecondary}
              </Button>
            </div>
          </Reveal>

          <Reveal inView={false} delay={0.36}>
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
              {dict.deviceFootnote}
            </div>
          </Reveal>
        </div>

        {/* Right: animated phone demo */}
        <div
          className="r-hero-demo"
          style={{
            position: "relative",
            width: "100%",
            minHeight: 600,
            display: "flex",
            alignItems: "stretch",
          }}
        >
          <PhoneDemo dict={dict.demo} />
        </div>
      </div>
    </section>
  );
}
