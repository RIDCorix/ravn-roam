"use client";

// Supplier-plan list as a TanStack Table. Server passes the raw rows in;
// sort / filter / column-visibility live entirely in client state, so the
// admin can reorder columns without a server round-trip.

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import type { SupplierPlan } from "@roam/catalog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable } from "./data-table";
import { formatData, formatValidity } from "@/lib/format";

import type { AdminDict } from "./dict";

export function SupplierPlansTable({
  lang,
  dict,
  plans,
}: {
  lang: string;
  dict: AdminDict;
  plans: SupplierPlan[];
}) {
  const columns = React.useMemo<ColumnDef<SupplierPlan>[]>(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: dict.admin.supplier_plans.columns.name,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "external_id",
        id: "external_id",
        header: dict.admin.supplier_plans.columns.external_id,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-fg-secondary">
            {row.original.external_id}
          </span>
        ),
      },
      {
        accessorKey: "destinations",
        id: "destinations",
        header: dict.admin.supplier_plans.columns.destinations,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.destinations.slice(0, 4).map((d) => (
              <Badge key={d} variant="secondary" className="font-mono text-[10px]">
                {d}
              </Badge>
            ))}
            {row.original.destinations.length > 4 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px]">
                    +{row.original.destinations.length - 4}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {row.original.destinations.slice(4).join(", ")}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "data_amount_mb",
        id: "data",
        header: dict.admin.supplier_plans.columns.data,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatData(row.original.data_amount_mb)}
          </span>
        ),
      },
      {
        accessorKey: "validity_days",
        id: "validity",
        header: dict.admin.supplier_plans.columns.validity,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatValidity(row.original.validity_days)}
          </span>
        ),
      },
      {
        accessorKey: "activation_policy",
        id: "activation",
        header: dict.admin.supplier_plans.columns.activation_policy,
        cell: ({ row }) => (
          <span className="text-xs text-fg-secondary">
            {dict.admin.supplier_plans.activation_policies[
              row.original.activation_policy
            ] ?? row.original.activation_policy}
          </span>
        ),
      },
      {
        accessorKey: "delivery_model",
        id: "delivery",
        header: dict.admin.supplier_plans.columns.delivery_model,
        cell: ({ row }) => (
          <span className="text-xs text-fg-secondary">
            {dict.admin.supplier_plans.delivery_models[
              row.original.delivery_model
            ] ?? row.original.delivery_model}
          </span>
        ),
      },
      {
        accessorKey: "cost_amount",
        id: "cost",
        header: () => (
          <span className="block text-right">
            {dict.admin.supplier_plans.columns.cost}
          </span>
        ),
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {row.original.cost_amount} {row.original.cost_currency}
          </span>
        ),
      },
      {
        accessorKey: "available",
        id: "available",
        header: dict.admin.supplier_plans.columns.available,
        cell: ({ row }) =>
          row.original.available ? (
            <CheckCircle2 className="h-4 w-4 text-success" aria-label="yes" />
          ) : (
            <XCircle className="h-4 w-4 text-fg-muted" aria-label="no" />
          ),
      },
      {
        id: "action",
        header: () => null,
        enableHiding: false,
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Link
              href={`/${lang}/admin/products/new?from_plan=${row.original.id}`}
            >
              {dict.admin.supplier_plans.row_action_create_product}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        ),
      },
    ],
    [lang, dict],
  );

  return (
    <DataTable
      columns={columns}
      data={plans}
      searchColumnId="name"
      searchPlaceholder={dict.admin.supplier_plans.filters.search_placeholder}
      emptyMessage={dict.admin.common.no_results}
    />
  );
}
