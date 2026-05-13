import Link from "next/link";

import type { Dictionary, Locale } from "@/app/[lang]/dictionaries";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  backLabel,
  currentLocale,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  backLabel: Dictionary["page"]["back"];
  currentLocale: Locale;
}) {
  return (
    <header
      className="r-page-header"
      style={{ padding: "56px 24px 32px" }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Link
          href={`/${currentLocale}`}
          style={{
            fontSize: 13,
            color: "var(--fg-secondary)",
            textDecoration: "none",
            width: "fit-content",
          }}
        >
          {backLabel}
        </Link>
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
        {subtitle ? (
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
        ) : null}
      </div>
    </header>
  );
}
