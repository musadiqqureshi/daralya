"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { DateText, Money } from "./money";

export type StatementRow = {
  entry_date: string;
  entry_no: string | null;
  source_type: string;
  source_id: string | null;
  memo: string | null;
  debit: number | null;
  credit: number | null;
  balance: number;
  is_opening: boolean;
};

const sourceHref: Record<string, string> = { sale: "/erp/sales/", purchase: "/erp/purchases/" };

export function StatementTable({ rows }: { rows: StatementRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const closing = rows.length ? rows[rows.length - 1].balance : 0;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-start font-semibold">{dict.common.date}</th>
              <th className="px-4 py-2.5 text-start font-semibold">{dict.common.description}</th>
              <th className="px-4 py-2.5 text-end font-semibold">{t.reports.debit}</th>
              <th className="px-4 py-2.5 text-end font-semibold">{t.reports.credit}</th>
              <th className="px-4 py-2.5 text-end font-semibold">{dict.common.balance}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i} className={r.is_opening ? "bg-muted/30" : undefined}>
                <td className="px-4 py-2.5 whitespace-nowrap"><DateText value={r.entry_date} /></td>
                <td className="px-4 py-2.5">
                  {r.is_opening ? (
                    <span className="font-medium">{dict.erp.print.openingBalance}</span>
                  ) : r.source_id && sourceHref[r.source_type] ? (
                    <Link href={sourceHref[r.source_type] + r.source_id} className="hover:underline">{r.memo}</Link>
                  ) : (
                    r.memo
                  )}
                </td>
                <td className="px-4 py-2.5 text-end">{r.debit ? <Money value={r.debit} currency={false} /> : ""}</td>
                <td className="px-4 py-2.5 text-end">{r.credit ? <Money value={r.credit} currency={false} /> : ""}</td>
                <td className="px-4 py-2.5 text-end font-semibold"><Money value={r.balance} currency={false} signed /></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-end font-semibold">{dict.erp.print.closingBalance}</td>
              <td className="px-4 py-3 text-end font-bold"><Money value={closing} signed /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
