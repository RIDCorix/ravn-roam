import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getDictionary, hasLocale } from "../../dictionaries";

export default async function FaqPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const f = dict.faq;

  return (
    <article>
      <PageHeader
        eyebrow={f.eyebrow}
        title={f.title}
        subtitle={f.subtitle}
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
            gap: 48,
          }}
        >
          {f.groups.map((group) => (
            <section
              key={group.anchor}
              id={group.anchor}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                scrollMarginTop: 80,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--fg-muted)",
                }}
              >
                {group.title}
              </h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                {group.items.map((item, idx) => (
                  <details
                    key={item.q}
                    style={{
                      padding: "20px 0",
                      borderTop:
                        idx === 0
                          ? "1px solid rgba(17,17,32,0.08)"
                          : "1px solid rgba(17,17,32,0.06)",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        listStyle: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        fontSize: 16,
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        color: "var(--fg)",
                      }}
                    >
                      <span>{item.q}</span>
                      <span
                        aria-hidden
                        style={{
                          color: "var(--fg-muted)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        +
                      </span>
                    </summary>
                    <p
                      style={{
                        margin: "10px 0 0",
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "var(--fg-secondary)",
                        textWrap: "pretty",
                      }}
                    >
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </article>
  );
}
