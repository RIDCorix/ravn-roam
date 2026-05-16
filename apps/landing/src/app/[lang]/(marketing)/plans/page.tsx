import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/button";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { localized } from "@/lib/href";
import { getDictionary, hasLocale } from "../../dictionaries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return buildMetadata({
    title: dict.plans.title,
    description: dict.plans.subtitle,
    locale: lang,
    path: "plans",
  });
}

export default async function PlansPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const p = dict.plans;
  const breadcrumb = breadcrumbJsonLd(lang, [
    { name: "Home", path: "" },
    { name: p.title, path: "plans" },
  ]);

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        subtitle={p.subtitle}
        homeLabel={dict.page.home}
        currentLocale={lang}
      />

      {/* Tier cards */}
      <section style={{ padding: "8px 24px 64px" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <Reveal y={10}>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--fg-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontWeight: 600,
              }}
            >
              {p.sampleRegionLabel}
            </div>
          </Reveal>
          <div
            className="r-plans-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 20,
              alignItems: "stretch",
            }}
          >
            {p.tiers.map((tier, i) => (
              <Reveal key={tier.title} delay={0.06 + i * 0.08} y={20}>
                <TierCard
                  tier={tier}
                  popularLabel={p.popularBadge}
                  currentLocale={lang}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What every plan includes */}
      <section
        style={{
          padding: "32px 24px 64px",
          background: "linear-gradient(180deg, transparent 0%, rgba(15,184,180,0.04) 100%)",
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <Reveal>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(22px, 3vw, 32px)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--fg)",
              }}
            >
              {p.compareTitle}
            </h2>
          </Reveal>
          <div
            className="r-plans-features"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 24,
            }}
          >
            {p.compareFeatures.map((f, i) => (
              <Reveal key={f.label} delay={0.05 + i * 0.06} y={14}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    paddingTop: 20,
                    borderTop: "1px solid rgba(17,17,32,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        color: "#fff",
                      }}
                    >
                      <Icon name="check" size={13} strokeWidth={3} />
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--fg)",
                        letterSpacing: "-0.015em",
                      }}
                    >
                      {f.label}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      paddingLeft: 32,
                      fontSize: 14.5,
                      lineHeight: 1.55,
                      color: "var(--fg-secondary)",
                      textWrap: "pretty",
                    }}
                  >
                    {f.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Note + CTA */}
      <section style={{ padding: "32px 24px 96px" }}>
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            alignItems: "flex-start",
            padding: "28px 30px",
            borderRadius: 18,
            background: "var(--surface)",
            boxShadow:
              "inset 0 0 0 1px rgba(17,17,32,0.06), 0 8px 24px rgba(17,17,32,0.04)",
          }}
        >
          <Reveal y={10}>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontWeight: 700,
              }}
            >
              {p.noteTitle}
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <p
              style={{
                margin: 0,
                fontSize: 15.5,
                lineHeight: 1.6,
                color: "var(--fg-secondary)",
                textWrap: "pretty",
              }}
            >
              {p.noteBody}
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div
              className="r-plans-ctas"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Button size="md">
                {p.ctaPrimary}
                <Icon name="arrowRight" size={13} />
              </Button>
              <Button
                size="md"
                variant="ghost"
                href={localized("/#coverage", lang)}
              >
                {p.ctaSecondary}
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </article>
  );
}

type Tier = Awaited<ReturnType<typeof getDictionary>>["plans"]["tiers"][number];

function TierCard({
  tier,
  popularLabel,
  currentLocale,
}: {
  tier: Tier;
  popularLabel: string;
  currentLocale: string;
}) {
  void currentLocale; // reserved for future per-locale tier links
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: tier.popular ? "32px 24px 24px" : "28px 24px 22px",
        borderRadius: 20,
        background: tier.popular
          ? "linear-gradient(170deg, #0c1922 0%, #0a1b21 100%)"
          : "var(--surface)",
        color: tier.popular ? "#faf5e6" : "var(--fg)",
        boxShadow: tier.popular
          ? "0 30px 60px -20px rgba(15,184,180,0.25), inset 0 0 0 1px rgba(250,245,230,0.08)"
          : "0 8px 24px rgba(17,17,32,0.05), inset 0 0 0 1px rgba(17,17,32,0.06)",
      }}
    >
      {tier.popular ? (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 24,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: "#fff",
            background: "var(--accent)",
            padding: "4px 9px",
            borderRadius: 999,
          }}
        >
          {popularLabel}
        </span>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: tier.popular ? "rgba(250,245,230,0.55)" : "var(--fg-muted)",
          }}
        >
          {tier.tag}
        </span>
        <span
          style={{
            fontSize: 13,
            color: tier.popular ? "rgba(250,245,230,0.55)" : "var(--fg-muted)",
          }}
        >
          {tier.data}
        </span>
      </div>

      <div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: tier.popular ? "#fefcf5" : "var(--fg)",
          }}
        >
          {tier.title}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12.5,
            color: tier.popular ? "rgba(250,245,230,0.55)" : "var(--fg-muted)",
          }}
        >
          {tier.validity}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: "clamp(36px, 4.5vw, 48px)",
            fontWeight: 300,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: tier.popular ? "#fefcf5" : "var(--fg)",
            fontFamily: "var(--font-inter)",
          }}
        >
          {tier.price}
        </span>
        <span
          style={{
            fontSize: 12.5,
            color: tier.popular ? "rgba(250,245,230,0.55)" : "var(--fg-muted)",
          }}
        >
          {tier.subPrice}
        </span>
      </div>

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingTop: 12,
          borderTop: tier.popular
            ? "1px solid rgba(250,245,230,0.1)"
            : "1px solid rgba(17,17,32,0.06)",
        }}
      >
        {tier.features.map((feat) => (
          <li
            key={feat}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
              fontSize: 13.5,
              lineHeight: 1.45,
              color: tier.popular ? "rgba(250,245,230,0.85)" : "var(--fg-secondary)",
            }}
          >
            <span
              style={{
                marginTop: 4,
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--accent)",
                flexShrink: 0,
              }}
            />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "auto", paddingTop: 12 }}>
        <Button
          size="md"
          variant={tier.popular ? "accent" : "secondary"}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {tier.cta}
          <Icon name="arrowRight" size={13} />
        </Button>
      </div>
    </div>
  );
}
