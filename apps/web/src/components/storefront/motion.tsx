"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export const appSpring = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.8,
} as const;

export const softSpring = {
  type: "spring",
  stiffness: 300,
  damping: 28,
  mass: 0.9,
} as const;

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: appSpring,
} as const;

export const popIn = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 8 },
  transition: softSpring,
} as const;

const MotionNextLink = motion.create(Link);

type MotionLinkProps = ComponentProps<typeof Link> &
  Omit<HTMLMotionProps<"a">, "href">;

export function MotionLink({
  whileHover = { y: -1 },
  whileTap = { scale: 0.97 },
  transition = appSpring,
  ...props
}: MotionLinkProps) {
  return (
    <MotionNextLink
      whileHover={whileHover}
      whileTap={whileTap}
      transition={transition}
      {...props}
    />
  );
}

export function MotionButton({
  whileHover = { y: -1 },
  whileTap = { scale: 0.96 },
  transition = appSpring,
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <motion.button
      whileHover={whileHover}
      whileTap={whileTap}
      transition={transition}
      {...props}
    />
  );
}
