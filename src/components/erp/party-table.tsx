"use client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { DataTable, type Col } from "./data-table";
import type { Option } from "./entity-select";
import { Money } from "./money";
import { PartyForm } from "./party-form";
import { StatusBadge } from "./status-badge";

export type PartyListRow = {
  id: string;
  code: string;
  name: string;
  name_ar: string | null;
  phone: string | null;
  city: string | null;
  balance: number;
  is_active: boolean;
  docs: number;
};

export function PartyTable({ kind, rows, canManage, drivers }: { kind: "customer" | "supplier"; rows: PartyListRow[]; canManage: boolean; drivers?: Option[] }) {
  const { dict } = useI18n();
  const t = kind === "customer" ? dict.erp.customers : dict.erp.suppliers;
  const cols: Col<PartyListRow>[] = [
    { id: "code", header: dict.common.code, value: (r) => r.code, cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code}</span>, hideBelow: "md" },
    {
      id: "name",
      header: dict.common.name,
      value: (r) => `${r.name} ${r.name_ar ?? ""}`,
      cell: (r) => (
        <div>
          <p className="font-semibold text-palm-900">{r.name}</p>
          {r.name_ar && <p className="text-xs text-muted-foreground" dir="rtl">{r.name_ar}</p>}
        </div>
      ),
    },
    { id: "phone", header: dict.common.phone, value: (r) => r.phone ?? "", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span>, hideBelow: "sm" },
    { id: "city", header: dict.common.city, value: (r) => r.city ?? "", cell: (r) => r.city ?? "—", hideBelow: "lg" },
    { id: "docs", header: kind === "customer" ? dict.erp.customers.invoices : dict.erp.suppliers.purchases, value: (r) => r.docs, cell: (r) => <span className="tabular-nums">{r.docs}</span>, align: "end", hideBelow: "md" },
    { id: "balance", header: dict.common.balance, value: (r) => r.balance, cell: (r) => <Money value={r.balance} className={r.balance > 0 ? "font-semibold" : "text-muted-foreground"} signed />, align: "end" },
    { id: "status", header: dict.common.status, value: (r) => (r.is_active ? 1 : 0), cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} />, align: "center", hideBelow: "sm" },
  ];
  return (
    <DataTable
      rows={rows}
      columns={cols}
      rowHref={(r) => `/erp/${kind}s/${r.id}`}
      initialSort={{ id: "balance", desc: true }}
      emptyTitle={t.empty}
      toolbar={
        canManage && (
          <PartyForm
            kind={kind}
            drivers={drivers}
            trigger={
              <Button>
                <Plus />
                {t.new}
              </Button>
            }
          />
        )
      }
      emptyAction={
        canManage && (
          <PartyForm
            kind={kind}
            drivers={drivers}
            trigger={
              <Button>
                <Plus />
                {t.new}
              </Button>
            }
          />
        )
      }
    />
  );
}
