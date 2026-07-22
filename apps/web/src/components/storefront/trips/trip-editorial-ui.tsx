import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const FALLBACK_COVERS = [
  "/illustrations/cities/barcelona.jpg",
  "/illustrations/cities/paris.jpg",
  "/illustrations/cities/london.jpg",
  "/illustrations/cities/kyoto.jpg",
  "/illustrations/cities/milan.jpg",
  "/illustrations/cities/taipei.jpg",
] as const;

function stableIndex(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % FALLBACK_COVERS.length;
}

export function editorialCoverSource(
  explicitCover: string | null | undefined,
  seed: string,
): string {
  if (explicitCover?.startsWith("/")) return explicitCover;
  return FALLBACK_COVERS[stableIndex(seed)] ?? FALLBACK_COVERS[0];
}

export function EditorialCover({
  src,
  seed,
  alt = "",
  sizes,
  priority = false,
  className,
}: {
  src?: string | null;
  seed: string;
  alt?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      data-testid="trip-editorial-cover"
      src={editorialCoverSource(src, seed)}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}

export function EditorialMasthead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-testid="trip-editorial-masthead"
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-divider bg-paper-raised shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function EditorialRouteStamp({
  route,
  date,
  className,
}: {
  route: string;
  date: string;
  className?: string;
}) {
  return (
    <div
      data-testid="trip-editorial-stamp"
      aria-label={`${route}, ${date}`}
      className={cn(
        "grid h-[76px] w-[76px] rotate-[-8deg] place-items-center rounded-full border border-fg/20 text-center font-mono text-[9px] font-semibold uppercase leading-[1.35] tracking-[0.16em] text-fg-secondary shadow-[inset_0_0_0_3px_var(--paper-raised),inset_0_0_0_4px_var(--divider-strong)]",
        className,
      )}
    >
      <span className="max-w-[58px]">
        {route}
        <span className="my-0.5 block text-[8px] tracking-[0.08em] text-fg-muted">
          {date}
        </span>
      </span>
    </div>
  );
}

export function EditorialSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
