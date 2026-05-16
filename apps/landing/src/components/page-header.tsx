import Link from "next/link";

import { Reveal } from "./reveal";
import type { Dictionary, Locale } from "@/app/[lang]/dictionaries";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  homeLabel,
  currentLocale,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /* Localized label for the home breadcrumb root, e.g. "Home" / "首頁". */
  homeLabel: Dictionary["page"]["home"];
  currentLocale: Locale;
}) {
  return (
    <header className="r-page-header" style={{ padding: "56px 24px 32px" }}>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Reveal inView={false} y={12}>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--fg-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 500,
            }}
          >
            {eyebrow}
          </div>
        </Reveal>
        <Reveal inView={false} delay={0.08}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 5vw, 56px)",
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 1.04,
              color: "var(--fg)",
              textWrap: "balance",
            }}
          >
            {title}
          </h1>
        </Reveal>
        {subtitle ? (
          <Reveal inView={false} delay={0.18}>
            <p
              style={{
                margin: 0,
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--fg-secondary)",
                textWrap: "pretty",
              }}
            >
              {subtitle}
            </p>
          </Reveal>
        ) : null}
      </div>
    </header>
  );
}
