"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export const appEase = [0.32, 0.72, 0, 1] as const;
export const smoothEase = [0.4, 0, 0.2, 1] as const;

export const appSpring = {
  type: "tween",
  duration: 0.22,
  ease: appEase,
} as const;

export const softSpring = {
  type: "tween",
  duration: 0.28,
  ease: appEase,
} as const;

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: appSpring,
} as const;

export const popIn = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 8 },
  transition: softSpring,
} as const;

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: {
    type: "tween",
    duration: 0.32,
    ease: appEase,
  },
} as const;

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.035,
    },
  },
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
