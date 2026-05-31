import * as React from "react";

import { cn } from "@/lib/utils";

function Timeline({
  className,
  ...props
}: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="timeline"
      className={cn("flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
      {...props}
    />
  );
}

function TimelineItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="timeline-item"
      className={cn("relative shrink-0", className)}
      {...props}
    />
  );
}

function TimelineTrack({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-track"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

function TimelineDot({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="timeline-dot"
      className={cn(
        "relative z-10 inline-flex h-3 w-3 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)]",
        className,
      )}
      {...props}
    />
  );
}

function TimelineConnector({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="timeline-connector"
      className={cn("h-px min-w-12 flex-1 bg-border", className)}
      {...props}
    />
  );
}

function TimelineContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-content"
      className={cn("mt-3", className)}
      {...props}
    />
  );
}

export {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineTrack,
};
