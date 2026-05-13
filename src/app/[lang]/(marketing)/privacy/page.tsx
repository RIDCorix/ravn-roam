import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getDictionary, hasLocale } from "../../dictionaries";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const p = dict.privacy;

  return (
    <article>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        subtitle={p.subtitle}
        backLabel={dict.page.back}
        currentLocale={lang}
      />
      <section style={{ padding: "0 24px 96px" }}>
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--fg-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {dict.page.lastUpdated} · {p.lastUpdatedAt}
          </div>

          {p.sections.map((section) => (
            <section
              key={section.title}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                paddingTop: 24,
                borderTop: "1px solid rgba(17,17,32,0.08)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "var(--fg)",
                }}
              >
                {section.title}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 15.5,
                  lineHeight: 1.6,
                  color: "var(--fg-secondary)",
                  textWrap: "pretty",
                }}
              >
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </section>
    </article>
  );
}
