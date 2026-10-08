"use client";
import { DataTable, type Col } from "@/components/erp/data-table";
import { Money } from "@/components/erp/money";
import { useI18n } from "@/lib/i18n/client";

export type InvestorRow = { id: string; investor_no: string; name: string; phone: string | null; investments: number; capital: number; earned: number; owed: number };

export function InvestorsTable({ rows }: { rows: InvestorRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp.investors;
  const cols: Col<InvestorRow>[] = [
    { id: "no", header: dict.common.code, value: (r) => r.investor_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.investor_no}</span> },
    { id: "name", header: dict.common.name, value: (r) => r.name, cell: (r) => <span className="font-semibold text-palm-900">{r.name}</span> },
    { id: "inv", header: dict.erp.fields.investment, value: (r) => r.investments, cell: (r) => r.investments, align: "end", hideBelow: "sm" },
    { id: "capital", header: t.capitalBalance, value: (r) => r.capital, cell: (r) => <Money value={r.capital} />, align: "end" },
    { id: "earned", header: t.profitEarned, value: (r) => r.earned, cell: (r) => <Money value={r.earned} className="text-muted-foreground" />, align: "end", hideBelow: "md" },
    { id: "owed", header: t.profitOutstanding, value: (r) => r.owed, cell: (r) => <Money value={r.owed} className={r.owed > 0 ? "font-semibold" : "text-muted-foreground"} />, align: "end" },
  ];
  return <DataTable rows={rows} columns={cols} rowHref={(r) => `/erp/investors/${r.id}`} emptyTitle={t.empty} />;
}
