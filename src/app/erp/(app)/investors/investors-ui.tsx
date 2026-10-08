"use client";
import { useState } from "react";
import { Ban, Calculator, Check, FileText, Loader2, Pencil, Plus } from "lucide-react";
import { approveAllocation, bookProfit, cancelAllocation, createAllocation, saveInvestment, saveInvestor, type InvestmentInput, type InvestorInput } from "@/app/erp/(app)/_actions/investors";
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
import { tpl } from "@/lib/i18n/dictionaries/en";
import { fmtMoney, todayRiyadh } from "@/lib/i18n/format";

export function InvestorDialog({ initial, trigger }: { initial?: InvestorInput & { id: string }; trigger: React.ReactNode }) {
  const { dict } = useI18n();
  const t = dict.erp.investors;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<InvestorInput>(initial ?? { name: "" });
  const { run, pending, error } = useServerAction();
  const s = (k: keyof InvestorInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(initial ?? { name: "" }); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? t.edit : t.new}</DialogTitle>
          <DialogDescription>{t.privacy}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={dict.common.name} htmlFor="iv-n" required><Input id="iv-n" value={v.name} onChange={s("name")} /></Field>
          <Field label={dict.common.nameAr} htmlFor="iv-na"><Input id="iv-na" dir="rtl" value={v.name_ar ?? ""} onChange={s("name_ar")} /></Field>
          <Field label={dict.common.phone} htmlFor="iv-p"><Input id="iv-p" dir="ltr" value={v.phone ?? ""} onChange={s("phone")} /></Field>
          <Field label={dict.common.email} htmlFor="iv-e"><Input id="iv-e" dir="ltr" type="email" value={v.email ?? ""} onChange={s("email")} /></Field>
          <Field label={dict.erp.staff.idNumber} htmlFor="iv-id"><Input id="iv-id" dir="ltr" value={v.id_number ?? ""} onChange={s("id_number")} /></Field>
          <Field label={dict.common.address} htmlFor="iv-a"><Input id="iv-a" value={v.address ?? ""} onChange={s("address")} /></Field>
          <Field label={dict.common.notes} htmlFor="iv-no" className="sm:col-span-2"><Textarea id="iv-no" rows={2} value={v.notes ?? ""} onChange={s("notes")} /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={pending || v.name.trim().length < 2} onClick={() => run(() => saveInvestor({ ...v, id: initial?.id }), { success: dict.common.saved, onSuccess: () => setOpen(false) })}>
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InvestmentDialog({ investorId, initial, trigger }: { investorId: string; initial?: InvestmentInput & { id: string }; trigger: React.ReactNode }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const blank: InvestmentInput = { investor_id: investorId, model: "profit_share", committed_amount: 0, start_date: todayRiyadh(), profit_frequency: "quarterly", status: "active" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<InvestmentInput>(initial ?? blank);
  const { run, pending, error } = useServerAction();
  const s = (k: keyof InvestmentInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const str = (x: unknown) => (x === null || x === undefined ? "" : String(x));
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(initial ?? blank); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.investors.newInvestment}</DialogTitle>
          <DialogDescription>{t.investors.adviser}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.fields.model} htmlFor="in-m">
            <select id="in-m" className={nativeSelect} value={v.model} onChange={s("model")} disabled={Boolean(initial)}>
              {(Object.keys(t.models) as (keyof typeof t.models)[]).map((k) => <option key={k} value={k}>{t.models[k]}</option>)}
            </select>
          </Field>
          <Field label={t.fields.project} htmlFor="in-pr"><Input id="in-pr" value={v.project_name ?? ""} onChange={s("project_name")} /></Field>
          <Field label={t.fields.committed} htmlFor="in-c" required><Input id="in-c" type="number" min="0" step="0.01" value={str(v.committed_amount)} onChange={s("committed_amount")} /></Field>
          <Field label={t.fields.frequency} htmlFor="in-f">
            <select id="in-f" className={nativeSelect} value={v.profit_frequency} onChange={s("profit_frequency")}>
              {(Object.keys(t.frequencies) as (keyof typeof t.frequencies)[]).map((k) => <option key={k} value={k}>{t.frequencies[k]}</option>)}
            </select>
          </Field>
          {v.model !== "loan" && <Field label={t.fields.sharePct} htmlFor="in-sp"><Input id="in-sp" type="number" min="0" max="100" step="0.01" value={str(v.profit_share_pct)} onChange={s("profit_share_pct")} /></Field>}
          {v.model === "equity" && <Field label={t.fields.equityPct} htmlFor="in-eq"><Input id="in-eq" type="number" min="0" max="100" step="0.01" value={str(v.equity_pct)} onChange={s("equity_pct")} /></Field>}
          <Field label={t.fields.startDate} htmlFor="in-sd"><Input id="in-sd" type="date" value={v.start_date} onChange={s("start_date")} /></Field>
          <Field label={t.fields.endDate} htmlFor="in-ed"><Input id="in-ed" type="date" value={str(v.end_date)} onChange={s("end_date")} /></Field>
          <Field label={t.fields.terms} htmlFor="in-t" className="sm:col-span-2"><Textarea id="in-t" rows={3} value={v.terms ?? ""} onChange={s("terms")} /></Field>
          <Field label={t.fields.agreement} className="sm:col-span-2"><FileUpload bucket="documents" folder="agreements" value={v.agreement_path ?? null} onChange={(p) => setV((x) => ({ ...x, agreement_path: p }))} accept="application/pdf,image/jpeg,image/png" /></Field>
          {initial && (
            <Field label={dict.common.status} htmlFor="in-st">
              <select id="in-st" className={nativeSelect} value={v.status} onChange={s("status")}>
                <option value="active">{t.status.active}</option>
                <option value="closed">{t.status.closed}</option>
              </select>
            </Field>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={pending || !(Number(v.committed_amount) > 0)} onClick={() => run(() => saveInvestment({ ...v, id: initial?.id, investor_id: investorId }), { success: dict.common.saved, onSuccess: () => setOpen(false) })}>
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AllocationDialog({ investment, approved, canSeeBooks }: { investment: { id: string; label: string; share: number | null; model: string }; approved: { id: string; label: string }[]; canSeeBooks: boolean }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.investors;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"allocation" | "adjustment">("allocation");
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [basis, setBasis] = useState("");
  const [pct, setPct] = useState(investment.share?.toString() ?? "");
  const [amount, setAmount] = useState("");
  const [adjusts, setAdjusts] = useState(approved[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [suggestion, setSuggestion] = useState<number | null>(null);
  const { run, pending, error } = useServerAction();
  const preview = kind === "allocation" && basis && pct ? Math.round(Math.max(Number(basis), 0) * Number(pct)) / 100 : null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={investment.model === "loan"}><Calculator />{t.allocate}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.allocate} · {investment.label}</DialogTitle>
          <DialogDescription>{t.adviser}</DialogDescription>
        </DialogHeader>
        <div className="inline-flex rounded-lg border p-0.5">
          {(["allocation", "adjustment"] as const).map((k) => (
            <button key={k} type="button" disabled={k === "adjustment" && !approved.length} onClick={() => setKind(k)} className={`rounded-md px-3 py-1 text-sm ${kind === k ? "bg-palm-800 text-cream" : "text-muted-foreground disabled:opacity-40"}`}>
              {k === "allocation" ? t.allocate : t.adjustment}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.periodLabel} htmlFor="al-l" required className="sm:col-span-2"><Input id="al-l" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Q1 2026" /></Field>
          {kind === "allocation" ? (
            <>
              <Field label={dict.common.from} htmlFor="al-s"><Input id="al-s" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label={dict.common.to} htmlFor="al-e"><Input id="al-e" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
              {canSeeBooks && start && end && (
                <div className="sm:col-span-2">
                  <Button type="button" size="sm" variant="ghost" onClick={async () => { const r = await bookProfit(start, end); if (r.ok) setSuggestion(r.data ?? 0); }}>
                    <Calculator />
                    {dict.erp.reports.net}
                  </Button>
                  {suggestion !== null && (
                    <button type="button" className="ms-2 text-sm text-palm-700 underline" onClick={() => setBasis(String(suggestion))}>
                      {tpl(t.suggestedProfit, { amount: fmtMoney(suggestion, locale) })}
                    </button>
                  )}
                </div>
              )}
              <Field label={t.basis} htmlFor="al-b" required><Input id="al-b" type="number" step="0.01" value={basis} onChange={(e) => setBasis(e.target.value)} /></Field>
              <Field label={dict.erp.fields.sharePct} htmlFor="al-p"><Input id="al-p" type="number" min="0" max="100" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
              {preview !== null && <p className="rounded-lg bg-palm-50 px-3 py-2 text-sm font-semibold text-palm-800 sm:col-span-2">{t.profitEarned}: <Money value={preview} /></p>}
            </>
          ) : (
            <>
              <Field label={t.allocations} htmlFor="al-adj" className="sm:col-span-2">
                <select id="al-adj" className={nativeSelect} value={adjusts} onChange={(e) => setAdjusts(e.target.value)}>{approved.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
              </Field>
              <Field label={dict.common.amount} htmlFor="al-a" hint="+ / −" required><Input id="al-a" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label={dict.common.reason} htmlFor="al-r" required className="sm:col-span-2"><Textarea id="al-r" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            </>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending || !label || (kind === "allocation" ? basis === "" : !Number(amount) || reason.trim().length < 3)}
            onClick={() =>
              run(
                () =>
                  createAllocation(
                    kind === "allocation"
                      ? { investment_id: investment.id, period_label: label, period_start: start || null, period_end: end || null, basis_net_profit: basis, share_pct: pct === "" ? null : pct }
                      : { investment_id: investment.id, kind: "adjustment", adjusts_id: adjusts, period_label: label, amount, reason },
                  ),
                { success: t.allocationSaved, onSuccess: () => setOpen(false) },
              )
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

export type AllocRow = { id: string; allocation_no: string; investment: string; kind: string; period_label: string; basis: number | null; share_pct: number | null; amount: number; status: string; approved_at: string | null; reason: string | null };

export function AllocationsTable({ rows, canApprove, canManage }: { rows: AllocRow[]; canApprove: boolean; canManage: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.investors;
  const { run, pending } = useServerAction();
  const cols: Col<AllocRow>[] = [
    { id: "no", header: dict.erp.fields.documentNo, value: (r) => r.allocation_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.allocation_no}</span> },
    { id: "inv", header: dict.erp.fields.investment, value: (r) => r.investment, cell: (r) => r.investment, hideBelow: "md" },
    { id: "period", header: t.periodLabel, value: (r) => r.period_label, cell: (r) => <span>{r.period_label}{r.kind === "adjustment" && <span className="ms-1.5 rounded bg-gold-100 px-1.5 text-[0.65rem] font-semibold text-gold-700">{t.adjustment}</span>}{r.reason && <span className="block text-xs text-muted-foreground">{r.reason}</span>}</span> },
    { id: "basis", header: t.basis, value: (r) => r.basis ?? 0, cell: (r) => (r.basis === null ? "—" : <span className="text-xs"><Money value={r.basis} /> × {r.share_pct}%</span>), align: "end", hideBelow: "lg" },
    { id: "amount", header: dict.common.amount, value: (r) => r.amount, cell: (r) => <Money value={r.amount} signed className="font-semibold" />, align: "end" },
    { id: "status", header: dict.common.status, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} />, align: "center" },
    {
      id: "act",
      header: "",
      align: "end",
      cell: (r) =>
        r.status === "draft" ? (
          <div className="flex justify-end gap-1">
            {canApprove && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => approveAllocation(r.id), { success: t.allocationApproved })}><Check className="text-success" />{t.approveAllocation}</Button>}
            {canManage && <ReasonDialog title={dict.common.cancel} onConfirm={(reason) => cancelAllocation(r.id, reason)} trigger={<Button size="icon-sm" variant="ghost" aria-label={dict.common.cancel}><Ban className="text-destructive" /></Button>} />}
          </div>
        ) : r.approved_at ? <DateText value={r.approved_at} className="text-xs text-muted-foreground" /> : null,
    },
  ];
  return <DataTable rows={rows} columns={cols} search={false} initialSort={{ id: "no", desc: true }} />;
}

export function AgreementLink({ url }: { url: string | null }) {
  const { dict } = useI18n();
  if (!url) return <span>—</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-palm-700 hover:underline"><FileText className="size-3.5" />{dict.erp.fields.agreement}</a>;
}

export function NewInvestorButton() {
  const { dict } = useI18n();
  return <InvestorDialog trigger={<Button><Plus />{dict.erp.investors.new}</Button>} />;
}

export function EditInvestorButton({ initial }: { initial: InvestorInput & { id: string } }) {
  const { dict } = useI18n();
  return <InvestorDialog initial={initial} trigger={<Button variant="outline" size="icon" aria-label={dict.common.edit}><Pencil /></Button>} />;
}
