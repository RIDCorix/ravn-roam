"use client";

import type { MouseEvent, ReactNode } from "react";

export function FooterLink({
  href,
  children,
  variant = "support",
}: {
  href: string;
  children: ReactNode;
  variant?: "support" | "column";
}) {
  if (variant === "column") {
    return (
      <a
        href={href}
        style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.85)",
          textDecoration: "none",
          letterSpacing: "-0.005em",
          transition: "color 180ms var(--ease-out-soft)",
        }}
        onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => {
          e.currentTarget.style.color = "#A6E8E5";
        }}
        onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => {
          e.currentTarget.style.color = "rgba(255,255,255,0.85)";
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "11px 18px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 500,
        textDecoration: "none",
        transition: "background 200ms var(--ease-out-soft)",
      }}
      onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.14)";
      }}
      onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
    >
      {children}
    </a>
  );
}
