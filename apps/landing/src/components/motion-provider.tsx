"use client";

import { LazyMotion, domAnimation } from "motion/react";

/* LazyMotion swaps the full motion runtime (~30KB gzip) for a lazy-loaded
   feature bundle. `domAnimation` covers transform / opacity / keyframes —
   everything this site uses. Components inside must use `m.div` instead of
   `motion.div` (we don't enable `strict` so direct `motion` use still works
   if a third-party slips in, but ours are all converted to `m`). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
