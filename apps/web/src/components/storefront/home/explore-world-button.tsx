"use client";

import { useRouter } from "next/navigation";
import { Plane } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";

import { PlaneLoading } from "@/components/storefront/plane-loading";

export function ExploreWorldButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const router = useRouter();
  const planeRef = useRef<HTMLSpanElement>(null);
  const [launching, setLaunching] = useState(false);
  const [launchStyle, setLaunchStyle] = useState<CSSProperties>({});

  function handleClick() {
    if (launching) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      router.push(href);
      return;
    }

    const planeBox = planeRef.current?.getBoundingClientRect();
    if (planeBox) {
      const targetX = window.innerWidth / 2;
      const targetY = window.innerHeight / 2;
      const planeX = planeBox.left + planeBox.width / 2;
      const planeY = planeBox.top + planeBox.height / 2;
      const dx = targetX - planeX;
      const dy = targetY - planeY;
      setLaunchStyle({
        "--launch-x": `${dx - 5}px`,
        "--launch-y": `${dy + 6}px`,
        "--launch-mid-x": `${dx * 0.5}px`,
        "--launch-mid-y": `${dy * 0.32 - 74}px`,
      } as CSSProperties);
    }

    setLaunching(true);
    window.setTimeout(() => {
      router.push(href);
    }, 1160);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="hero-explore-button group mt-9 inline-flex items-center gap-3 text-[17px] font-semibold text-white"
        data-launching={launching ? "true" : "false"}
        style={launchStyle}
      >
        <span className="hero-explore-thrust" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} style={{ "--i": index } as CSSProperties} />
          ))}
        </span>
        <span
          ref={planeRef}
          className="hero-explore-plane grid h-11 w-11 place-items-center rounded-full border border-white/70 bg-white/10 backdrop-blur-sm"
        >
          <Plane className="ml-0.5 h-5 w-5 fill-white text-white" />
        </span>
        <span>{label}</span>
      </button>
      <div
        aria-hidden="true"
        className="hero-route-transition pointer-events-none fixed inset-0 z-[80] opacity-0"
        data-launching={launching ? "true" : "false"}
      >
        <PlaneLoading className="hero-route-loader" />
      </div>
    </>
  );
}
