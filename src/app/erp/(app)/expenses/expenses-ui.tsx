"use client";
import { useState } from "react";
import { Ban, Loader2, Paperclip, Plus } from "lucide-react";
import { cancelExpense, createExpense } from "@/app/erp/(app)/_actions/finance";
import { DataTable, type Col } from "@/components/erp/data-table";
import { Field, nativeSelect } from "@/components/erp/field";
import { FileUpload } from "@/components/erp/file-upload";
import { DateText, Money } from "@/components/erp/money";
import { ReasonDialog } from "@/components/erp/reason-dialog";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { todayRiyadh } from "@/lib/i18n/format";

type Named = { id: string; name_en: string; name_ar: string };

export function ExpenseDialog({ categories, accounts, methods, defaultOpen = false }: { categories: Named[]; accounts: (Named & { kind: string })[]; methods: Named[]; defaultOpen?: boolean }) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const name = (r: Named) => (locale === "ar" ? r.name_ar : r.name_en);
  const [open, setOpen] = useState(defaultOpen);
  const [v, setV] = useState({ date: todayRiyadh(), category_id: categories[0]?.id ?? "", amount: "", vat_amount: "", money_account_id: accounts.find((a) => a.kind === "cash")?.id ?? accounts[0]?.id ?? "", method_id: methods[0]?.id ?? "", payee: "", description: "", reference: "" });
  const [receipt, setReceipt] = useState<string | null>(null);
  const { run, pending, error } = useServerAction();
  const s = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus />{t.expenses.new}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.expenses.new}</DialogTitle>
          <DialogDescription>{t.cash.noGateway}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.fields.category} htmlFor="ex-cat" required>
            <select id="ex-cat" className={nativeSelect} value={v.category_id} onChange={s("category_id")}>{categories.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}</select>
          </Field>
          <Field label={dict.common.date} htmlFor="ex-date" required><Input id="ex-date" type="date" value={v.date} onChange={s("date")} /></Field>
          <Field label={dict.common.amount} htmlFor="ex-amt" required><Input id="ex-amt" type="number" min="0" step="0.01" value={v.amount} onChange={s("amount")} /></Field>
          <Field label={t.fields.vatAmount} htmlFor="ex-vat"><Input id="ex-vat" type="number" min="0" step="0.01" value={v.vat_amount} onChange={s("vat_amount")} /></Field>
          <Field label={t.fields.account} htmlFor="ex-acc" required>
            <select id="ex-acc" className={nativeSelect} value={v.money_account_id} onChange={s("money_account_id")}>{accounts.map((a) => <option key={a.id} value={a.id}>{name(a)}</option>)}</select>
          </Field>
          <Field label={t.fields.method} htmlFor="ex-m">
            <select id="ex-m" className={nativeSelect} value={v.method_id} onChange={s("method_id")}>{methods.map((m) => <option key={m.id} value={m.id}>{name(m)}</option>)}</select>
          </Field>
          <Field label={t.fields.payee} htmlFor="ex-payee"><Input id="ex-payee" value={v.payee} onChange={s("payee")} /></Field>
          <Field label={dict.common.reference} htmlFor="ex-ref"><Input id="ex-ref" value={v.reference} onChange={s("reference")} /></Field>
          <Field label={dict.common.description} htmlFor="ex-desc" className="sm:col-span-2"><Textarea id="ex-desc" rows={2} value={v.description} onChange={s("description")} /></Field>
          <Field label={t.fields.receipt} className="sm:col-span-2"><FileUpload bucket="documents" folder="receipts" value={receipt} onChange={setReceipt} /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending || !(Number(v.amount) > 0) || !v.category_id || !v.money_account_id}
            onClick={() =>
              run(() => createExpense({ ...v, vat_amount: v.vat_amount || 0, receipt_path: receipt, method_id: v.method_id || null }), {
                success: t.expenses.saved,
                onSuccess: () => { setOpen(false); setV((x) => ({ ...x, amount: "", vat_amount: "", payee: "", description: "", reference: "" })); setReceipt(null); },
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type ExpenseRow = { id: string; expense_no: string; expense_date: string; category: string; amount: number; vat_amount: number; account: string; payee: string | null; description: string | null; status: string; receipt_url: string | null };

export function ExpensesTable({ rows, canCancel, toolbar }: { rows: ExpenseRow[]; canCancel: boolean; toolbar?: React.ReactNode }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const cols: Col<ExpenseRow>[] = [
    { id: "no", header: t.fields.documentNo, value: (r) => r.expense_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.expense_no}</span> },
    { id: "date", header: dict.common.date, value: (r) => r.expense_date, cell: (r) => <DateText value={r.expense_date} /> },
    { id: "cat", header: t.fields.category, value: (r) => r.category, cell: (r) => <span className="font-medium">{r.category}</span> },
    { id: "desc", header: dict.common.description, value: (r) => `${r.payee ?? ""} ${r.description ?? ""}`, cell: (r) => <span className="text-xs">{[r.payee, r.description].filter(Boolean).join(" · ") || "—"}</span>, hideBelow: "md" },
    { id: "account", header: t.fields.account, value: (r) => r.account, cell: (r) => r.account, hideBelow: "lg" },
    { id: "receipt", header: "", cell: (r) => (r.receipt_url ? <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" aria-label={t.fields.receipt} className="text-palm-700"><Paperclip className="size-4" /></a> : null), align: "center" },
    { id: "amount", header: dict.common.amount, value: (r) => r.amount + r.vat_amount, cell: (r) => <Money value={r.amount + r.vat_amount} className={r.status === "cancelled" ? "text-muted-foreground line-through" : "font-semibold"} />, align: "end" },
    {
      id: "act",
      header: "",
      align: "end",
      cell: (r) =>
        r.status === "cancelled" ? <StatusBadge status="cancelled" /> : canCancel ? (
          <ReasonDialog title={t.expenses.cancelTitle} description={r.expense_no} onConfirm={(reason) => cancelExpense(r.id, reason)} trigger={<Button size="icon-sm" variant="ghost" aria-label={t.expenses.cancelTitle}><Ban className="text-destructive" /></Button>} />
        ) : null,
    },
  ];
  return <DataTable rows={rows} columns={cols} initialSort={{ id: "date", desc: true }} emptyTitle={t.expenses.empty} toolbar={toolbar} />;
}
