"use client";

// Admin sidebar — buff_frontend visual model. Uses shadcn Sidebar
// primitives for collapsible / icon-only mode + keyboard shortcut
// (Cmd-B). Nav data lives here (not server-side) because Lucide icons
// are components and can't be serialized through RSC props.

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

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

export interface AdminSidebarLabels {
  dashboard: string;
  orders: string;
  products: string;
  suppliers: string;
  supplier_plans: string;
  vendors: string;
}

export function AdminSidebar({
  lang,
  labels,
}: {
  lang: string;
  labels: AdminSidebarLabels;
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          href={`/${lang}/admin`}
          className="flex items-center gap-2 px-2 py-2 font-semibold tracking-tight text-sidebar-foreground"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-[13px] font-semibold">
            r
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Roam
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, gi) => (
          <SidebarGroup key={gi}>
            {group.label ? (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
