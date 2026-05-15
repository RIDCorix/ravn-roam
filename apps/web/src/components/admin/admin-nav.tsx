"use client";

// Sidebar nav with active-state highlight. Lives client-side so we can read
// pathname; the rest of the admin shell stays a server component.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export interface AdminNavGroup {
  label?: string;
  items: AdminNavItem[];
}

export function AdminNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();

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
