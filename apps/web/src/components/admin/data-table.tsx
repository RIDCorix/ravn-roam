"use client";

// Generic DataTable wrapper. TanStack Table's headless API + shadcn Table
// primitives + a small toolbar (column visibility menu). One file owns the
// pattern so all admin lists feel identical — no per-page table reinvention.

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  // Column id used by the search box. Pass nothing to hide search.
  searchColumnId?: string;
  searchPlaceholder?: string;
  // Empty / error overrides; default copy is generic.
  emptyMessage?: string;
  toolbarRight?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchColumnId,
  searchPlaceholder,
  emptyMessage = "No results.",
  toolbarRight,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    {},
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const searchValue =
    searchColumnId != null
      ? ((table.getColumn(searchColumnId)?.getFilterValue() as string) ?? "")
      : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {searchColumnId ? (
          <Input
            value={searchValue}
            onChange={(e) =>
              table.getColumn(searchColumnId)?.setFilterValue(e.target.value)
            }
            placeholder={searchPlaceholder ?? "Search…"}
            className="max-w-xs h-8"
          />
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {toolbarRight}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Settings2 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">
                Toggle columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                    className="text-xs capitalize"
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow
                key={group.id}
                className="bg-surface-sunken/60 hover:bg-surface-sunken/60"
              >
                {group.headers.map((header) => {
                  const sortable =
                    !header.isPlaceholder && header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-xs font-medium text-fg-secondary uppercase tracking-wide",
                        sortable && "cursor-pointer select-none",
                      )}
                      onClick={
                        sortable
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {sortable ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-accent" />
                          ) : sortDir === "desc" ? (
                            <ArrowDown className="h-3 w-3 text-accent" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                          )
                        ) : null}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-divider hover:bg-surface-sunken/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-fg-secondary"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-fg-muted">
        {table.getFilteredRowModel().rows.length} rows
      </div>
    </div>
  );
}
