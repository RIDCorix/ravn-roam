"use client";

import { m } from "motion/react";
import Image from "next/image";

interface LumiTravelerProps {
  size?: number;
  /* Idle bob. Off for static screenshots / OG images. */
  idle?: boolean;
  /* Optional accessible label override. */
  alt?: string;
}

/* Static character art rendered via next/image so it gets WebP/AVIF
   conversion and responsive sizing for free. Idle bob is the only motion;
   stronger reactive states (look / speak / think) aren't available for a
   raster character — swap back to the SVG Lumi if you need those. */
export function LumiTraveler({
  size = 140,
  idle = true,
  alt = "Lumi",
}: LumiTravelerProps) {
  return (
    <m.div
      style={{
        width: size,
        height: size,
        display: "inline-block",
        lineHeight: 0,
      }}
      animate={idle ? { y: [0, -2.5, 0] } : { y: 0 }}
      transition={
        idle
          ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.3 }
      }
    >
      <Image
        src="/lumi.png"
        alt={alt}
        width={size}
        height={size}
        priority={false}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </m.div>
  );
}
