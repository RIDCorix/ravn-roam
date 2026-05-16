import { Button } from "./button";
import { Icon } from "./icons";
import { FooterLink } from "./footer-link";
import { Reveal } from "./reveal";
import type { Dictionary, Locale } from "@/app/[lang]/dictionaries";
import { localized } from "@/lib/href";

export function Footer({
  dict,
  currentLocale,
}: {
  dict: Dictionary["footer"];
  currentLocale: Locale;
}) {
  const columns = [
    dict.columns.product,
    dict.columns.company,
    dict.columns.help,
  ];

  return (
    <footer
      className="r-footer"
      style={{ position: "relative", padding: "0 24px 32px" }}
    >
      <div
        className="r-footer-card"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          background: "#111",
          color: "#fff",
          borderRadius: 28,
          padding: "56px 48px 32px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(40% 60% at 100% 0%, rgba(15, 184, 180, 0.32), transparent 70%), radial-gradient(30% 50% at 0% 100%, rgba(91, 124, 250, 0.18), transparent 70%)",
          }}
        />

        <div
          className="r-footer-grid"
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
            gap: 48,
            paddingBottom: 48,
            borderBottom: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden
              >
                <circle cx="14" cy="14" r="13" stroke="#fff" strokeWidth="1.4" />
                <circle cx="14" cy="14" r="2.4" fill="#fff" />
                <path
                  d="M5.2 14a8.8 8.8 0 0 1 17.6 0"
                  stroke="#fff"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M8.8 14a5.2 5.2 0 0 1 10.4 0"
                  stroke="#5DD9D5"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                }}
              >
                Roam
              </span>
            </div>

            <Reveal>
              <h3
                style={{
                  margin: 0,
                  fontSize: "clamp(26px, 3vw, 40px)",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.08,
                  maxWidth: 360,
                  textWrap: "balance",
                }}
              >
                {dict.headlineLead}
                <br />
                <span
                  style={{
                    color: "#A6E8E5",
                    fontStyle: "italic",
                    fontWeight: 500,
                  }}
                >
                  {dict.headlineAccent}
                </span>
              </h3>
            </Reveal>
            <Reveal delay={0.1}>
              <p
                style={{
                  margin: "14px 0 22px",
                  maxWidth: 320,
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                {dict.subtitle}
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div
                className="r-footer-ctas"
                style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
              >
                <Button size="md" variant="accent">
                  {dict.ctaPrimary}
                  <Icon name="arrowRight" size={13} />
                </Button>
                <FooterLink href="#">{dict.ctaSecondary}</FooterLink>
              </div>
            </Reveal>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 18,
                }}
              >
                {col.title}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {col.items.map((item) => (
                  <FooterLink
                    key={item.label}
                    href={localized(item.href, currentLocale)}
                    variant="column"
                  >
                    {item.label}
                  </FooterLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="r-footer-bottom"
          style={{
            position: "relative",
            paddingTop: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {dict.copyright}
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              flexWrap: "wrap",
            }}
          >
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>
              {dict.legal.terms}
            </a>
            <a
              href={`/${currentLocale}/privacy`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {dict.legal.privacy}
            </a>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>
              {dict.legal.cookies}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
