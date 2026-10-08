"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export type Col<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** value used for sorting and search; omit to make the column unsortable */
  value?: (row: T) => string | number | null | undefined;
  align?: "start" | "end" | "center";
  className?: string;
  hideBelow?: "sm" | "md" | "lg";
};

export function DataTable<T>({
  rows,
  columns,
  rowHref,
  search = true,
  searchPlaceholder,
  toolbar,
  emptyTitle,
  emptyBody,
  emptyAction,
  pageSize = 25,
  footer,
  initialSort,
  dense = false,
  className,
}: {
  rows: T[];
  columns: Col<T>[];
  rowHref?: (row: T) => string | null;
  search?: boolean;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  pageSize?: number;
  footer?: React.ReactNode;
  initialSort?: { id: string; desc?: boolean };
  dense?: boolean;
  className?: string;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>(initialSort ? [{ id: initialSort.id, desc: !!initialSort.desc }] : []);
  const [filter, setFilter] = useState("");

  const defs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        accessorFn: (r: T) => (c.value ? c.value(r) ?? "" : ""),
        header: () => c.header,
        cell: (ctx) => c.cell(ctx.row.original),
        enableSorting: Boolean(c.value),
        enableGlobalFilter: Boolean(c.value),
        meta: c,
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    globalFilterFn: (row, _id, value: string) => {
      const needle = value.toLowerCase().trim();
      if (!needle) return true;
      return row.getAllCells().some((cell) => String(cell.getValue() ?? "").toLowerCase().includes(needle));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const hideCls = (h?: Col<T>["hideBelow"]) => (h === "sm" ? "hidden sm:table-cell" : h === "md" ? "hidden md:table-cell" : h === "lg" ? "hidden lg:table-cell" : "");
  const alignCls = (a?: Col<T>["align"]) => (a === "end" ? "text-end" : a === "center" ? "text-center" : "text-start");
  const pageRows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className={cn("space-y-3", className)}>
      {(search || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
          {search && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  table.setPageIndex(0);
                }}
                placeholder={searchPlaceholder ?? dict.common.searchPlaceholder}
                className="h-9 bg-card ps-9"
                aria-label={dict.common.search}
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle ?? dict.common.empty} body={emptyBody} action={emptyAction} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b bg-muted/50">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => {
                      const meta = h.column.columnDef.meta as Col<T>;
                      const sorted = h.column.getIsSorted();
                      return (
                        <th
                          key={h.id}
                          scope="col"
                          aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                          className={cn("px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-muted-foreground", alignCls(meta.align), hideCls(meta.hideBelow), meta.className)}
                        >
                          {h.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={h.column.getToggleSortingHandler()}
                              className={cn("inline-flex items-center gap-1 hover:text-foreground", meta.align === "end" && "flex-row-reverse")}
                            >
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : null}
                            </button>
                          ) : (
                            flexRender(h.column.columnDef.header, h.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                      {dict.common.noResults}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const href = rowHref?.(r.original) ?? null;
                    return (
                      <tr
                        key={r.id}
                        onClick={href ? (e) => {
                          if ((e.target as HTMLElement).closest("a,button,input,select,label")) return;
                          router.push(href);
                        } : undefined}
                        className={cn("transition-colors", href && "cursor-pointer hover:bg-muted/40")}
                      >
                        {r.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta as Col<T>;
                          return (
                            <td key={cell.id} className={cn("px-4 align-middle", dense ? "py-2" : "py-3", alignCls(meta.align), hideCls(meta.hideBelow), meta.className)}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {footer && <tfoot className="border-t bg-muted/30 font-semibold">{footer}</tfoot>}
            </table>
          </div>
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground print:hidden">
              <span>
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredCount)} {dict.common.of} {filteredCount}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label={dict.common.previous}>
                  <ChevronLeft className="rtl:rotate-180" />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label={dict.common.next}>
                  <ChevronRight className="rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
