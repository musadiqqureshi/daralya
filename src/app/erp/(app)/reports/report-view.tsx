"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, Printer } from "lucide-react";
import { DateText, Money, Num } from "@/components/erp/money";
import { StatusBadge } from "@/components/erp/status-badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Col = { key: string; header: string; kind?: "money" | "number" | "text" | "date" | "status"; align?: "start" | "end" };

export function ReportView({ report, exportHref }: { report: { title: string; columns: Col[]; rows: Record<string, unknown>[]; totals?: Record<string, number>; note?: string }; exportHref: string }) {
  const { dict } = useI18n();
  const cell = (c: Col, v: unknown) =>
    v === null || v === undefined || v === "" ? "" : c.kind === "money" ? <Money value={v as number} currency={false} signed /> : c.kind === "number" ? <Num value={v as number} digits={2} /> : c.kind === "date" ? <DateText value={String(v)} /> : c.kind === "status" ? <StatusBadge status={String(v)} /> : String(v);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold text-palm-900">{report.title}</h2>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer />{dict.common.print}</Button>
          <Button asChild variant="outline" size="sm"><a href={exportHref}><FileSpreadsheet />{dict.common.exportExcel}</a></Button>
        </div>
      </div>
      {report.note && <p className={cn("rounded-lg px-3 py-2 text-sm font-medium", report.note === dict.erp.reports.unbalanced ? "bg-destructive/10 text-destructive" : "bg-palm-50 text-palm-700")}>{report.note}</p>}
      <div className="overflow-hidden rounded-xl border bg-card print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground print:bg-transparent">
              <tr>
                {report.columns.map((c) => (
                  <th key={c.key} className={cn("px-4 py-2.5 font-semibold whitespace-nowrap", c.align === "end" ? "text-end" : "text-start")}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.rows.length === 0 ? (
                <tr><td colSpan={report.columns.length} className="px-4 py-12 text-center text-muted-foreground">{dict.erp.dashboard.noData}</td></tr>
              ) : (
                report.rows.map((r, i) => (
                  <tr key={i} className={cn(Boolean(r.strong) && "bg-muted/40 font-semibold")}>
                    {report.columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-2", c.align === "end" ? "text-end" : "text-start")}>{cell(c, r[c.key])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {report.totals && report.rows.length > 0 && (
              <tfoot className="border-t-2 border-palm-800/30 bg-muted/30 font-semibold">
                <tr>
                  {report.columns.map((c, i) => (
                    <td key={c.key} className={cn("px-4 py-2.5", c.align === "end" ? "text-end" : "text-start")}>
                      {i === 0 ? dict.common.total : c.key in report.totals! ? cell(c, report.totals![c.key]) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export function GroupPicker({ options, value }: { options: { value: string; label: string }[]; value: string }) {
  const { dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <div className="inline-flex items-center gap-2 print:hidden">
      <span className="text-xs text-muted-foreground">{dict.erp.reports.groupBy}</span>
      <div className="inline-flex rounded-lg border bg-card p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(sp.toString());
              next.set("group", o.value);
              router.replace(`${pathname}?${next}`, { scroll: false });
            }}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium", value === o.value ? "bg-palm-800 text-cream" : "text-muted-foreground hover:text-foreground")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
