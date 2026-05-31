"use client";

// Vendor list table — uses the shared DataTable so we get sort / group /
// pin / column-resize for free, plus the row right-click menu added in
// the same pass that wires this page in.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTransition } from "react";
import {
  CircleDot,
  Edit3,
  Mail,
  Pause,
  Play,
  Power,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { patchVendor, type Vendor } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

import type { AdminDict } from "@/components/admin/dict";

import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { DataTable } from "@/components/admin/data-table";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Vendor["status"][] = ["active", "paused", "terminated"];
const STATUS_ICON: Record<Vendor["status"], React.ComponentType<{ className?: string }>> = {
  active: Play,
  paused: Pause,
  terminated: Power,
};
const STATUS_BADGE: Record<Vendor["status"], string> = {
  active: "bg-success/15 text-success",
  paused: "bg-warning/15 text-warning",
  terminated: "bg-destructive/15 text-destructive",
};

export function VendorsTable({
  vendors,
  lang,
  dict,
}: {
  vendors: Vendor[];
  lang: string;
  dict: AdminDict["admin"];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function changeStatus(v: Vendor, next: Vendor["status"]) {
    if (v.status === next) return;
    try {
      await patchVendor(v.id, { status: next });
      toast.success(
        `${v.display_name} → ${dict.vendors.statuses[next]}`,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  const columns: ColumnDef<Vendor>[] = [
    {
      id: "code",
      header: dict.vendors.columns.code,
      accessorKey: "code",
      cell: (info) => (
        <span className="font-mono text-xs">{info.row.original.code}</span>
      ),
      enableGrouping: false,
    },
    {
      id: "name",
      header: dict.vendors.columns.name,
      accessorKey: "display_name",
      cell: (info) => (
        <Link
          href={`/${lang}/admin/vendors/${info.row.original.id}`}
          className="font-medium text-foreground hover:text-primary"
        >
          {info.row.original.display_name}
        </Link>
      ),
      enableGrouping: false,
    },
    {
      id: "status",
      header: dict.vendors.columns.status,
      accessorKey: "status",
      cell: (info) => {
        const s = info.row.original.status;
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              STATUS_BADGE[s],
            )}
          >
            {dict.vendors.statuses[s]}
          </span>
        );
      },
      enableGrouping: true,
    },
    {
      id: "commission_rate",
      header: dict.vendors.columns.commission,
      accessorFn: (v) => v.commission_rate ?? 0,
      cell: (info) => {
        const v = info.row.original.commission_rate;
        if (v == null)
          return <span className="text-muted-foreground">—</span>;
        return (
          <span className="font-mono text-xs tabular-nums">
            {(v * 100).toFixed(1)}%
          </span>
        );
      },
      enableGrouping: false,
    },
    {
      id: "contact",
      header: dict.vendors.columns.contact,
      accessorKey: "contact_email",
      cell: (info) => {
        const e = info.row.original.contact_email;
        if (!e) return <span className="text-muted-foreground">—</span>;
        return (
          <a
            href={`mailto:${e}`}
            className="text-muted-foreground hover:text-primary"
          >
            {e}
          </a>
        );
      },
      enableGrouping: false,
    },
    {
      id: "updated_at",
      header: dict.vendors.columns.updated_at,
      accessorKey: "updated_at",
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatDateTime(info.row.original.updated_at)}
        </span>
      ),
      enableGrouping: false,
    },
  ];

  return (
    <DataTable
      tableId="admin-vendors"
      columns={columns}
      data={vendors}
      searchColumnId="name"
      searchPlaceholder={dict.vendors.filters.search_placeholder}
      emptyMessage={dict.vendors.no_vendors}
      enableCsvExport
      csvFilename="vendors"
      rowContextMenu={(vendor) => (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <CircleDot className="mr-2 h-4 w-4" />
              變更狀態
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              {STATUS_OPTIONS.map((s) => {
                const Icon = STATUS_ICON[s];
                const current = vendor.status === s;
                return (
                  <ContextMenuItem
                    key={s}
                    onClick={() => changeStatus(vendor, s)}
                    disabled={current}
                  >
                    <Icon
                      className={cn(
                        "mr-2 h-4 w-4",
                        s === "active" && "text-success",
                        s === "paused" && "text-warning",
                        s === "terminated" && "text-destructive",
                      )}
                    />
                    {dict.vendors.statuses[s]}
                    {current ? (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        現在
                      </span>
                    ) : null}
                  </ContextMenuItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem asChild>
            <Link href={`/${lang}/admin/vendors/${vendor.id}`}>
              <Edit3 className="mr-2 h-4 w-4" />
              編輯
            </Link>
          </ContextMenuItem>
          {vendor.contact_email ? (
            <ContextMenuItem asChild>
              <a href={`mailto:${vendor.contact_email}`}>
                <Mail className="mr-2 h-4 w-4" />
                寄信給 {vendor.display_name}
              </a>
            </ContextMenuItem>
          ) : null}
        </>
      )}
    />
  );
}
