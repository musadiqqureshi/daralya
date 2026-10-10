"use client";
import Link from "next/link";
import { useState } from "react";
import { Ban, CheckCircle2, HandCoins, Info, Loader2, Plus, Printer, Save } from "lucide-react";
import { approvePayroll, cancelPayroll, generatePayroll, updatePayrollItem } from "@/app/erp/(app)/_actions/hr";
import { DataTable, type Col } from "@/components/erp/data-table";
import { Field } from "@/components/erp/field";
import { DateText, Money } from "@/components/erp/money";
import { PaymentDialog } from "@/components/erp/payment-dialog";
import { ReasonDialog } from "@/components/erp/reason-dialog";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { addDays, monthStart, todayRiyadh } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export function GenerateDialog() {
  const { dict } = useI18n();
  const t = dict.erp.payroll;
  const lastMonthEnd = addDays(monthStart(todayRiyadh()), -1);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(monthStart(lastMonthEnd));
  const [end, setEnd] = useState(lastMonthEnd);
  const [notes, setNotes] = useState("");
  const { run, pending, error } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus />{t.generate}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.generate}</DialogTitle>
          <DialogDescription>{t.unrecordedHint}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={dict.common.from} htmlFor="pg-s"><Input id="pg-s" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={dict.common.to} htmlFor="pg-e"><Input id="pg-e" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label={dict.common.notes} htmlFor="pg-n" className="sm:col-span-2"><Input id="pg-n" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={pending} onClick={() => run(() => generatePayroll(start, end, notes), { success: t.generated, onSuccess: (id) => { setOpen(false); if (id) window.location.href = `/erp/payroll/${id}`; } })}>
            {pending && <Loader2 className="animate-spin" />}
            {t.generate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type RunRow = { id: string; run_no: string; period_start: string; period_end: string; status: string; total_net: number; employees: number; paid: number };

export function RunsTable({ rows }: { rows: RunRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp.payroll;
  const cols: Col<RunRow>[] = [
    { id: "no", header: dict.erp.fields.documentNo, value: (r) => r.run_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.run_no}</span> },
    { id: "period", header: dict.erp.fields.period, value: (r) => r.period_start, cell: (r) => <span><DateText value={r.period_start} /> – <DateText value={r.period_end} /></span> },
    { id: "emp", header: dict.erp.nav.staff, value: (r) => r.employees, cell: (r) => <span className="tabular-nums">{r.employees}</span>, align: "end", hideBelow: "sm" },
    { id: "net", header: t.totalNet, value: (r) => r.total_net, cell: (r) => <Money value={r.total_net} className="font-semibold" />, align: "end" },
    { id: "paid", header: dict.erp.fields.paid, value: (r) => r.paid, cell: (r) => <Money value={r.paid} className="text-muted-foreground" />, align: "end", hideBelow: "md" },
    { id: "status", header: dict.common.status, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} />, align: "center" },
  ];
  return <DataTable rows={rows} columns={cols} rowHref={(r) => `/erp/payroll/${r.id}`} emptyTitle={t.empty} initialSort={{ id: "period", desc: true }} />;
}

export type ItemRow = {
  id: string;
  employee_id: string;
  name: string;
  employee_no: string;
  salary_type: string;
  scheduled_days: number;
  present_days: number;
  late_count: number;
  late_minutes: number;
  half_days: number;
  absent_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  unrecorded_days: number;
  worked_hours: number;
  overtime_hours: number;
  base_earned: number;
  overtime_amount: number;
  late_deduction: number;
  absence_deduction: number;
  half_day_deduction: number;
  advance_balance: number;
  advance_deduction: number;
  bonus: number;
  other_deduction: number;
  net_pay: number;
  paid_amount: number;
  notes: string | null;
};

function EditableCell({ value, onSave, max, disabled }: { value: number; onSave: (v: number) => void; max?: number; disabled?: boolean }) {
  const [v, setV] = useState(String(value));
  const dirty = Number(v) !== value;
  if (disabled) return <Money value={value} currency={false} />;
  return (
    <div className="flex items-center justify-end gap-1">
      <Input type="number" min="0" max={max} step="0.01" value={v} onChange={(e) => setV(e.target.value)} className={cn("h-7 w-24 text-end text-xs tabular-nums", dirty && "border-gold-500")} />
      {dirty && (
        <Button size="icon-xs" variant="ghost" onClick={() => onSave(Number(v) || 0)} aria-label="Save">
          <Save />
        </Button>
      )}
    </div>
  );
}

export function RunDetail({ runId, status, items, canPrepare, canApprove, canPay }: { runId: string; status: string; items: ItemRow[]; canPrepare: boolean; canApprove: boolean; canPay: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.payroll;
  const { run, pending } = useServerAction();
  const draft = status === "draft";
  const edit = draft && canPrepare;
  const save = (id: string, patch: Record<string, number>) => run(() => updatePayrollItem(id, patch), { success: t.lineSaved });
  const unrecorded = items.reduce((s, i) => s + i.unrecorded_days, 0);
  const totals = items.reduce((s, i) => ({ net: s.net + i.net_pay, paid: s.paid + i.paid_amount }), { net: 0, paid: 0 });
  const cols: Col<ItemRow>[] = [
    {
      id: "emp",
      header: dict.erp.fields.employee,
      value: (r) => `${r.name} ${r.employee_no}`,
      cell: (r) => (
        <div className="min-w-40">
          <Link href={`/erp/staff/${r.employee_id}`} className="font-semibold text-palm-900 hover:underline">{r.name}</Link>
          <p className="text-xs text-muted-foreground">{r.employee_no} · {dict.erp.salaryTypes[r.salary_type as "monthly"]}</p>
        </div>
      ),
    },
    {
      id: "days",
      header: t.days,
      cell: (r) => (
        <dl className="grid grid-cols-2 gap-x-3 text-[0.7rem] whitespace-nowrap text-muted-foreground">
          <dt>{t.scheduled}</dt><dd className="text-end font-semibold text-foreground tabular-nums">{r.scheduled_days}</dd>
          <dt>{t.present}</dt><dd className="text-end tabular-nums">{r.present_days}{r.half_days ? ` + ½×${r.half_days}` : ""}</dd>
          <dt>{t.absent}</dt><dd className={cn("text-end tabular-nums", r.absent_days && "text-destructive")}>{r.absent_days}{r.unpaid_leave_days ? ` + ${r.unpaid_leave_days}` : ""}</dd>
          {r.late_count > 0 && (<><dt>{dict.erp.status.late}</dt><dd className="text-end text-gold-700 tabular-nums">{r.late_count} · {r.late_minutes}′</dd></>)}
          {r.unrecorded_days > 0 && (<><dt className="text-warning">{t.unrecorded}</dt><dd className="text-end font-semibold text-warning tabular-nums">{r.unrecorded_days}</dd></>)}
        </dl>
      ),
      hideBelow: "md",
    },
    { id: "base", header: t.base, value: (r) => r.base_earned, cell: (r) => <Money value={r.base_earned} currency={false} />, align: "end" },
    { id: "ot", header: t.overtime, value: (r) => r.overtime_amount, cell: (r) => <span className="text-xs"><Money value={r.overtime_amount} currency={false} />{r.overtime_hours ? <span className="block text-muted-foreground">{r.overtime_hours} h</span> : null}</span>, align: "end", hideBelow: "lg" },
    { id: "bonus", header: t.bonus, value: (r) => r.bonus, cell: (r) => <EditableCell key={r.bonus} value={r.bonus} disabled={!edit} onSave={(v) => save(r.id, { bonus: v })} />, align: "end" },
    { id: "late", header: t.lateDeduction, value: (r) => r.late_deduction, cell: (r) => <EditableCell key={r.late_deduction} value={r.late_deduction} disabled={!edit} onSave={(v) => save(r.id, { late_deduction: v })} />, align: "end", hideBelow: "lg" },
    { id: "abs", header: t.absenceDeduction, value: (r) => r.absence_deduction + r.half_day_deduction, cell: (r) => <EditableCell key={r.absence_deduction} value={r.absence_deduction} disabled={!edit} onSave={(v) => save(r.id, { absence_deduction: v })} />, align: "end", hideBelow: "lg" },
    {
      id: "adv",
      header: t.advanceDeduction,
      value: (r) => r.advance_deduction,
      cell: (r) => (
        <div>
          <EditableCell key={r.advance_deduction} value={r.advance_deduction} max={r.advance_balance} disabled={!edit} onSave={(v) => save(r.id, { advance_deduction: v })} />
          {r.advance_balance > 0 && <p className="mt-0.5 text-end text-[0.65rem] text-muted-foreground">{t.advanceBalance}: <Money value={r.advance_balance} currency={false} /></p>}
        </div>
      ),
      align: "end",
    },
    { id: "other", header: t.otherDeduction, value: (r) => r.other_deduction, cell: (r) => <EditableCell key={r.other_deduction} value={r.other_deduction} disabled={!edit} onSave={(v) => save(r.id, { other_deduction: v })} />, align: "end", hideBelow: "lg" },
    { id: "net", header: t.net, value: (r) => r.net_pay, cell: (r) => <Money value={r.net_pay} className="font-bold" />, align: "end" },
    {
      id: "pay",
      header: "",
      align: "end",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          {status === "approved" && canPay && r.net_pay - r.paid_amount > 0.004 && (
            <PaymentDialog
              purposes={["salary"]}
              party={{ id: r.employee_id, label: r.name }}
              docs={[{ doc_type: "payroll_item", doc_id: r.id, label: r.employee_no, outstanding: Math.round((r.net_pay - r.paid_amount) * 100) / 100 }]}
              defaultAmount={Math.round((r.net_pay - r.paid_amount) * 100) / 100}
              title={t.pay}
              trigger={<Button size="sm" variant="outline"><HandCoins />{t.pay}</Button>}
            />
          )}
          {status === "approved" && r.paid_amount >= r.net_pay - 0.004 && <StatusBadge status="paid" />}
          {status !== "cancelled" && (
            <Button asChild size="icon-sm" variant="ghost" aria-label={t.payslip}>
              <Link href={`/print/payslip/${r.id}`} target="_blank"><Printer /></Link>
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      {draft && unrecorded > 0 && (
        <p className="flex gap-2 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />
          {t.unrecordedHint}
        </p>
      )}
      <DataTable
        rows={items}
        columns={cols}
        search={items.length > 8}
        pageSize={100}
        footer={
          <tr>
            <td colSpan={cols.length - 2} className="px-4 py-3 text-end">{t.totalNet}</td>
            <td className="px-4 py-3 text-end"><Money value={totals.net} /></td>
            <td className="px-4 py-3 text-end text-xs text-muted-foreground">{dict.erp.fields.paid}: <Money value={totals.paid} /></td>
          </tr>
        }
      />
      <div className="flex flex-wrap justify-end gap-2">
        {draft && canApprove && (
          <ReasonDialog
            title={t.cancelRun}
            onConfirm={(reason) => cancelPayroll(runId, reason)}
            trigger={<Button variant="ghost" className="text-destructive"><Ban />{t.cancelRun}</Button>}
          />
        )}
        {status === "approved" && canApprove && totals.paid === 0 && (
          <ReasonDialog title={t.cancelRun} onConfirm={(reason) => cancelPayroll(runId, reason)} trigger={<Button variant="ghost" className="text-destructive"><Ban />{t.cancelRun}</Button>} />
        )}
        {draft && canApprove && (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg"><CheckCircle2 />{t.approve}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.approve}</DialogTitle>
                <DialogDescription>{t.approveHint}</DialogDescription>
              </DialogHeader>
              <p className="text-lg font-semibold">{t.totalNet}: <Money value={totals.net} /></p>
              <DialogFooter>
                <Button disabled={pending} onClick={() => run(() => approvePayroll(runId), { success: t.approved })}>
                  {pending && <Loader2 className="animate-spin" />}
                  {dict.common.confirm}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
