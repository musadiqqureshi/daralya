"use client";
import { DataTable, type Col } from "@/components/erp/data-table";
import { DateText } from "@/components/erp/money";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Tr = { id: string; no: string; date: string; from: string; to: string; items: string; notes: string | null };
type Tp = { id: string; at: string; storage: string; temp: number; humidity: number | null; notes: string | null; out: boolean };

export function StorageTables(props: { kind: "transfers"; rows: Tr[] } | { kind: "temps"; rows: Tp[] }) {
  const { dict } = useI18n();
  const t = dict.erp;
  if (props.kind === "transfers") {
    const cols: Col<Tr>[] = [
      { id: "no", header: t.fields.documentNo, value: (r) => r.no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.no}</span> },
      { id: "date", header: dict.common.date, value: (r) => r.date, cell: (r) => <DateText value={r.date} /> },
      { id: "route", header: `${t.fields.fromStorage} → ${t.fields.toStorage}`, value: (r) => `${r.from} ${r.to}`, cell: (r) => <span>{r.from} <span className="text-muted-foreground rtl:rotate-180">→</span> {r.to}</span> },
      { id: "items", header: t.fields.products, value: (r) => r.items, cell: (r) => <span className="text-xs">{r.items}</span> },
      { id: "notes", header: dict.common.notes, value: (r) => r.notes ?? "", cell: (r) => r.notes ?? "—", hideBelow: "lg" },
    ];
    return <DataTable rows={props.rows} columns={cols} initialSort={{ id: "date", desc: true }} />;
  }
  const cols: Col<Tp>[] = [
    { id: "at", header: dict.common.date, value: (r) => r.at, cell: (r) => <DateText value={r.at} withTime /> },
    { id: "storage", header: t.fields.storage, value: (r) => r.storage, cell: (r) => r.storage },
    { id: "temp", header: t.fields.temperature, value: (r) => r.temp, cell: (r) => <span className={cn("font-semibold tabular-nums", r.out ? "text-destructive" : "text-palm-700")}>{r.temp} °C{r.out ? ` · ${t.storage.outOfRange}` : ""}</span>, align: "end" },
    { id: "hum", header: t.fields.humidity, value: (r) => r.humidity ?? 0, cell: (r) => (r.humidity === null ? "—" : `${r.humidity}%`), align: "end", hideBelow: "sm" },
    { id: "notes", header: dict.common.notes, value: (r) => r.notes ?? "", cell: (r) => r.notes ?? "—", hideBelow: "md" },
  ];
  return <DataTable rows={props.rows} columns={cols} initialSort={{ id: "at", desc: true }} />;
}
