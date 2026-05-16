"use client";

import { m } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

const EASE = [0.22, 0.61, 0.36, 1] as const;

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  /* false = animate on mount (use for above-the-fold like hero);
     true (default) = animate when scrolled into view. */
  inView?: boolean;
  once?: boolean;
  style?: CSSProperties;
  className?: string;
};

export function Reveal({
  children,
  delay = 0,
  y = 18,
  duration = 0.6,
  inView = true,
  once = true,
  style,
  className,
}: RevealProps) {
  const motionProps = inView
    ? {
        initial: { opacity: 0, y },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once, margin: "-40px" },
      }
    : {
        initial: { opacity: 0, y },
        animate: { opacity: 1, y: 0 },
      };
  return (
    <m.div
      {...motionProps}
      transition={{ duration, delay, ease: EASE }}
      style={style}
      className={className}
    >
      {children}
    </m.div>
  );
}
