"use client";
import { Ban, CheckCircle2, MoreHorizontal } from "lucide-react";
import { cancelPayment, verifyPayment } from "@/app/erp/(app)/_actions/payments";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/client";
import { DataTable, type Col } from "./data-table";
import { DateText, Money } from "./money";
import { ReasonDialog } from "./reason-dialog";
import { StatusBadge } from "./status-badge";
import { useServerAction } from "./use-server-action";

export type SaleRow = {
  id: string;
  invoice_no: string;
  sale_date: string;
  customer: string;
  total: number;
  returned_total: number;
  paid_total: number;
  pending_total: number;
  payment_status: string;
  status: string;
  driver?: string | null;
};

export function SalesTable({ rows, showCustomer = true, toolbar, search = true }: { rows: SaleRow[]; showCustomer?: boolean; toolbar?: React.ReactNode; search?: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const cols: Col<SaleRow>[] = [
    { id: "no", header: t.fields.invoiceNo, value: (r) => r.invoice_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.invoice_no}</span> },
    { id: "date", header: dict.common.date, value: (r) => r.sale_date, cell: (r) => <DateText value={r.sale_date} /> },
    ...(showCustomer ? [{ id: "customer", header: t.fields.customer, value: (r: SaleRow) => r.customer, cell: (r: SaleRow) => <span className="font-medium">{r.customer}</span> }] : []),
    { id: "total", header: dict.common.total, value: (r) => r.total - r.returned_total, cell: (r) => <Money value={r.total - r.returned_total} />, align: "end" },
    { id: "due", header: t.fields.outstanding, value: (r) => r.total - r.returned_total - r.paid_total, cell: (r) => <Money value={r.status === "cancelled" ? 0 : r.total - r.returned_total - r.paid_total} className="text-muted-foreground" />, align: "end", hideBelow: "md" },
    {
      id: "status",
      header: dict.common.status,
      value: (r) => (r.status === "cancelled" ? "cancelled" : r.payment_status),
      cell: (r) => <StatusBadge status={r.status === "cancelled" ? "cancelled" : r.payment_status} />,
      align: "center",
    },
  ];
  return <DataTable rows={rows} columns={cols} rowHref={(r) => `/erp/sales/${r.id}`} initialSort={{ id: "date", desc: true }} emptyTitle={t.sales.empty} toolbar={toolbar} search={search} />;
}

export type PurchaseRow = {
  id: string;
  purchase_no: string;
  purchase_date: string;
  supplier: string;
  supplier_invoice_no: string | null;
  total: number;
  returned_total: number;
  paid_total: number;
  payment_status: string;
  status: string;
};

export function PurchasesTable({ rows, showSupplier = true, toolbar }: { rows: PurchaseRow[]; showSupplier?: boolean; toolbar?: React.ReactNode }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const cols: Col<PurchaseRow>[] = [
    { id: "no", header: t.fields.documentNo, value: (r) => r.purchase_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.purchase_no}</span> },
    { id: "date", header: dict.common.date, value: (r) => r.purchase_date, cell: (r) => <DateText value={r.purchase_date} /> },
    ...(showSupplier ? [{ id: "supplier", header: t.fields.supplier, value: (r: PurchaseRow) => r.supplier, cell: (r: PurchaseRow) => <span className="font-medium">{r.supplier}</span> }] : []),
    { id: "ref", header: t.fields.supplierInvoiceNo, value: (r) => r.supplier_invoice_no ?? "", cell: (r) => r.supplier_invoice_no ?? "—", hideBelow: "lg" },
    { id: "total", header: dict.common.total, value: (r) => r.total - r.returned_total, cell: (r) => <Money value={r.total - r.returned_total} />, align: "end" },
    { id: "due", header: t.fields.outstanding, value: (r) => r.total - r.returned_total - r.paid_total, cell: (r) => <Money value={r.status === "cancelled" ? 0 : r.total - r.returned_total - r.paid_total} className="text-muted-foreground" />, align: "end", hideBelow: "md" },
    { id: "status", header: dict.common.status, value: (r) => (r.status === "cancelled" ? "cancelled" : r.payment_status), cell: (r) => <StatusBadge status={r.status === "cancelled" ? "cancelled" : r.payment_status} />, align: "center" },
  ];
  return <DataTable rows={rows} columns={cols} rowHref={(r) => `/erp/purchases/${r.id}`} initialSort={{ id: "date", desc: true }} emptyTitle={t.purchases.empty} toolbar={toolbar} />;
}

export type PaymentRow = {
  id: string;
  payment_no: string;
  payment_date: string;
  direction: "in" | "out";
  purpose: string;
  party: string;
  amount: number;
  method: string;
  account: string;
  reference: string | null;
  status: string;
  proof_url?: string | null;
  cancel_reason?: string | null;
};

function PaymentActions({ row, canVerify, canCancel }: { row: PaymentRow; canVerify: boolean; canCancel: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.cash;
  const { run, pending } = useServerAction();
  if (row.status === "cancelled" || (!canVerify && !canCancel)) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      {canVerify && row.status === "pending_verification" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => verifyPayment(row.id), { success: t.verified })}>
          <CheckCircle2 className="text-success" />
          {t.verify}
        </Button>
      )}
      {canCancel && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={dict.common.actions}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ReasonDialog
              title={t.cancelPayment}
              description={`${row.payment_no} · ${row.party}`}
              onConfirm={(reason) => cancelPayment(row.id, reason)}
              trigger={
                <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                  <Ban />
                  {t.cancelPayment}
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function PaymentsTable({ rows, canVerify = false, canCancel = false, showParty = true, toolbar, search = true }: { rows: PaymentRow[]; canVerify?: boolean; canCancel?: boolean; showParty?: boolean; toolbar?: React.ReactNode; search?: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const cols: Col<PaymentRow>[] = [
    { id: "no", header: t.fields.documentNo, value: (r) => r.payment_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.payment_no}</span> },
    { id: "date", header: dict.common.date, value: (r) => r.payment_date, cell: (r) => <DateText value={r.payment_date} /> },
    { id: "purpose", header: t.cash.purpose, value: (r) => r.purpose, cell: (r) => t.purposes[r.purpose as keyof typeof t.purposes] ?? r.purpose, hideBelow: "md" },
    ...(showParty ? [{ id: "party", header: t.cash.party, value: (r: PaymentRow) => r.party, cell: (r: PaymentRow) => <span className="font-medium">{r.party}</span> }] : []),
    {
      id: "method",
      header: t.fields.method,
      value: (r) => `${r.method} ${r.account} ${r.reference ?? ""}`,
      cell: (r) => (
        <div className="text-xs">
          <p>{r.method} · {r.account}</p>
          {r.reference && <p className="text-muted-foreground">{r.reference}</p>}
          {r.proof_url && <a href={r.proof_url} target="_blank" rel="noopener noreferrer" className="text-palm-700 underline">{t.fields.proof}</a>}
        </div>
      ),
      hideBelow: "lg",
    },
    {
      id: "amount",
      header: dict.common.amount,
      value: (r) => (r.direction === "in" ? r.amount : -r.amount),
      cell: (r) => <Money value={r.direction === "in" ? r.amount : -r.amount} className={r.direction === "in" ? "font-semibold text-success" : "font-semibold"} />,
      align: "end",
    },
    { id: "status", header: dict.common.status, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} />, align: "center" },
    { id: "actions", header: "", cell: (r) => <PaymentActions row={r} canVerify={canVerify} canCancel={canCancel} />, align: "end" },
  ];
  return <DataTable rows={rows} columns={cols} initialSort={{ id: "date", desc: true }} toolbar={toolbar} search={search} />;
}
