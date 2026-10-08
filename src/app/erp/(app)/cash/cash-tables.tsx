"use client";
import { DataTable, type Col } from "@/components/erp/data-table";
import { DateText, Money } from "@/components/erp/money";
import { useI18n } from "@/lib/i18n/client";

type Tr = { id: string; no: string; date: string; amount: number; reference: string | null; from: string; to: string };
type Cl = { id: string; date: string; account: string; expected: number; counted: number; difference: number; notes: string | null };

export function TransfersTable({ rows }: { rows: Tr[] }) {
  const { dict } = useI18n();
  const cols: Col<Tr>[] = [
    { id: "no", header: dict.erp.fields.documentNo, value: (r) => r.no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.no}</span> },
    { id: "date", header: dict.common.date, value: (r) => r.date, cell: (r) => <DateText value={r.date} /> },
    { id: "route", header: `${dict.common.from} → ${dict.common.to}`, value: (r) => `${r.from} ${r.to}`, cell: (r) => `${r.from} → ${r.to}` },
    { id: "ref", header: dict.common.reference, value: (r) => r.reference ?? "", cell: (r) => r.reference ?? "—", hideBelow: "md" },
    { id: "amount", header: dict.common.amount, value: (r) => r.amount, cell: (r) => <Money value={r.amount} className="font-semibold" />, align: "end" },
  ];
  return <DataTable rows={rows} columns={cols} initialSort={{ id: "date", desc: true }} />;
}

export function ClosingsTable({ rows }: { rows: Cl[] }) {
  const { dict } = useI18n();
  const t = dict.erp.cash;
  const cols: Col<Cl>[] = [
    { id: "date", header: dict.common.date, value: (r) => r.date, cell: (r) => <DateText value={r.date} /> },
    { id: "account", header: dict.erp.fields.account, value: (r) => r.account, cell: (r) => r.account },
    { id: "expected", header: t.expected, value: (r) => r.expected, cell: (r) => <Money value={r.expected} />, align: "end" },
    { id: "counted", header: t.counted, value: (r) => r.counted, cell: (r) => <Money value={r.counted} />, align: "end" },
    { id: "diff", header: t.difference, value: (r) => r.difference, cell: (r) => <Money value={r.difference} signed className={r.difference ? "font-semibold" : "text-muted-foreground"} />, align: "end" },
    { id: "notes", header: dict.common.notes, value: (r) => r.notes ?? "", cell: (r) => r.notes ?? "—", hideBelow: "md" },
  ];
  return <DataTable rows={rows} columns={cols} initialSort={{ id: "date", desc: true }} />;
}
