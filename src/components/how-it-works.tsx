import { Icon, type IconName } from "./icons";

type Step = {
  n: string;
  title: string;
  body: string;
  icon: IconName;
};

const steps: Step[] = [
  {
    n: "01",
    title: "Pick a destination.",
    body: "Choose the country you're flying to — or pick a regional bundle for a whole trip.",
    icon: "map",
  },
  {
    n: "02",
    title: "Scan a QR. Done.",
    body: "Roam installs onto your phone as a second line in under a minute. Nothing to ship, nothing to plug in.",
    icon: "qr",
  },
  {
    n: "03",
    title: "Land, and it's live.",
    body: "The line wakes the moment you connect to a local network. Top up from the app whenever.",
    icon: "plane",
  },
];

export function HowItWorks() {
  return (
    <section style={{ padding: "64px 24px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
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
              How it works
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(32px, 4.2vw, 52px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 1.04,
                color: "var(--fg)",
                textWrap: "balance",
              }}
            >
              A SIM card without the card. Or the wait.
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
            Three steps from &ldquo;I just landed&rdquo; to first message
            home. We talk to the local operator on your behalf, route over
            the strongest signal, and stay out of your way.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 8,
          }}
        >
          {steps.map((s) => (
            <div
              key={s.n}
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
                  gap: 14,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--fg-muted)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.n}
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
                  <Icon name={s.icon} size={16} />
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
          ))}
        </div>
      </div>
    </section>
  );
}
