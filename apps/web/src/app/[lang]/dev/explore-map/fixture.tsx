"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { googleMapsMapId } from "@/lib/google-maps";

const LeafletTripMap = dynamic(
  () => import("@/components/storefront/trips/trip-map").then((mod) => mod.TripMap),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#dff4f2]" /> },
);

const CITIES = [
  { name: "米蘭", lat: 45.4642, lng: 9.19 },
  { name: "巴黎", lat: 48.8566, lng: 2.3522 },
];

export function ExploreMapFixture() {
  const [lastClick, setLastClick] = useState<string>("（還沒點擊）");
  return (
    <div className="min-h-screen bg-bg p-6">
      <p className="text-[14px] font-semibold">explore-map repro</p>
      <p data-pt="last-click" className="mt-1 text-[12px] text-fg-muted">
        {lastClick}
      </p>
      <p data-map-id={googleMapsMapId ?? ""} className="text-[11px] text-fg-muted">
        mapId: {googleMapsMapId ? "set" : "MISSING"}
      </p>
      <section className="roam-explore-stage-map relative mt-3 h-[70vh] overflow-hidden rounded-[24px] border border-divider">
        <LeafletTripMap
          cities={CITIES}
          exploreSelectMode
          onExploreClick={(point) =>
            setLastClick(
              `click lat=${point.lat.toFixed(3)} lng=${point.lng.toFixed(3)} placeId=${point.placeId ?? "null"}`,
            )
          }
        />
        <style>{`
          .roam-explore-stage-map .roam-trip-map { height: 100%; border-radius: 0; }
        `}</style>
      </section>
    </div>
  );
}
