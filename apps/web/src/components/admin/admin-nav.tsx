"use client";

// Sidebar nav with active-state highlight. Lucide icons are imported here
// (client) rather than passed in as props from the server layout — RSC
// can't serialize bare component references through props, only JSX
// elements. Hard-coding the nav structure here also keeps the layout's
// server component free of icon-library deps.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Handshake,
  LayoutDashboard,
  Package,
  PackageSearch,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

export interface AdminNavLabels {
  dashboard: string;
  orders: string;
  products: string;
  suppliers: string;
  supplier_plans: string;
  vendors: string;
}

export function AdminNav({
  lang,
  labels,
}: {
  lang: string;
  labels: AdminNavLabels;
}) {
  const pathname = usePathname();

  const groups: NavGroup[] = [
    {
      items: [
        {
          href: `/${lang}/admin`,
          label: labels.dashboard,
          Icon: LayoutDashboard,
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          href: `/${lang}/admin/orders`,
          label: labels.orders,
          Icon: ShoppingBag,
        },
      ],
    },
    {
      label: "Catalog",
      items: [
        {
          href: `/${lang}/admin/products`,
          label: labels.products,
          Icon: Package,
        },
        {
          href: `/${lang}/admin/suppliers`,
          label: labels.suppliers,
          Icon: Building2,
        },
        {
          href: `/${lang}/admin/supplier-plans`,
          label: labels.supplier_plans,
          Icon: PackageSearch,
        },
      ],
    },
    {
      label: "Channels",
      items: [
        {
          href: `/${lang}/admin/vendors`,
          label: labels.vendors,
          Icon: Handshake,
        },
      ],
    },
  ];

  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          {group.label ? (
            <div className="px-2 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              {group.label}
            </div>
          ) : null}
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent-soft text-accent font-medium"
                    : "text-fg-secondary hover:bg-surface hover:text-fg",
                )}
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
