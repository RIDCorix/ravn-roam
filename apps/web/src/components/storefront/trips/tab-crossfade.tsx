"use client";

// Wraps the trip-detail tab body in a React 19 <ViewTransition> keyed by
// the current pathname segment so navigations between /trips/[id]/(overview)
// and /trips/[id]/checklist crossfade instead of hard-cutting. The
// `tab-fade` class is targeted by the `::view-transition-old/new(.tab-fade)`
// rules in globals.css.
//
// Server pages render their content as children; this wrapper lives one
// component above so the parent (trip-detail layout) can stay a server
// component.

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

export function TabCrossfade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <ViewTransition
      key={pathname}
      name="trip-tab-content"
      share="auto"
      enter="tab-fade"
      exit="tab-fade"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
