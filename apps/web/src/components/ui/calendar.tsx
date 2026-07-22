"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  DayPicker,
  getDefaultClassNames,
  type ChevronProps,
} from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: cn(defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 sm:flex-row",
          defaultClassNames.months,
        ),
        month: cn("space-y-4", defaultClassNames.month),
        month_caption: cn(
          "flex h-9 items-center justify-center",
          defaultClassNames.month_caption,
        ),
        caption_label: cn(
          "text-[13px] font-semibold text-fg",
          defaultClassNames.caption_label,
        ),
        nav: cn(
          "absolute inset-x-0 top-0 flex items-center justify-between",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "h-8 w-8 rounded-xl border-divider bg-white text-fg-muted hover:border-accent/35 hover:bg-accent-soft hover:text-accent",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "h-8 w-8 rounded-xl border-divider bg-white text-fg-muted hover:border-accent/35 hover:bg-accent-soft hover:text-accent",
          defaultClassNames.button_next,
        ),
        month_grid: cn(
          "w-full border-collapse space-y-1",
          defaultClassNames.month_grid,
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "w-9 rounded-md text-[11px] font-semibold text-fg-muted",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn(
          "relative h-9 w-9 p-0 text-center text-[13px] focus-within:relative focus-within:z-20",
          "[&:has([aria-selected].rdp-range_middle)]:bg-accent-soft",
          "[&:has([aria-selected].rdp-range_start)]:rounded-l-xl [&:has([aria-selected].rdp-range_start)]:bg-accent",
          "[&:has([aria-selected].rdp-range_end)]:rounded-r-xl [&:has([aria-selected].rdp-range_end)]:bg-accent",
          "[&:has([aria-selected].rdp-selected)]:rounded-xl",
          defaultClassNames.day,
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "h-9 w-9 rounded-xl p-0 font-semibold text-fg hover:bg-accent-soft hover:text-accent aria-selected:opacity-100",
          defaultClassNames.day_button,
        ),
        range_start: cn(
          "text-white [&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent",
          defaultClassNames.range_start,
        ),
        range_middle: cn(
          "text-accent [&>button]:bg-transparent [&>button]:text-accent [&>button]:hover:bg-transparent",
          defaultClassNames.range_middle,
        ),
        range_end: cn(
          "text-white [&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent",
          defaultClassNames.range_end,
        ),
        selected: cn(
          "[&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent",
          defaultClassNames.selected,
        ),
        today: cn(
          "[&>button]:border [&>button]:border-accent/40",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-fg-muted opacity-35 aria-selected:opacity-60",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "pointer-events-none text-fg-muted opacity-30",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        ...props.components,
      }}
      {...props}
    />
  );
}

function CalendarChevron({
  orientation,
  className,
  ...props
}: ChevronProps) {
  const Icon: LucideIcon =
    orientation === "left"
      ? ChevronLeft
      : orientation === "right"
        ? ChevronRight
        : ChevronDown;

  return <Icon className={cn("h-4 w-4", className)} {...props} />;
}

export { Calendar };
