"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";

/* WorldMap pulls in d3-geo + topojson-client + a 100KB+ world atlas. Keep
   it out of the initial bundle and only mount when the user is about to see
   it. Server still renders the page shell; the map hydrates on scroll. */
const WorldMap = dynamic(
  () => import("./world-map").then((m) => ({ default: m.WorldMap })),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

export function WorldMapLazy({ dict }: { dict: Dictionary["map"] }) {
  const [shouldMount, setShouldMount] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldMount(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {shouldMount ? <WorldMap dict={dict} /> : <MapSkeleton />}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        aspectRatio: "1600 / 700",
        background:
          "radial-gradient(60% 50% at 50% 50%, rgba(15,184,180,0.06), transparent 70%)",
      }}
    />
  );
}
