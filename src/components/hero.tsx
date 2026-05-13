import { Icon } from "./icons";
import { Button } from "./button";
import { WorldMap } from "./world-map";

export function Hero() {
  return (
    <section
      style={{
        position: "relative",
        padding: "64px 24px 24px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px 6px 8px",
            fontSize: 12.5,
            color: "var(--fg-secondary)",
          }}
        >
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            New
          </span>
          Pay-as-you-go data — no roaming fees, ever.
          <Icon
            name="arrowRight"
            size={13}
            color="var(--fg-secondary)"
          />
        </span>

        <h1
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: "clamp(44px, 7.6vw, 88px)",
            fontWeight: 700,
            letterSpacing: "-0.045em",
            lineHeight: 0.96,
            color: "var(--fg)",
            maxWidth: 820,
            textWrap: "balance",
          }}
        >
          Connected,{" "}
          <span
            style={{
              fontStyle: "italic",
              fontWeight: 500,
              color: "var(--accent)",
            }}
          >
            before you land.
          </span>
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: 520,
            textAlign: "center",
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--fg-secondary)",
            textWrap: "pretty",
          }}
        >
          One eSIM, 200+ destinations. Tap a node for live coverage.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Button size="lg">
            Install on this phone
            <Icon name="arrowRight" size={14} />
          </Button>
          <Button size="lg" variant="ghost">
            See full coverage →
          </Button>
        </div>

        <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
          Works on iPhone XS and newer · Google Pixel 3 and newer.
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: "100vw",
          maxWidth: "100%",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          marginTop: 8,
          paddingTop: 12,
        }}
      >
        <WorldMap />
      </div>
    </section>
  );
}
