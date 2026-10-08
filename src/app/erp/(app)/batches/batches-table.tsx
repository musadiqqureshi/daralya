"use client";
import { DataTable, type Col } from "@/components/erp/data-table";
import { DateText, Num } from "@/components/erp/money";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type BatchRow = { id: string; batch_no: string; source: string; received_date: string; expiry_date: string | null; product: string; unit: string; supplier: string | null; initial: number; remaining: number };

export function BatchesTable({ rows }: { rows: BatchRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const today = new Date().toISOString().slice(0, 10);
  const cols: Col<BatchRow>[] = [
    { id: "no", header: t.fields.batch, value: (r) => r.batch_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.batch_no}</span> },
    { id: "product", header: t.fields.product, value: (r) => r.product, cell: (r) => <span className="font-medium">{r.product}</span> },
    { id: "supplier", header: t.batches.source, value: (r) => r.supplier ?? r.source, cell: (r) => r.supplier ?? t.movement[r.source === "opening" ? "opening" : "adjustment_in"], hideBelow: "md" },
    { id: "received", header: t.fields.received, value: (r) => r.received_date, cell: (r) => <DateText value={r.received_date} />, hideBelow: "sm" },
    { id: "expiry", header: t.fields.expiry, value: (r) => r.expiry_date ?? "", cell: (r) => (r.expiry_date ? <span className={cn(r.expiry_date < today && r.remaining > 0 && "font-semibold text-destructive")}><DateText value={r.expiry_date} /></span> : "—"), hideBelow: "lg" },
    { id: "initial", header: t.batches.initial, value: (r) => r.initial, cell: (r) => <Num value={r.initial} />, align: "end", hideBelow: "sm" },
    { id: "remaining", header: t.batches.remaining, value: (r) => r.remaining, cell: (r) => <span className={cn("font-semibold", r.remaining <= 0 && "text-muted-foreground")}><Num value={r.remaining} /> <span className="text-xs font-normal text-muted-foreground">{t.units[r.unit as keyof typeof t.units]}</span></span>, align: "end" },
  ];
  return <DataTable rows={rows} columns={cols} rowHref={(r) => `/erp/batches/${r.id}`} emptyTitle={t.batches.empty} initialSort={{ id: "received", desc: true }} />;
}
