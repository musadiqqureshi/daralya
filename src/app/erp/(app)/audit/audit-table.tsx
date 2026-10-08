"use client";
import { useState } from "react";
import { DataTable, type Col } from "@/components/erp/data-table";
import { DateText } from "@/components/erp/money";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/client";

export type AuditRow = { id: number; at: string; user: string; action: string; table_name: string; record_id: string | null; reason: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null };

const SKIP = new Set(["updated_at", "created_at"]);

function diff(a: Record<string, unknown> | null, b: Record<string, unknown> | null) {
  const keys = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].filter((k) => !SKIP.has(k));
  return keys
    .map((k) => ({ key: k, before: a?.[k], after: b?.[k] }))
    .filter((d) => !a || !b || JSON.stringify(d.before) !== JSON.stringify(d.after));
}
const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp.audit;
  const [open, setOpen] = useState<AuditRow | null>(null);
  const cols: Col<AuditRow>[] = [
    { id: "at", header: dict.common.date, value: (r) => r.at, cell: (r) => <DateText value={r.at} withTime /> },
    { id: "user", header: dict.erp.fields.user, value: (r) => r.user, cell: (r) => r.user },
    { id: "action", header: t.action, value: (r) => r.action, cell: (r) => <span className={r.action === "delete" ? "text-destructive" : r.action === "insert" ? "text-success" : ""}>{t.actions[r.action as "insert"] ?? r.action}</span> },
    { id: "table", header: t.table, value: (r) => r.table_name, cell: (r) => <span className="font-mono text-xs">{r.table_name}</span> },
    { id: "record", header: t.record, value: (r) => `${r.record_id ?? ""} ${JSON.stringify(r.new_data ?? r.old_data ?? {})}`, cell: (r) => <span className="font-mono text-[0.7rem] text-muted-foreground">{String((r.new_data ?? r.old_data)?.["invoice_no"] ?? (r.new_data ?? r.old_data)?.["purchase_no"] ?? (r.new_data ?? r.old_data)?.["payment_no"] ?? r.record_id?.slice(0, 8) ?? "")}</span>, hideBelow: "md" },
    { id: "reason", header: dict.common.reason, value: (r) => r.reason ?? "", cell: (r) => <span className="text-xs">{r.reason ?? ""}</span>, hideBelow: "lg" },
    { id: "view", header: "", cell: (r) => <button type="button" className="text-xs font-semibold text-palm-700 hover:underline" onClick={() => setOpen(r)}>{t.changes}</button>, align: "end" },
  ];
  return (
    <>
      <DataTable rows={rows} columns={cols} initialSort={{ id: "at", desc: true }} pageSize={50} emptyTitle={t.empty} dense />
      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{open?.table_name} · {open && (t.actions[open.action as "insert"] ?? open.action)}</DialogTitle>
          </DialogHeader>
          {open?.reason && <p className="rounded-lg bg-gold-100 px-3 py-2 text-sm">{dict.common.reason}: {open.reason}</p>}
          <table className="w-full text-xs">
            <thead className="border-b text-muted-foreground"><tr><th className="py-1.5 text-start">Field</th><th className="py-1.5 text-start">{t.before}</th><th className="py-1.5 text-start">{t.after}</th></tr></thead>
            <tbody className="divide-y">
              {open && diff(open.old_data, open.new_data).map((d) => (
                <tr key={d.key} className="align-top">
                  <td className="py-1.5 pe-3 font-mono font-semibold">{d.key}</td>
                  <td className="py-1.5 pe-3 break-all text-destructive/80">{open.old_data ? show(d.before) : ""}</td>
                  <td className="py-1.5 break-all text-success">{open.new_data ? show(d.after) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </>
  );
}
