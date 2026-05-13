import type { Dictionary } from "@/app/[lang]/dictionaries";

const CYCLE = 14;

export function WalkScene({ dict }: { dict: Dictionary["walk"] }) {
  return (
    <section className="r-section" style={{ padding: "64px 24px 96px" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div
          className="r-section-head"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
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
              {dict.eyebrow}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4.2vw, 52px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 1.04,
                color: "var(--fg)",
                textWrap: "balance",
              }}
            >
              {dict.title}
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
            {dict.subtitle}
          </p>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1200 / 380",
            overflow: "hidden",
          }}
        >
          <SceneSVG />
        </div>
      </div>

      <style>{`
        @keyframes walk-x {
          0%   { transform: translateX(-10%); }
          22%  { transform: translateX(28%); }
          50%  { transform: translateX(28%); }
          100% { transform: translateX(110%); }
        }
        @keyframes walk-bob {
          0%, 100% { transform: translateY(0); }
          25%      { transform: translateY(-3px); }
          50%      { transform: translateY(0); }
          75%      { transform: translateY(-3px); }
        }
        @keyframes leg-front {
          0%, 100% { transform: rotate(15deg); }
          50%      { transform: rotate(-15deg); }
        }
        @keyframes leg-back {
          0%, 100% { transform: rotate(-15deg); }
          50%      { transform: rotate(15deg); }
        }
        @keyframes head-look-up {
          0%, 24%   { transform: rotate(8deg); }
          27%       { transform: rotate(8deg); }
          30%, 48%  { transform: rotate(-15deg); }
          51%       { transform: rotate(8deg); }
          100%      { transform: rotate(8deg); }
        }
        @keyframes arm-reach {
          0%, 30%  { transform: rotate(0deg); }
          35%, 46% { transform: rotate(-90deg); }
          50%      { transform: rotate(0deg); }
          100%     { transform: rotate(0deg); }
        }
        @keyframes bars-on {
          0%, 21%   { opacity: 1; }
          22%, 49%  { opacity: 0; }
          50%, 100% { opacity: 1; }
        }
        @keyframes no-signal {
          0%, 23%   { opacity: 0; }
          25%, 47%  { opacity: 1; }
          49%, 100% { opacity: 0; }
        }
        @keyframes logo-appear {
          0%, 28%   { opacity: 0; transform: translateY(14px) scale(0.7); }
          32%, 42%  { opacity: 1; transform: translateY(0)    scale(1.0); }
          43%       { transform: translateY(0)    scale(1.18); }
          47%       { opacity: 1; transform: translateY(0)    scale(1.0); }
          50%, 100% { opacity: 0; transform: translateY(-12px) scale(0.85); }
        }
        @keyframes ripple {
          0%, 42%   { opacity: 0; transform: scale(0.5); }
          43%       { opacity: 0.8; transform: scale(0.5); }
          50%       { opacity: 0;   transform: scale(2.6); }
          100%      { opacity: 0; }
        }
        @keyframes drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(-60px); }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }

        .ws-figure       { animation: walk-x ${CYCLE}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite; will-change: transform; }
        .ws-figure-bob   { animation: walk-bob 0.7s ease-in-out infinite; will-change: transform; }
        .ws-leg-front    { transform-origin: 30px 60px; animation: leg-front 0.7s ease-in-out infinite; }
        .ws-leg-back     { transform-origin: 30px 60px; animation: leg-back  0.7s ease-in-out infinite; }
        .ws-head         { transform-origin: 30px 18px; animation: head-look-up ${CYCLE}s ease-in-out infinite; }
        .ws-arm-up       { transform-origin: 30px 28px; animation: arm-reach    ${CYCLE}s cubic-bezier(0.32,0.72,0,1) infinite; }
        .ws-bars         { animation: bars-on  ${CYCLE}s ease-in-out infinite; }
        .ws-nosignal     { animation: no-signal ${CYCLE}s ease-in-out infinite; }
        .ws-logo         { transform-origin: center center; animation: logo-appear ${CYCLE}s cubic-bezier(0.32,0.72,0,1) infinite; }
        .ws-ripple       { transform-origin: center center; animation: ripple ${CYCLE}s ease-out infinite; }
        .ws-cloud-1      { animation: drift 24s linear infinite; }
        .ws-cloud-2      { animation: drift 38s linear infinite; }
        .ws-orbit        { animation: float-up 4s ease-in-out infinite; }
      `}</style>
    </section>
  );
}

function SceneSVG() {
  const W = 1200;
  const H = 380;
  const groundY = 290;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
      }}
    >
      <defs>
        <linearGradient id="ws-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7F7F5" />
          <stop offset="100%" stopColor="#F2F2EF" />
        </linearGradient>
        <radialGradient id="ws-spot" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="rgba(15,184,180,0.07)" />
          <stop offset="100%" stopColor="rgba(15,184,180,0)" />
        </radialGradient>
        <radialGradient id="ws-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(17,17,32,0.30)" />
          <stop offset="100%" stopColor="rgba(17,17,32,0)" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width={W} height={H} fill="url(#ws-sky)" />

      <g className="ws-cloud-1" opacity="0.4">
        <path
          d="M180,120 q40,-8 80,0 q30,5 60,-2"
          stroke="rgba(17,17,32,0.10)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <g className="ws-cloud-2" opacity="0.35">
        <path
          d="M560,90 q50,-6 100,2 q40,6 80,-2"
          stroke="rgba(17,17,32,0.08)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M860,150 q30,-5 70,2"
          stroke="rgba(17,17,32,0.08)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      <g opacity="0.10" stroke="#111" strokeWidth="1" fill="none">
        <path
          d={`M0,${groundY - 4} L80,${groundY - 4} L80,${groundY - 32} L130,${
            groundY - 32
          } L130,${groundY - 58} L170,${groundY - 58} L170,${groundY - 30} L230,${
            groundY - 30
          } L230,${groundY - 50} L290,${groundY - 50} L290,${groundY - 20} L360,${
            groundY - 20
          } L360,${groundY - 44} L420,${groundY - 44} L420,${groundY - 22} L490,${
            groundY - 22
          } L490,${groundY - 38} L560,${groundY - 38} L560,${groundY - 18} L640,${
            groundY - 18
          } L640,${groundY - 52} L720,${groundY - 52} L720,${groundY - 26} L800,${
            groundY - 26
          } L800,${groundY - 48} L880,${groundY - 48} L880,${groundY - 22} L960,${
            groundY - 22
          } L960,${groundY - 40} L1040,${groundY - 40} L1040,${groundY - 18} L1120,${
            groundY - 18
          } L1120,${groundY - 32} L${W},${groundY - 32}`}
        />
      </g>

      <line
        x1="0"
        y1={groundY}
        x2={W}
        y2={groundY}
        stroke="rgba(17,17,32,0.12)"
        strokeWidth="0.6"
        strokeDasharray="2 7"
      />

      <ellipse
        cx={W * 0.5}
        cy={groundY + 20}
        rx="220"
        ry="22"
        fill="url(#ws-spot)"
      />

      <g
        className="ws-orbit"
        transform={`translate(${W * 0.5 + 18}, ${groundY - 215})`}
      >
        <g className="ws-logo">
          <circle
            className="ws-ripple"
            r="36"
            fill="none"
            stroke="#0FB8B4"
            strokeWidth="1.4"
            opacity="0"
          />
          <circle r="32" fill="rgba(15,184,180,0.10)" />
          <circle r="26" fill="#fff" stroke="#0FB8B4" strokeWidth="1.4" />
          <g stroke="#111" strokeWidth="1.4" fill="none" strokeLinecap="round">
            <path d="M-13,-1 a13,13 0 0 1 26,0" />
          </g>
          <g
            stroke="#0FB8B4"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
          >
            <path d="M-7,1 a7,7 0 0 1 14,0" />
          </g>
          <circle r="2.4" fill="#111" />
          <line
            x1="0"
            y1="36"
            x2="0"
            y2="56"
            stroke="rgba(15,184,180,0.6)"
            strokeWidth="1"
            strokeDasharray="1.5 3"
          />
        </g>
      </g>

      <g className="ws-figure">
        <g
          className="ws-figure-bob"
          transform={`translate(0, ${groundY - 130})`}
        >
          <ellipse cx="30" cy="132" rx="22" ry="3.4" fill="url(#ws-shadow)" />

          <g className="ws-leg-back">
            <line
              x1="30"
              y1="60"
              x2="22"
              y2="120"
              stroke="#111"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          </g>
          <g className="ws-leg-front">
            <line
              x1="30"
              y1="60"
              x2="38"
              y2="120"
              stroke="#111"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          </g>

          <line
            x1="30"
            y1="32"
            x2="30"
            y2="62"
            stroke="#111"
            strokeWidth="3.6"
            strokeLinecap="round"
          />

          <line
            x1="30"
            y1="38"
            x2="22"
            y2="62"
            stroke="#111"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <g>
            <line
              x1="30"
              y1="38"
              x2="46"
              y2="58"
              stroke="#111"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <g transform="translate(43, 52)">
              <rect x="0" y="0" width="11" height="18" rx="2" fill="#111" />
              <rect x="1" y="2" width="9" height="13" rx="0.6" fill="#fff" />
              <g className="ws-bars" transform="translate(2.4, 4)">
                <rect
                  x="0"
                  y="3"
                  width="1.2"
                  height="2"
                  rx="0.3"
                  fill="#0FB8B4"
                />
                <rect
                  x="1.8"
                  y="2"
                  width="1.2"
                  height="3"
                  rx="0.3"
                  fill="#0FB8B4"
                />
                <rect
                  x="3.6"
                  y="1"
                  width="1.2"
                  height="4"
                  rx="0.3"
                  fill="#0FB8B4"
                />
                <rect
                  x="5.4"
                  y="0"
                  width="1.2"
                  height="5"
                  rx="0.3"
                  fill="#0FB8B4"
                />
              </g>
              <g
                className="ws-nosignal"
                transform="translate(3.4, 4.4)"
                opacity="0"
              >
                <path
                  d="M2,0 L4,3.6 L0,3.6 Z"
                  fill="none"
                  stroke="#E5484D"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
                <line
                  x1="2"
                  y1="1.4"
                  x2="2"
                  y2="2.5"
                  stroke="#E5484D"
                  strokeWidth="0.6"
                  strokeLinecap="round"
                />
                <circle cx="2" cy="3.0" r="0.35" fill="#E5484D" />
              </g>
            </g>
          </g>

          <g className="ws-arm-up">
            <line
              x1="30"
              y1="38"
              x2="30"
              y2="14"
              stroke="#111"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="30" cy="12" r="3.2" fill="#111" />
          </g>

          <g className="ws-head">
            <circle
              cx="30"
              cy="18"
              r="12"
              fill="#F7F7F5"
              stroke="#111"
              strokeWidth="2.6"
            />
            <path
              d="M18,12 Q22,8 30,8 Q38,8 42,14"
              fill="#111"
              stroke="none"
            />
          </g>
        </g>
      </g>

      <g
        transform={`translate(${W / 2}, ${groundY + 56})`}
        textAnchor="middle"
      >
        <text
          fontFamily="var(--font-mono)"
          fontSize="11"
          fill="rgba(17,17,32,0.45)"
          letterSpacing="0.04em"
        >
          carrier_A → carrier_B → carrier_C
        </text>
      </g>
    </svg>
  );
}
