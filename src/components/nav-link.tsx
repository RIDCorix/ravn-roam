"use client";

import type { MouseEvent, ReactNode } from "react";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        fontSize: 13.5,
        color: "var(--fg-secondary)",
        textDecoration: "none",
        fontWeight: 400,
        transition: "color 180ms var(--ease-out-soft)",
      }}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        event.currentTarget.style.color = "var(--fg)";
      }}
      onMouseLeave={(event: MouseEvent<HTMLAnchorElement>) => {
        event.currentTarget.style.color = "var(--fg-secondary)";
      }}
    >
      {children}
    </a>
  );
}
