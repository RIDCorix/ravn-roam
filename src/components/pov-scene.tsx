import type { Dictionary } from "@/app/[lang]/dictionaries";

const POV_CYCLE = 14;

export function PovScene({ dict }: { dict: Dictionary["pov"] }) {
  return (
    <section className="r-section" style={{ padding: "0 24px 96px" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            color: "var(--fg-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 500,
          }}
        >
          {dict.eyebrow}
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1200 / 380",
            overflow: "hidden",
            borderRadius: 0,
          }}
        >
          <PovStage />
        </div>
      </div>

      <style>{`
        @keyframes pov-phone {
          0%, 24%   { transform: translate(-50%, -52%) rotate(-2deg); }
          30%, 47%  { transform: translate(-50%,  52%) rotate(-46deg); }
          50%, 100% { transform: translate(-50%, -52%) rotate(-2deg); }
        }
        @keyframes pov-bars {
          0%, 21%   { opacity: 1; }
          22%, 49%  { opacity: 0; }
          50%, 100% { opacity: 1; }
        }
        @keyframes pov-nosignal {
          0%, 21%   { opacity: 0; }
          23%, 32%  { opacity: 1; }
          36%, 100% { opacity: 0; }
        }
        @keyframes pov-redalert {
          0%, 21%   { opacity: 0; }
          23%, 32%  { opacity: 1; }
          36%, 100% { opacity: 0; }
        }
        @keyframes pov-floor-dash {
          0%   { bottom: 100%; width: 5px;  height: 1px;  opacity: 0; }
          8%   { opacity: 0.85; }
          92%  { opacity: 0.0; }
          100% { bottom: -8%;  width: 260px; height: 14px; opacity: 0; }
        }
        @keyframes pov-route-dim {
          0%, 22%   { opacity: 1; }
          24%, 48%  { opacity: 0.35; }
          50%, 100% { opacity: 1; }
        }
        @keyframes pov-sky-rise {
          0%, 22%   { opacity: 0; }
          30%, 47%  { opacity: 1; }
          54%, 100% { opacity: 0; }
        }
        @keyframes pov-logo {
          0%, 28%   { opacity: 0; transform: translate(-50%, -50%) translateY(14px) scale(0.78); }
          32%, 42%  { opacity: 1; transform: translate(-50%, -50%) translateY(0)    scale(1.0); }
          43%       { opacity: 1; transform: translate(-50%, -50%) translateY(0)    scale(1.18); }
          47%       { opacity: 1; transform: translate(-50%, -50%) translateY(0)    scale(1.0); }
          50%, 100% { opacity: 0; transform: translate(-50%, -50%) translateY(-14px) scale(0.85); }
        }
        @keyframes pov-ripple {
          0%, 42%   { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
          43%       { opacity: 0.85; transform: translate(-50%, -50%) scale(0.55); }
          50%       { opacity: 0;    transform: translate(-50%, -50%) scale(3.0); }
          100%      { opacity: 0; }
        }
        @keyframes pov-finger {
          0%, 38%   { transform: translate(-50%, 100%) rotate(-4deg); opacity: 0; }
          42%, 45%  { transform: translate(-50%,  6%)  rotate(-4deg); opacity: 1; }
          47%       { transform: translate(-50%,  18%) rotate(-4deg); opacity: 1; }
          52%, 100% { transform: translate(-50%, 100%) rotate(-4deg); opacity: 0; }
        }
        @keyframes pov-ground-scroll {
          0%   { background-position-x: 0; }
          100% { background-position-x: -120px; }
        }
        @keyframes pov-ground-pause {
          0%, 22%   { animation-play-state: running; }
          24%, 49%  { animation-play-state: paused; }
          50%, 100% { animation-play-state: running; }
        }
        @keyframes pov-cloud-drift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-180px); }
        }

        .pov-phone    { animation: pov-phone ${POV_CYCLE}s cubic-bezier(0.32, 0.72, 0, 1) infinite; }
        .pov-bars     { animation: pov-bars ${POV_CYCLE}s ease-in-out infinite; }
        .pov-nosignal { animation: pov-nosignal ${POV_CYCLE}s ease-in-out infinite; }
        .pov-route    { animation: pov-route-dim ${POV_CYCLE}s ease-in-out infinite; }
        .pov-sky      { animation: pov-sky-rise ${POV_CYCLE}s ease-in-out infinite; }
        .pov-logo     { animation: pov-logo ${POV_CYCLE}s cubic-bezier(0.32, 0.72, 0, 1) infinite; }
        .pov-ripple   { animation: pov-ripple ${POV_CYCLE}s ease-out infinite; }
        .pov-finger   { animation: pov-finger ${POV_CYCLE}s cubic-bezier(0.32, 0.72, 0, 1) infinite; }
        .pov-redalert { animation: pov-redalert ${POV_CYCLE}s ease-in-out infinite; }
        .pov-floor-dash {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(17,17,32,0.55);
          border-radius: 3px;
          animation:
            pov-floor-dash 2.4s linear infinite,
            pov-ground-pause ${POV_CYCLE}s infinite;
        }
        .pov-cloud-1 { animation: pov-cloud-drift 24s linear infinite; }
        .pov-cloud-2 { animation: pov-cloud-drift 38s linear infinite; }
      `}</style>
    </section>
  );
}

function PovStage() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, #F2F2EF 0%, #F7F7F5 55%, #F2F2EF 100%)",
        overflow: "hidden",
      }}
    >
      <div
        className="pov-sky"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(220,244,243,0.6) 0%, rgba(247,247,245,0) 60%)",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      <div
        className="pov-redalert"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "46%",
          background:
            "radial-gradient(80% 100% at 50% 0%, rgba(229,72,77,0.32), rgba(229,72,77,0.05) 60%, transparent 100%)",
          opacity: 0,
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />

      <svg
        style={{
          position: "absolute",
          top: 30,
          left: 0,
          right: 0,
          height: 60,
          width: "120%",
          pointerEvents: "none",
        }}
      >
        <g className="pov-cloud-1" opacity="0.32">
          <path
            d="M180,30 q40,-8 80,0 q30,5 60,-2"
            stroke="rgba(17,17,32,0.16)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M560,18 q50,-6 100,2 q40,6 80,-2"
            stroke="rgba(17,17,32,0.16)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        <g className="pov-cloud-2" opacity="0.28">
          <path
            d="M280,52 q40,-4 80,2"
            stroke="rgba(17,17,32,0.12)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M820,46 q50,-4 90,2"
            stroke="rgba(17,17,32,0.12)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "46%",
          height: 1,
          background: "rgba(17,17,32,0.07)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "54%",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <path d="M 600,0 L 80,200 L 1120,200 Z" fill="rgba(17,17,32,0.035)" />
          <line
            x1="600"
            y1="0"
            x2="80"
            y2="200"
            stroke="rgba(17,17,32,0.14)"
            strokeWidth="0.8"
          />
          <line
            x1="600"
            y1="0"
            x2="1120"
            y2="200"
            stroke="rgba(17,17,32,0.14)"
            strokeWidth="0.8"
          />
        </svg>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="pov-floor-dash"
            style={{ animationDelay: `-${i * 0.4}s` }}
          />
        ))}
      </div>

      <div
        className="pov-logo"
        style={{
          position: "absolute",
          left: "50%",
          top: "34%",
          width: 88,
          height: 88,
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <span
          className="pov-ripple"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 88,
            height: 88,
            borderRadius: "50%",
            border: "1.5px solid #0FB8B4",
            opacity: 0,
          }}
        />
        <svg
          width="88"
          height="88"
          viewBox="0 0 88 88"
          style={{ position: "absolute", inset: 0 }}
        >
          <circle cx="44" cy="44" r="38" fill="rgba(15,184,180,0.10)" />
          <circle
            cx="44"
            cy="44"
            r="30"
            fill="#fff"
            stroke="#0FB8B4"
            strokeWidth="1.6"
          />
          <path
            d="M24,43 a20,20 0 0 1 40,0"
            stroke="#111"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M32,43 a12,12 0 0 1 24,0"
            stroke="#0FB8B4"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="44" cy="44" r="3.2" fill="#111" />
        </svg>
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "100%",
            width: 1,
            height: 18,
            marginLeft: -0.5,
            backgroundImage:
              "linear-gradient(180deg, rgba(15,184,180,0.6) 50%, transparent 50%)",
            backgroundSize: "1px 4px",
          }}
        />
      </div>

      <div
        className="pov-finger"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          width: 70,
          height: 180,
          transformOrigin: "bottom center",
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <svg
          width="70"
          height="180"
          viewBox="0 0 70 180"
          style={{ overflow: "visible" }}
        >
          <path
            d="M28,40 Q28,20 32,8 Q40,6 42,18 Q42,30 41,42 L60,80 Q60,180 60,180 L18,180 Q18,180 18,90 Z"
            fill="#111"
            stroke="#1A1A1A"
            strokeWidth="0.5"
          />
          <path
            d="M32,8 Q40,6 42,18"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.6"
            fill="none"
          />
        </svg>
      </div>

      <div
        className="pov-phone"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 230,
          height: 320,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#0E0E0E",
            borderRadius: 26,
            padding: 6,
            boxShadow:
              "0 28px 48px rgba(17,17,32,0.22), 0 8px 20px rgba(17,17,32,0.10), inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              background: "#FBFBFA",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px 6px",
                fontFamily: "var(--font-mono)",
                fontSize: 8.5,
                fontWeight: 600,
                color: "#111",
              }}
            >
              <span>9:41</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  className="pov-bars"
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 1.2,
                    height: 7,
                  }}
                >
                  <span
                    style={{
                      width: 1.4,
                      height: 2,
                      background: "#111",
                      borderRadius: 0.7,
                    }}
                  />
                  <span
                    style={{
                      width: 1.4,
                      height: 3.5,
                      background: "#111",
                      borderRadius: 0.7,
                    }}
                  />
                  <span
                    style={{
                      width: 1.4,
                      height: 5,
                      background: "#111",
                      borderRadius: 0.7,
                    }}
                  />
                  <span
                    style={{
                      width: 1.4,
                      height: 7,
                      background: "#111",
                      borderRadius: 0.7,
                    }}
                  />
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    width: 14,
                    height: 7,
                    border: "0.8px solid #111",
                    borderRadius: 1.6,
                    padding: 1,
                  }}
                >
                  <span
                    style={{
                      width: "72%",
                      height: "100%",
                      background: "#111",
                      borderRadius: 0.6,
                      display: "block",
                    }}
                  />
                </span>
              </div>
            </div>

            <div
              className="pov-nosignal"
              style={{
                position: "absolute",
                left: "50%",
                top: 36,
                transform: "translateX(-50%)",
                padding: "4px 10px",
                borderRadius: 999,
                background: "#FCEBEC",
                color: "#E5484D",
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                gap: 5,
                boxShadow: "0 2px 6px rgba(229,72,77,0.18)",
                opacity: 0,
                whiteSpace: "nowrap",
              }}
            >
              <svg width="9" height="9" viewBox="0 0 12 12">
                <path
                  d="M6,1 L11,10 L1,10 Z"
                  fill="none"
                  stroke="#E5484D"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <line
                  x1="6"
                  y1="4"
                  x2="6"
                  y2="6.8"
                  stroke="#E5484D"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle cx="6" cy="8.2" r="0.7" fill="#E5484D" />
              </svg>
              No signal
            </div>

            <div
              className="pov-route"
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                top: 32,
                bottom: 52,
                background: "#F2F2EF",
                borderRadius: 12,
                overflow: "hidden",
                transition: "opacity 200ms ease",
              }}
            >
              <svg
                viewBox="0 0 200 250"
                preserveAspectRatio="xMidYMid slice"
                style={{ width: "100%", height: "100%", display: "block" }}
              >
                <g
                  stroke="rgba(17,17,32,0.08)"
                  strokeWidth="0.8"
                  fill="none"
                >
                  <path d="M-20,200 L220,140" />
                  <path d="M-20,100 L220,40" />
                  <path d="M40,260 L60,-20" />
                  <path d="M120,260 L140,-20" />
                </g>
                <rect
                  x="60"
                  y="40"
                  width="60"
                  height="60"
                  rx="4"
                  fill="rgba(15,184,180,0.06)"
                />
                <rect
                  x="130"
                  y="120"
                  width="50"
                  height="50"
                  rx="4"
                  fill="rgba(17,17,32,0.03)"
                />
                <path
                  d="M30,220 Q60,200 80,160 Q90,140 110,120 T170,40"
                  stroke="#0FB8B4"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
                <circle
                  cx="30"
                  cy="220"
                  r="4.5"
                  fill="#0FB8B4"
                  stroke="#fff"
                  strokeWidth="1.4"
                />
                <circle
                  cx="170"
                  cy="40"
                  r="3.5"
                  fill="#111"
                  stroke="#fff"
                  strokeWidth="1.4"
                />
              </svg>

              <div
                style={{
                  position: "absolute",
                  left: 8,
                  top: 8,
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(6px)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 8,
                  fontWeight: 600,
                  color: "#111",
                  letterSpacing: "-0.01em",
                  boxShadow: "0 2px 6px rgba(17,17,32,0.08)",
                }}
              >
                15 min · 1.2 km
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                bottom: 10,
                background: "#111",
                color: "#fff",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 9,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                letterSpacing: "-0.01em",
              }}
            >
              <span>Start walking</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>→</span>
            </div>
          </div>
        </div>

        <span
          style={{
            position: "absolute",
            left: -10,
            bottom: 20,
            width: 22,
            height: 90,
            background: "rgba(17,17,32,0.85)",
            borderRadius: "50% 0 0 50% / 50% 0 0 50%",
            transform: "rotate(8deg)",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: -34,
            bottom: 14,
            width: 26,
            height: 110,
            background: "rgba(17,17,32,0.88)",
            borderRadius: "0 50% 50% 0 / 0 50% 50% 0",
            transform: "rotate(-14deg)",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "rgba(17,17,32,0.42)",
          letterSpacing: "0.04em",
          pointerEvents: "none",
        }}
      >
        your_view → carrier_swap → resume
      </div>
    </div>
  );
}
