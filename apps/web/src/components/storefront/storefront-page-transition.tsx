"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { pageTransition } from "@/components/storefront/motion";

export function StorefrontPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main key={pathname} {...pageTransition}>
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
