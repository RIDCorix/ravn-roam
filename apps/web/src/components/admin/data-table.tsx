"use client";

// Generic DataTable wrapper. TanStack Table headless API + shadcn Table
// primitives + buff-flavored ergonomics. Single-file so the pattern is
// easy to grep / fork.
//
// Supported features:
//   • Sort, single-column search, column visibility menu, density toggle
//   • Row selection (auto-injected checkbox column) + bulk actions slot
//   • Pagination (opt-out via pagination={false})
//   • CSV export (exports filtered rows, not just current page)
//   • Loading skeleton + customizable empty state
//   • Column resize (drag handle on header right edge)
//   • Column pinning (left / right / unpin via per-header dropdown)
//   • Persistence: column visibility / sizing / pinning / density in
//     localStorage keyed by `tableId`
//
// Not yet here (next phases): drag-reorder, virtualization, filter
// pills, group-by.

import * as React from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type FilterFn,
  type Header,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
  type ExpandedState,
  type GroupingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Group,
  Download,
  EyeOff,
  Filter,
  GripVertical,
  MoreVertical,
  Plus,
  Pin,
  PinOff,
  Rows2,
  Rows4,
  Search,
  Settings2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Density = "compact" | "comfortable";

// ─── filter model ────────────────────────────────────────────────
// Each filterable column declares a filterType via columnDef.meta.
// The stored filter value is a structured { op, value } object — the
// shared `roamFilter` filterFn switches on op to compute the predicate.

export type FilterType = "text" | "number" | "select" | "boolean" | "date";
export type FilterOp =
  | "contains" | "equals" | "startsWith" | "endsWith"
  | "eq" | "neq" | "lt" | "gt" | "lte" | "gte" | "between"
  | "is" | "isNot"
  | "before" | "after";

export interface FilterValue {
  op: FilterOp;
  value: unknown; // primitive or [a, b] for between
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    filterType?: FilterType;
    filterLabel?: string;
    filterOptions?: Array<{ label: string; value: string | number | boolean }>;
  }
}

const FILTER_OPS_BY_TYPE: Record<FilterType, FilterOp[]> = {
  text: ["contains", "equals", "startsWith", "endsWith"],
  number: ["eq", "neq", "lt", "gt", "lte", "gte", "between"],
  select: ["is", "isNot"],
  boolean: ["is"],
  date: ["eq", "before", "after"],
};

const OP_LABELS: Record<FilterOp, string> = {
  contains: "contains",
  equals: "equals",
  startsWith: "starts with",
  endsWith: "ends with",
  eq: "=",
  neq: "≠",
  lt: "<",
  gt: ">",
  lte: "≤",
  gte: "≥",
  between: "between",
  is: "is",
  isNot: "is not",
  before: "before",
  after: "after",
};

const roamFilter: FilterFn<unknown> = (row, columnId, raw) => {
  const fv = raw as FilterValue | undefined;
  if (!fv || fv.value == null || fv.value === "") return true;
  const cell = row.getValue(columnId);
  const { op, value } = fv;

  // Text
  if (
    op === "contains" || op === "equals" || op === "startsWith" || op === "endsWith"
  ) {
    const cv = String(cell ?? "").toLowerCase();
    const v = String(value).toLowerCase();
    if (op === "contains") return cv.includes(v);
    if (op === "equals") return cv === v;
    if (op === "startsWith") return cv.startsWith(v);
    return cv.endsWith(v);
  }
  // Number
  if (op === "eq" || op === "neq" || op === "lt" || op === "gt" || op === "lte" || op === "gte") {
    const cv = Number(cell);
    const n = Number(value);
    if (Number.isNaN(cv) || Number.isNaN(n)) return false;
    if (op === "eq") return cv === n;
    if (op === "neq") return cv !== n;
    if (op === "lt") return cv < n;
    if (op === "gt") return cv > n;
    if (op === "lte") return cv <= n;
    return cv >= n;
  }
  if (op === "between") {
    if (!Array.isArray(value) || value.length !== 2) return true;
    const cv = Number(cell);
    const a = Number(value[0]);
    const b = Number(value[1]);
    return cv >= Math.min(a, b) && cv <= Math.max(a, b);
  }
  // Select / boolean
  if (op === "is") return cell === value;
  if (op === "isNot") return cell !== value;
  // Date
  if (op === "before" || op === "after") {
    const cd = new Date(String(cell)).getTime();
    const vd = new Date(String(value)).getTime();
    if (Number.isNaN(cd) || Number.isNaN(vd)) return false;
    return op === "before" ? cd < vd : cd > vd;
  }
  return true;
};


export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];

  // Search box wired to a single text column.
  searchColumnId?: string;
  searchPlaceholder?: string;

  // Empty / loading.
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  loading?: boolean;
  skeletonRows?: number;

  // Extra controls in the toolbar.
  toolbarRight?: React.ReactNode;

  // Pagination — `false` to opt out.
  pagination?: false | { pageSize?: number };

  // Row selection.
  enableRowSelection?: boolean;
  bulkActions?: (selectedRows: TData[]) => React.ReactNode;
  getRowId?: (row: TData, index: number) => string;

  // CSV export.
  enableCsvExport?: boolean;
  csvFilename?: string;

  // Persistence + default UI prefs.
  tableId?: string;
  defaultDensity?: Density;

  // Column resize / pinning / drag-reorder toggles (default all on).
  enableColumnResizing?: boolean;
  enableColumnPinning?: boolean;
  enableColumnReorder?: boolean;

  // Row virtualization — opt-in. Pass an object to enable; the
  // scrolling container then receives a fixed max-height so the
  // virtualizer can compute visible rows. Skipped when `loading` or
  // the table is empty.
  virtual?: {
    rowHeight?: number; // estimated px, default 40
    height?: number; // max-h of scroll container, default 560
    overscan?: number; // extra rows above/below viewport, default 8
  };

  // Right-click context menu per row — return the inner items for a
  // <ContextMenuContent>. The slot wraps each row with Radix's
  // ContextMenu so callers don't have to plumb the trigger themselves.
  rowContextMenu?: (row: TData) => React.ReactNode;
}

interface PersistedState {
  columnVisibility?: VisibilityState;
  columnSizing?: ColumnSizingState;
  columnPinning?: ColumnPinningState;
  columnOrder?: ColumnOrderState;
  density?: Density;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchColumnId,
  searchPlaceholder,
  emptyMessage = "No results.",
  emptyDescription,
  emptyIcon,
  loading = false,
  skeletonRows = 8,
  toolbarRight,
  pagination = { pageSize: 20 },
  enableRowSelection = false,
  bulkActions,
  getRowId,
  enableCsvExport = false,
  csvFilename,
  tableId,
  defaultDensity = "comfortable",
  enableColumnResizing = true,
  enableColumnPinning = true,
  enableColumnReorder = true,
  virtual,
  rowContextMenu,
}: DataTableProps<TData, TValue>) {
  // ── persistence ────────────────────────────────────────────────
  const storageKey = tableId ? `datatable:${tableId}` : null;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>({
    left: [],
    right: [],
  });
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);
  const [grouping, setGrouping] = React.useState<GroupingState>([]);
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [paginationState, setPaginationState] = React.useState<PaginationState>(
    {
      pageIndex: 0,
      pageSize: pagination === false ? 100_000 : pagination?.pageSize ?? 20,
    },
  );
  const [density, setDensity] = React.useState<Density>(defaultDensity);

  // Hydrate persisted prefs once on mount.
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as PersistedState;
      if (saved.columnVisibility) setColumnVisibility(saved.columnVisibility);
      if (saved.columnSizing) setColumnSizing(saved.columnSizing);
      if (saved.columnPinning) setColumnPinning(saved.columnPinning);
      if (saved.columnOrder) setColumnOrder(saved.columnOrder);
      if (saved.density) setDensity(saved.density);
    } catch {
      /* corrupt entry — ignore */
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          columnVisibility,
          columnSizing,
          columnPinning,
          columnOrder,
          density,
        } satisfies PersistedState),
      );
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [
    storageKey,
    columnVisibility,
    columnSizing,
    columnPinning,
    columnOrder,
    density,
  ]);

  // ── columns (auto-attach filterFn from meta.filterType + inject
  // selection column if needed). The roamFilter understands the
  // structured { op, value } payload set by FilterPopover.
  const filterEnhanced = React.useMemo<ColumnDef<TData, TValue>[]>(
    () =>
      columns.map((c) =>
        c.meta?.filterType && !c.filterFn
          ? ({ ...c, filterFn: roamFilter as FilterFn<TData> })
          : c,
      ),
    [columns],
  );
  const effectiveColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!enableRowSelection) return filterEnhanced;
    const selectionColumn: ColumnDef<TData, TValue> = {
      id: "__select",
      enableHiding: false,
      enableSorting: false,
      enableResizing: false,
      enablePinning: false,
      size: 36,
      minSize: 36,
      maxSize: 36,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    };
    return [selectionColumn, ...filterEnhanced];
  }, [filterEnhanced, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: effectiveColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      columnPinning,
      columnOrder,
      grouping,
      expanded,
      rowSelection,
      pagination: paginationState,
    },
    enableRowSelection,
    enableColumnResizing,
    enableColumnPinning,
    columnResizeMode: "onChange",
    getRowId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
    onColumnOrderChange: setColumnOrder,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPaginationState,
    autoResetExpanded: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel:
      pagination === false ? undefined : getPaginationRowModel(),
  });

  // ── derived ────────────────────────────────────────────────────
  const searchValue =
    searchColumnId != null
      ? ((table.getColumn(searchColumnId)?.getFilterValue() as string) ?? "")
      : "";
  const totalRows = table.getFilteredRowModel().rows.length;
  const visibleRows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const showPagination =
    pagination !== false && totalRows > paginationState.pageSize;
  const selectedRows = enableRowSelection
    ? table.getSelectedRowModel().rows.map((r) => r.original as TData)
    : [];
  const selectedCount = selectedRows.length;

  const cellPadY = density === "compact" ? "py-1.5" : "py-2.5";
  const headerPadY = density === "compact" ? "h-8" : "h-9";

  // ── CSV export ─────────────────────────────────────────────────
  const handleExportCsv = React.useCallback(() => {
    const csvColumns = table
      .getVisibleLeafColumns()
      .filter((c) => c.id !== "__select");
    const header = csvColumns.map((c) => {
      const h = c.columnDef.header;
      return typeof h === "string" ? h : c.id;
    });
    const rows = table.getFilteredRowModel().rows.map((row) =>
      csvColumns.map((c) => {
        const v = row.getValue(c.id);
        if (v == null) return "";
        if (typeof v === "object") {
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        }
        return String(v);
      }),
    );
    const escape = (s: string) =>
      /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const csv = [header, ...rows]
      .map((r) => r.map(escape).join(","))
      .join("\r\n");
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvFilename ?? tableId ?? "export"}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [table, csvFilename, tableId]);

  // ── drag-reorder (dnd-kit) ─────────────────────────────────────
  // We feed the visible-leaf column id list into a SortableContext.
  // On drag-end, swap two ids in the columnOrder state and let
  // TanStack re-render with the new order. Pinned + selection column
  // are filtered out so they stay locked in place.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const currentOrder = table
        .getAllLeafColumns()
        .map((c) => c.id);
      const oldIndex = currentOrder.indexOf(String(active.id));
      const newIndex = currentOrder.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      setColumnOrder(arrayMove(currentOrder, oldIndex, newIndex));
    },
    [table],
  );

  // ── virtualization (opt-in) ────────────────────────────────────
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const virtualEnabled = !!virtual && !loading && visibleRows.length > 0;
  const rowHeight = virtual?.rowHeight ?? 40;
  const scrollMaxH = virtual?.height ?? 560;
  const rowVirtualizer = useVirtualizer({
    count: virtualEnabled ? visibleRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: virtual?.overscan ?? 8,
  });
  const virtualItems = virtualEnabled ? rowVirtualizer.getVirtualItems() : [];
  const totalVirtualHeight = virtualEnabled ? rowVirtualizer.getTotalSize() : 0;
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalVirtualHeight - virtualItems[virtualItems.length - 1]!.end
      : 0;

  const sortableIds = React.useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .filter((c) => c.id !== "__select" && !c.getIsPinned())
        .map((c) => c.id),
    // Re-derive when visibility / pinning / order changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, columnVisibility, columnPinning, columnOrder],
  );

  // ── render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {searchColumnId ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) =>
                table.getColumn(searchColumnId)?.setFilterValue(e.target.value)
              }
              placeholder={searchPlaceholder ?? "Search…"}
              className="h-8 w-full max-w-xs pl-8"
            />
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {toolbarRight}
          <DensityToggle density={density} onChange={setDensity} />
          {enableCsvExport ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={handleExportCsv}
              disabled={totalRows === 0}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          ) : null}
          <ColumnsMenu table={table} />
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar table={table} searchColumnId={searchColumnId} />

      {/* Selection bar */}
      {enableRowSelection && selectedCount > 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/8 px-3 py-1.5">
          <Checkbox
            checked
            aria-label="Clear selection"
            onCheckedChange={() => table.resetRowSelection()}
          />
          <span className="text-xs font-medium text-foreground">
            {selectedCount} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            {bulkActions ? bulkActions(selectedRows) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-muted-foreground"
              onClick={() => table.resetRowSelection()}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div
          ref={scrollRef}
          className={cn(
            "overflow-x-auto",
            virtualEnabled && "overflow-y-auto",
          )}
          style={
            virtualEnabled ? { maxHeight: `${scrollMaxH}px` } : undefined
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={enableColumnReorder ? handleDragEnd : undefined}
          >
          <Table
            style={{
              width: table.getCenterTotalSize() + getPinnedWidth(table),
              minWidth: "100%",
            }}
          >
            <TableHeader className="sticky top-0 z-20 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/50">
              {table.getHeaderGroups().map((group) => (
                <TableRow
                  key={group.id}
                  className="border-border hover:bg-transparent"
                >
                  <SortableContext
                    items={sortableIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {group.headers.map((header) => (
                      <HeaderCell
                        key={header.id}
                        header={header}
                        density={density}
                        enableColumnResizing={enableColumnResizing}
                        enableColumnPinning={enableColumnPinning}
                        enableColumnReorder={enableColumnReorder}
                        headerPadY={headerPadY}
                      />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: skeletonRows }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="border-border">
                    {table.getVisibleLeafColumns().map((col, j) => (
                      <TableCell
                        key={col.id + j}
                        className={cellPadY}
                        style={getPinStyle(col)}
                      >
                        <Skeleton className="h-4 w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visibleRows.length > 0 ? (
                virtualEnabled ? (
                  <>
                    {paddingTop > 0 && (
                      <tr aria-hidden style={{ height: paddingTop }} />
                    )}
                    {virtualItems.map((vRow) => {
                      const row = visibleRows[vRow.index];
                      if (!row) return null;
                      return (
                        <DataRow
                          key={row.id}
                          row={row}
                          index={vRow.index}
                          cellPadY={cellPadY}
                          contextMenu={rowContextMenu}
                        />
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr aria-hidden style={{ height: paddingBottom }} />
                    )}
                  </>
                ) : (
                  visibleRows.map((row, i) => (
                    <DataRow
                      key={row.id}
                      row={row}
                      index={i}
                      cellPadY={cellPadY}
                      contextMenu={rowContextMenu}
                    />
                  ))
                )
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="py-16"
                  >
                    <div className="flex flex-col items-center gap-2 text-center">
                      {emptyIcon ? (
                        <div className="text-muted-foreground">{emptyIcon}</div>
                      ) : null}
                      <div className="text-sm font-medium text-foreground">
                        {emptyMessage}
                      </div>
                      {emptyDescription ? (
                        <div className="max-w-sm text-xs text-muted-foreground">
                          {emptyDescription}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </DndContext>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          {loading
            ? "Loading…"
            : totalRows === 0
              ? "0 rows"
              : showPagination
                ? `Showing ${pageIndex * paginationState.pageSize + 1}–${Math.min(
                    (pageIndex + 1) * paginationState.pageSize,
                    totalRows,
                  )} of ${totalRows}`
                : `${totalRows} ${totalRows === 1 ? "row" : "rows"}`}
        </div>
        {showPagination ? (
          <div className="flex items-center gap-1">
            <PageButton
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              ariaLabel="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </PageButton>
            <PageButton
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              ariaLabel="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </PageButton>
            <span className="px-2 tabular-nums">
              {pageIndex + 1} / {pageCount}
            </span>
            <PageButton
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              ariaLabel="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </PageButton>
            <PageButton
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              ariaLabel="Last page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </PageButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── body row ────────────────────────────────────────────────────

function DataRow<TData>({
  row,
  index,
  cellPadY,
  contextMenu,
}: {
  row: import("@tanstack/react-table").Row<TData>;
  index: number;
  cellPadY: string;
  contextMenu?: (row: TData) => React.ReactNode;
}) {
  const isGroupRow = row.getIsGrouped();
  const rowEl = (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      className={cn(
        "border-border transition-colors",
        isGroupRow
          ? "bg-accent/30 font-medium hover:bg-accent/40"
          : cn(index % 2 === 1 && "bg-muted/30", "hover:bg-muted/60"),
        "data-[state=selected]:bg-primary/8 data-[state=selected]:hover:bg-primary/12",
      )}
    >
      {row.getVisibleCells().map((cell) => {
        const column = cell.column;
        const isGroupedCell = cell.getIsGrouped();
        const isAggregatedCell = cell.getIsAggregated();
        const isPlaceholderCell = cell.getIsPlaceholder();
        return (
          <TableCell
            key={cell.id}
            className={cn(
              "text-sm",
              cellPadY,
              column.getIsPinned() && "bg-card group-hover:bg-muted/60",
              isGroupRow && isGroupedCell && "font-semibold",
            )}
            style={{
              width: column.getSize(),
              ...getPinStyle(column),
            }}
          >
            {isGroupedCell ? (
              <button
                type="button"
                onClick={row.getToggleExpandedHandler()}
                className="inline-flex items-center gap-1 hover:text-foreground"
                aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
              >
                {row.getIsExpanded() ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>
                  {flexRender(column.columnDef.cell, cell.getContext())}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  ({row.subRows.length})
                </span>
              </button>
            ) : isAggregatedCell ? (
              flexRender(
                column.columnDef.aggregatedCell ?? column.columnDef.cell,
                cell.getContext(),
              )
            ) : isPlaceholderCell ? null : (
              flexRender(column.columnDef.cell, cell.getContext())
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );

  // Wrap the row in a Radix ContextMenu when a slot is provided. We
  // skip wrapping for the synthetic group-by rows since their menu
  // items wouldn't make sense there.
  if (contextMenu && !isGroupRow) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{rowEl}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {contextMenu(row.original as TData)}
        </ContextMenuContent>
      </ContextMenu>
    );
  }
  return rowEl;
}

// ─── header cell (sort, resize handle, header menu for pin/hide) ───────

function HeaderCell<TData, TValue>({
  header,
  density: _density,
  enableColumnResizing,
  enableColumnPinning,
  enableColumnReorder,
  headerPadY,
}: {
  header: Header<TData, TValue>;
  density: Density;
  enableColumnResizing: boolean;
  enableColumnPinning: boolean;
  enableColumnReorder: boolean;
  headerPadY: string;
}) {
  const column = header.column;
  const sortable = !header.isPlaceholder && column.getCanSort();
  const sortDir = column.getIsSorted();
  const isSelectCol = column.id === "__select";
  const canResize = enableColumnResizing && column.getCanResize();
  const canPin = enableColumnPinning && column.getCanPin() && !isSelectCol;
  const canHide = column.getCanHide();
  const canReorder =
    enableColumnReorder && !isSelectCol && !column.getIsPinned();

  // dnd-kit sortable wires up transform / listeners; disabled flag
  // ensures pinned + selection columns ignore drag interactions.
  const sortable_dnd = useSortable({ id: column.id, disabled: !canReorder });
  const dragStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(sortable_dnd.transform),
    transition: sortable_dnd.transition,
    opacity: sortable_dnd.isDragging ? 0.6 : undefined,
    zIndex: sortable_dnd.isDragging ? 30 : undefined,
  };

  const canGroup = column.getCanGroup() && !isSelectCol;
  const hasContextActions = sortable || canPin || canHide || canGroup;

  const headBody = (
    <TableHead
      ref={sortable_dnd.setNodeRef}
      style={{
        width: header.getSize(),
        minWidth: column.columnDef.minSize ?? 60,
        ...getPinStyle(column, true),
        ...dragStyle,
      }}
      className={cn(
        "group relative bg-muted/60 supports-[backdrop-filter]:bg-muted/50",
        headerPadY,
        "text-xs font-medium uppercase tracking-wide text-muted-foreground",
        isSelectCol && "w-10",
        sortable_dnd.isDragging && "shadow-md",
      )}
    >
      <div className="flex items-center gap-1">
        {canReorder ? (
          <button
            type="button"
            aria-label="Drag to reorder column"
            className="-ml-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            {...sortable_dnd.attributes}
            {...sortable_dnd.listeners}
          >
            <GripVertical className="h-3 w-3" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={
            sortable ? column.getToggleSortingHandler() : undefined
          }
          className={cn(
            "inline-flex flex-1 items-center gap-1 truncate text-left",
            sortable && "cursor-pointer select-none hover:text-foreground",
          )}
        >
          <span className="truncate">
            {header.isPlaceholder
              ? null
              : flexRender(column.columnDef.header, header.getContext())}
          </span>
          {sortable ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3 text-primary" />
            ) : sortDir === "desc" ? (
              <ArrowDown className="h-3 w-3 text-primary" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-30" />
            )
          ) : null}
        </button>
        {(canPin || canHide) && !isSelectCol ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Column options"
                className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canPin ? (
                <>
                  <DropdownMenuItem
                    onClick={() => column.pin("left")}
                    disabled={column.getIsPinned() === "left"}
                    className="gap-2 text-xs"
                  >
                    <Pin className="h-3.5 w-3.5" />
                    Pin left
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => column.pin("right")}
                    disabled={column.getIsPinned() === "right"}
                    className="gap-2 text-xs"
                  >
                    <Pin className="h-3.5 w-3.5 -scale-x-100" />
                    Pin right
                  </DropdownMenuItem>
                  {column.getIsPinned() ? (
                    <DropdownMenuItem
                      onClick={() => column.pin(false)}
                      className="gap-2 text-xs"
                    >
                      <PinOff className="h-3.5 w-3.5" />
                      Unpin
                    </DropdownMenuItem>
                  ) : null}
                  {canHide ? <DropdownMenuSeparator /> : null}
                </>
              ) : null}
              {canHide ? (
                <DropdownMenuItem
                  onClick={() => column.toggleVisibility(false)}
                  className="gap-2 text-xs"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide column
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {canResize ? (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none",
            "bg-transparent hover:bg-primary/40",
            column.getIsResizing() && "bg-primary",
          )}
        />
      ) : null}
    </TableHead>
  );

  if (!hasContextActions) return headBody;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{headBody}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {sortable ? (
          <>
            <ContextMenuItem
              onClick={() => column.toggleSorting(false)}
              className="gap-2 text-xs"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Sort ascending
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => column.toggleSorting(true)}
              className="gap-2 text-xs"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Sort descending
            </ContextMenuItem>
            {sortDir ? (
              <ContextMenuItem
                onClick={() => column.clearSorting()}
                className="gap-2 text-xs"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Clear sort
              </ContextMenuItem>
            ) : null}
            {(canGroup || canPin || canHide) ? <ContextMenuSeparator /> : null}
          </>
        ) : null}
        {canGroup ? (
          <>
            <ContextMenuItem
              onClick={() => column.toggleGrouping()}
              className="gap-2 text-xs"
            >
              <Group className="h-3.5 w-3.5" />
              {column.getIsGrouped() ? "Ungroup" : "以此欄位群組"}
            </ContextMenuItem>
            {(canPin || canHide) ? <ContextMenuSeparator /> : null}
          </>
        ) : null}
        {canPin ? (
          <>
            <ContextMenuItem
              onClick={() => column.pin("left")}
              disabled={column.getIsPinned() === "left"}
              className="gap-2 text-xs"
            >
              <Pin className="h-3.5 w-3.5" />
              Pin left
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => column.pin("right")}
              disabled={column.getIsPinned() === "right"}
              className="gap-2 text-xs"
            >
              <Pin className="h-3.5 w-3.5 -scale-x-100" />
              Pin right
            </ContextMenuItem>
            {column.getIsPinned() ? (
              <ContextMenuItem
                onClick={() => column.pin(false)}
                className="gap-2 text-xs"
              >
                <PinOff className="h-3.5 w-3.5" />
                Unpin
              </ContextMenuItem>
            ) : null}
            {canHide ? <ContextMenuSeparator /> : null}
          </>
        ) : null}
        {canHide ? (
          <ContextMenuItem
            onClick={() => column.toggleVisibility(false)}
            className="gap-2 text-xs"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide column
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── pinning helpers ─────────────────────────────────────────────

/** Returns sticky positioning for a pinned column. Pass `isHeader=true`
 *  to bump z-index so headers stay above body cells. */
function getPinStyle<TData, TValue>(
  column: Column<TData, TValue>,
  isHeader = false,
): React.CSSProperties {
  const pinned = column.getIsPinned();
  if (!pinned) return {};
  const isLastLeft = pinned === "left" && column.getIsLastColumn("left");
  const isFirstRight = pinned === "right" && column.getIsFirstColumn("right");
  const left =
    pinned === "left" ? `${column.getStart("left")}px` : undefined;
  const right =
    pinned === "right" ? `${column.getAfter("right")}px` : undefined;
  return {
    position: "sticky",
    left,
    right,
    zIndex: isHeader ? 21 : 1,
    backgroundColor: "var(--card)",
    boxShadow: isLastLeft
      ? "4px 0 6px -4px rgba(0,0,0,0.08)"
      : isFirstRight
        ? "-4px 0 6px -4px rgba(0,0,0,0.08)"
        : undefined,
  };
}

function getPinnedWidth<TData>(table: TanstackTable<TData>): number {
  return (
    table.getLeftHeaderGroups()[0]?.headers.reduce(
      (sum, h) => sum + h.getSize(),
      0,
    ) ?? 0
  ) +
    (
      table.getRightHeaderGroups()[0]?.headers.reduce(
        (sum, h) => sum + h.getSize(),
        0,
      ) ?? 0
    );
}

// ─── small helpers ───────────────────────────────────────────────

function PageButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

function DensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (d: Density) => void;
}) {
  const next = density === "compact" ? "comfortable" : "compact";
  const Icon = density === "compact" ? Rows2 : Rows4;
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 w-8 p-0"
      onClick={() => onChange(next)}
      aria-label={`Switch to ${next} density`}
      title={`Density: ${density}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

// ─── filter bar ──────────────────────────────────────────────────

function FilterBar<TData>({
  table,
  searchColumnId,
}: {
  table: TanstackTable<TData>;
  searchColumnId?: string;
}) {
  const filterable = table
    .getAllLeafColumns()
    .filter((c) => c.columnDef.meta?.filterType && c.id !== searchColumnId);
  const activeFilters = table
    .getState()
    .columnFilters.filter((f) => f.id !== searchColumnId);
  const groupableColumns = table
    .getAllLeafColumns()
    .filter((c) => c.getCanGroup());
  const grouping = table.getState().grouping;

  if (
    filterable.length === 0 &&
    activeFilters.length === 0 &&
    groupableColumns.length === 0 &&
    grouping.length === 0
  )
    return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {grouping.map((groupId) => {
        const col = table.getColumn(groupId);
        if (!col) return null;
        return (
          <span
            key={`group-${groupId}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs"
          >
            <Group className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Grouped by</span>
            <span className="font-medium text-foreground">
              {col.columnDef.meta?.filterLabel ?? labelOfColumn(col)}
            </span>
            <button
              type="button"
              onClick={() => col.toggleGrouping()}
              className="px-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear grouping"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      {activeFilters.map((f) => {
        const col = table.getColumn(f.id);
        if (!col) return null;
        return (
          <FilterPill
            key={f.id}
            column={col}
            value={f.value as FilterValue}
            onRemove={() => col.setFilterValue(undefined)}
            onEdit={(next) => col.setFilterValue(next)}
          />
        );
      })}
      {groupableColumns.length > 0 && grouping.length === 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-dashed text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
              <Group className="h-3 w-3" />
              <span>Group by</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs">
              Group rows by
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {groupableColumns.map((col) => (
              <DropdownMenuItem
                key={col.id}
                onClick={() => col.toggleGrouping()}
                className="text-xs capitalize"
              >
                {col.columnDef.meta?.filterLabel ?? labelOfColumn(col)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {filterable.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-dashed text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
              <Filter className="h-3 w-3" />
              <span>Filter</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs">
              Add filter
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {filterable.map((col) => (
              <AddFilterItem key={col.id} column={col} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {activeFilters.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-muted-foreground"
          onClick={() =>
            activeFilters.forEach((f) => table.getColumn(f.id)?.setFilterValue(undefined))
          }
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

function AddFilterItem<TData>({
  column,
}: {
  column: Column<TData, unknown>;
}) {
  const filterType = column.columnDef.meta?.filterType!;
  const label = column.columnDef.meta?.filterLabel ?? labelOfColumn(column);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="text-xs capitalize"
        >
          {label}
        </DropdownMenuItem>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 p-3">
        <FilterPopoverForm
          column={column}
          initial={{ op: FILTER_OPS_BY_TYPE[filterType][0], value: "" }}
          onApply={(v) => column.setFilterValue(v)}
        />
      </PopoverContent>
    </Popover>
  );
}

function FilterPill<TData>({
  column,
  value,
  onRemove,
  onEdit,
}: {
  column: Column<TData, unknown>;
  value: FilterValue;
  onRemove: () => void;
  onEdit: (next: FilterValue) => void;
}) {
  const label = column.columnDef.meta?.filterLabel ?? labelOfColumn(column);
  const valueDisplay = formatFilterValue(value, column);
  return (
    <Popover>
      <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card text-xs">
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 hover:bg-muted/60"
          >
            <span className="font-medium text-foreground">{label}</span>
            <span className="text-muted-foreground">
              {OP_LABELS[value.op]}
            </span>
            <span className="font-medium text-foreground">{valueDisplay}</span>
          </button>
        </PopoverTrigger>
        <button
          type="button"
          aria-label="Remove filter"
          onClick={onRemove}
          className="px-1.5 py-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <PopoverContent align="start" className="w-72 space-y-2 p-3">
        <FilterPopoverForm
          column={column}
          initial={value}
          onApply={(v) => onEdit(v)}
        />
      </PopoverContent>
    </Popover>
  );
}

function FilterPopoverForm<TData>({
  column,
  initial,
  onApply,
}: {
  column: Column<TData, unknown>;
  initial: FilterValue;
  onApply: (v: FilterValue) => void;
}) {
  const filterType = column.columnDef.meta?.filterType!;
  const options = column.columnDef.meta?.filterOptions ?? [];
  const ops = FILTER_OPS_BY_TYPE[filterType];
  const [op, setOp] = React.useState<FilterOp>(initial.op ?? ops[0]);
  const [value, setValue] = React.useState<unknown>(initial.value ?? "");

  const apply = () => {
    if (
      value === "" ||
      value == null ||
      (Array.isArray(value) && value.every((v) => v === "" || v == null))
    )
      return;
    onApply({ op, value });
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">
        {column.columnDef.meta?.filterLabel ?? labelOfColumn(column)}
      </div>
      <Select value={op} onValueChange={(v) => setOp(v as FilterOp)}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">
              {OP_LABELS[o]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filterType === "select" ? (
        <Select
          value={String(value ?? "")}
          onValueChange={(v) => setValue(coerceOptionValue(v, options))}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={String(o.value)} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : filterType === "boolean" ? (
        <Select
          value={String(value ?? "true")}
          onValueChange={(v) => setValue(v === "true")}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      ) : op === "between" && filterType === "number" ? (
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={Array.isArray(value) ? String(value[0] ?? "") : ""}
            onChange={(e) =>
              setValue([
                e.target.value,
                Array.isArray(value) ? value[1] : "",
              ])
            }
            className="h-8"
          />
          <Input
            type="number"
            placeholder="Max"
            value={Array.isArray(value) ? String(value[1] ?? "") : ""}
            onChange={(e) =>
              setValue([
                Array.isArray(value) ? value[0] : "",
                e.target.value,
              ])
            }
            className="h-8"
          />
        </div>
      ) : filterType === "date" ? (
        <Input
          type="date"
          value={String(value ?? "")}
          onChange={(e) => setValue(e.target.value)}
          className="h-8"
        />
      ) : (
        <Input
          type={filterType === "number" ? "number" : "text"}
          placeholder="Value"
          value={String(value ?? "")}
          onChange={(e) => setValue(e.target.value)}
          className="h-8"
        />
      )}

      <div className="flex justify-end gap-1.5 pt-1">
        <Button size="sm" className="h-7" onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

function labelOfColumn<TData>(column: Column<TData, unknown>): string {
  const h = column.columnDef.header;
  if (typeof h === "string") return h;
  return column.id;
}

function formatFilterValue<TData>(
  fv: FilterValue,
  column: Column<TData, unknown>,
): string {
  if (Array.isArray(fv.value))
    return fv.value.map((v) => String(v ?? "")).join("–");
  const opts = column.columnDef.meta?.filterOptions;
  if (opts) {
    const m = opts.find((o) => String(o.value) === String(fv.value));
    if (m) return m.label;
  }
  return String(fv.value ?? "");
}

function coerceOptionValue(
  v: string,
  options: Array<{ label: string; value: string | number | boolean }>,
): string | number | boolean {
  const m = options.find((o) => String(o.value) === v);
  return m ? m.value : v;
}

function ColumnsMenu<TData>({ table }: { table: TanstackTable<TData> }) {
  const hideable = table.getAllColumns().filter((c) => c.getCanHide());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs">
          Toggle columns
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
            className="text-xs capitalize"
          >
            {column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
