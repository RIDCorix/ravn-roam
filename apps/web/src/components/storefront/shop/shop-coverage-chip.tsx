import { motion } from "framer-motion";

import { appSpring } from "@/components/storefront/motion";
import { cn } from "@/lib/utils";

export function CoverageChip({
  label,
  count,
  active,
  full,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  full?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      layout
      whileHover={{ y: -1, scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      transition={appSpring}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? full
            ? "bg-success text-white"
            : "bg-accent text-white"
          : "bg-surface text-fg-secondary hover:bg-surface-hover",
      )}
      style={!active ? { boxShadow: "var(--shadow-card)" } : undefined}
    >
      {full && active ? <span className="text-[10px]">✓</span> : null}
      {label}
      {count != null ? (
        <span
          className={cn(
            "text-[10px] tabular-nums",
            active ? "opacity-80" : "text-fg-muted",
          )}
        >
          {count}
        </span>
      ) : null}
    </motion.button>
  );
}
