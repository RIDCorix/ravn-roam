"use client";

// Path-driven breadcrumbs for the admin shell. Reads usePathname so we don't
// need every page to thread crumb props through the tree. Segments become
// crumb labels via a small lookup; UUIDs (product IDs) get truncated.
//
// Locale prefix (`/en` / `/zh-TW`) is stripped — we never want it as a crumb.

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  products: "Products",
  "supplier-plans": "Supplier plans",
  new: "New",
  edit: "Edit",
  preview: "Preview",
};

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // UUID: shorten to first 8 chars for readability.
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    )
  ) {
    return `${segment.slice(0, 8)}…`;
  }
  return segment;
}

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  // /<lang>/admin/products/<id>/edit → ["admin", "products", "<id>", "edit"]
  const parts = pathname.split("/").filter(Boolean);
  const lang = parts[0] ?? "";
  const crumbs = parts.slice(1);

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((segment, idx) => {
          const href = `/${lang}/${crumbs.slice(0, idx + 1).join("/")}`;
          const isLast = idx === crumbs.length - 1;
          return (
            <span key={href} className="contents">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{labelFor(segment)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{labelFor(segment)}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
