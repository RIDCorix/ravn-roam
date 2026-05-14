import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "arrowRight"
  | "arrowUpRight"
  | "wifi"
  | "signal"
  | "globe"
  | "check"
  | "sparkle"
  | "zap"
  | "shield"
  | "qr"
  | "plane"
  | "map"
  | "bolt"
  | "twitter";

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
};

const paths: Record<IconName, ReactNode> = {
  arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  wifi: (
    <>
      <path d="M5 12.55a11 11 0 0 1 14 0" />
      <path d="M2 8.82a16 16 0 0 1 20 0" />
      <path d="M8.5 16.43a6 6 0 0 1 7 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </>
  ),
  signal: (
    <>
      <path d="M2 20h.01" />
      <path d="M7 20v-4" />
      <path d="M12 20v-8" />
      <path d="M17 20V8" />
      <path d="M22 4v16" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  sparkle: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M17 17h4M20 20v1" />
    </>
  ),
  plane: (
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z" />
  ),
  map: (
    <>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </>
  ),
  bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  twitter: (
    <path d="M22 5.8a8.5 8.5 0 0 1-2.4.7 4.2 4.2 0 0 0 1.8-2.3 8.4 8.4 0 0 1-2.7 1 4.2 4.2 0 0 0-7.1 3.8A11.9 11.9 0 0 1 3 5a4.2 4.2 0 0 0 1.3 5.6 4.2 4.2 0 0 1-1.9-.5 4.2 4.2 0 0 0 3.4 4.1 4.2 4.2 0 0 1-1.9.1 4.2 4.2 0 0 0 3.9 2.9A8.4 8.4 0 0 1 2 19a11.9 11.9 0 0 0 6.4 1.9c7.7 0 11.9-6.4 11.9-11.9v-.5A8.5 8.5 0 0 0 22 5.8z" />
  ),
};

export function Icon({
  name,
  size = 18,
  color = "currentColor",
  strokeWidth = 1.5,
  style,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

export function RoamLogo({
  size = 26,
  inverse = false,
}: {
  size?: number;
  inverse?: boolean;
}) {
  const fg = inverse ? "#fff" : "#111";
  const accent = inverse ? "#5DD9D5" : "#0FB8B4";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
        <circle cx="14" cy="14" r="13" stroke={fg} strokeWidth="1.4" />
        <circle cx="14" cy="14" r="2.4" fill={fg} />
        <path
          d="M5.2 14a8.8 8.8 0 0 1 17.6 0"
          stroke={fg}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M8.8 14a5.2 5.2 0 0 1 10.4 0"
          stroke={accent}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          fontSize: size > 22 ? 17 : 15,
          fontWeight: 600,
          letterSpacing: "-0.025em",
          color: inverse ? "#fff" : "var(--fg)",
        }}
      >
        Roam
      </span>
    </div>
  );
}
