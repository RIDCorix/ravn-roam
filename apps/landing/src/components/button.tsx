"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "accent";
type Size = "sm" | "md" | "lg";

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  style?: CSSProperties;
  href?: string;
};

const sizes: Record<Size, CSSProperties> = {
  sm: { padding: "8px 14px", fontSize: 13, borderRadius: 12 },
  md: { padding: "11px 18px", fontSize: 14, borderRadius: 14 },
  lg: { padding: "14px 22px", fontSize: 15, borderRadius: 16 },
};

const variants: Record<Variant, CSSProperties> = {
  primary: {
    background: "#111",
    color: "#fff",
    boxShadow:
      "0 8px 24px rgba(17,17,32,0.10), 0 2px 6px rgba(17,17,32,0.06)",
  },
  secondary: {
    background: "rgba(255,255,255,0.7)",
    color: "var(--fg)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
  },
  ghost: { background: "transparent", color: "var(--fg)" },
  accent: {
    background: "var(--accent)",
    color: "#fff",
    boxShadow: "var(--shadow-glow-accent)",
  },
};

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  border: 0,
  cursor: "pointer",
  textDecoration: "none",
  transition:
    "transform 200ms var(--ease-out-soft), box-shadow 200ms var(--ease-out-soft), background 200ms var(--ease-out-soft)",
  whiteSpace: "nowrap",
  letterSpacing: "-0.005em",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  onClick,
  style,
  href,
}: ButtonProps) {
  const composed: CSSProperties = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    ...style,
  };

  const handleEnter = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.style.transform = "translateY(-1px)";
  };
  const handleLeave = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.style.transform = "translateY(0)";
  };

  if (href) {
    return (
      <a
        href={href}
        style={composed}
        onClick={onClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      style={composed}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
}
