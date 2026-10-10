"use client";
import { useEffect, useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { loadPaymentOptions, recordPayment } from "@/app/erp/(app)/_actions/payments";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { fmtMoney, todayRiyadh } from "@/lib/i18n/format";
import type { PURPOSES } from "@/lib/erp/schemas";
import { EntitySelect, type Option } from "./entity-select";
import { Field, nativeSelect } from "./field";
import { FileUpload } from "./file-upload";
import { useServerAction } from "./use-server-action";

type Purpose = (typeof PURPOSES)[number];
export type PayDoc = { doc_type: "sale" | "purchase" | "payroll_item"; doc_id: string; label: string; outstanding: number };

type Opts = Awaited<ReturnType<typeof loadPaymentOptions>>;

/**
 * Manual payment entry (cash, bank transfer, deposit, cheque). Nothing is charged
 * or sent; methods that need verification stay pending until verified.
 */
export function PaymentDialog({
  trigger,
  purposes,
  party,
  parties,
  partyMap,
  investmentMap,
  investments,
  docs,
  defaultAmount,
  title,
}: {
  trigger: React.ReactNode;
  purposes: Purpose[];
  party?: { id: string; label: string };
  parties?: Option[];
  /** generic entry: party lists per party type, chosen from the purpose */
  partyMap?: Partial<Record<"customer" | "supplier" | "driver" | "employee" | "investor", Option[]>>;
  /** investments per investor id (for investor purposes in generic entry) */
  investmentMap?: Record<string, Option[]>;
  investments?: Option[];
  docs?: PayDoc[];
  defaultAmount?: number;
  title?: string;
}) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<Opts | null>(null);
  const [purpose, setPurpose] = useState<Purpose>(purposes[0]);
  const [partyId, setPartyId] = useState<string | null>(party?.id ?? null);
  const [investmentId, setInvestmentId] = useState<string | null>(investments?.length === 1 ? investments[0].value : null);
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [methodId, setMethodId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayRiyadh());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [auto, setAuto] = useState(!docs?.length);
  const { run, pending, error, setError } = useServerAction();

  useEffect(() => {
    if (open && !opts) {
      void loadPaymentOptions().then((o) => {
        setOpts(o);
        setMethodId((m) => m || o.methods[0]?.id || "");
        setAccountId((a) => a || o.accounts.find((x) => x.kind === "cash")?.id || o.accounts[0]?.id || "");
      });
    }
  }, [open, opts]);

  const method = opts?.methods.find((m) => m.id === methodId);
  const allocTotal = useMemo(() => Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0), [alloc]);
  const name = (r: { name_en: string; name_ar: string }) => (locale === "ar" ? r.name_ar : r.name_en);
  const canAuto = purpose === "customer_receipt" || purpose === "supplier_payment";
  const partyType = purpose.startsWith("customer") ? "customer" : purpose.startsWith("supplier") ? "supplier" : purpose === "driver_commission" ? "driver" : purpose.startsWith("salary") ? "employee" : "investor";
  const partyOptions = parties ?? partyMap?.[partyType] ?? [];
  const investmentOptions = investments ?? (partyType === "investor" && partyId ? investmentMap?.[partyId] : undefined);

  const submit = () => {
    setError(null);
    const allocations = Object.entries(alloc)
      .filter(([, v]) => Number(v) > 0)
      .map(([id, v]) => {
        const d = docs!.find((x) => x.doc_id === id)!;
        return { doc_type: d.doc_type, doc_id: id, amount: Number(v) };
      });
    void run(
      () =>
        recordPayment({
          purpose,
          party_id: partyId ?? "",
          investment_id: investmentId,
          amount: Number(amount),
          method_id: methodId,
          money_account_id: accountId,
          date,
          reference,
          proof_path: proof,
          notes,
          allocations: allocations.length ? allocations : undefined,
          auto_allocate: !allocations.length && canAuto && auto,
        }),
      {
        success: t.cash.paymentSaved,
        onSuccess: () => {
          setOpen(false);
          setAmount(defaultAmount ? String(defaultAmount) : "");
          setReference("");
          setNotes("");
          setProof(null);
          setAlloc({});
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title ?? t.payments.record}</DialogTitle>
          <DialogDescription>{t.cash.noGateway}</DialogDescription>
        </DialogHeader>
        {!opts ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {purposes.length > 1 && (
              <Field label={t.cash.purpose} htmlFor="pay-purpose" className="sm:col-span-2">
                <select
                  id="pay-purpose"
                  className={nativeSelect}
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value as Purpose);
                    if (!party) setPartyId(null);
                    setInvestmentId(null);
                  }}
                >
                  {purposes.map((p) => (
                    <option key={p} value={p}>
                      {t.purposes[p]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {party ? (
              <Field label={t.cash.party} className="sm:col-span-2">
                <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">{party.label}</p>
              </Field>
            ) : (
              <Field label={t.cash.party} className="sm:col-span-2" required>
                <EntitySelect options={partyOptions} value={partyId} onChange={(v) => { setPartyId(v); setInvestmentId(null); }} />
              </Field>
            )}
            {investmentOptions && (
              <Field label={t.fields.investment} className="sm:col-span-2" required>
                <EntitySelect options={investmentOptions} value={investmentId} onChange={setInvestmentId} />
              </Field>
            )}
            <Field label={t.payments.amount} htmlFor="pay-amount" required>
              <Input id="pay-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
            </Field>
            <Field label={dict.common.date} htmlFor="pay-date" required>
              <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t.fields.method} htmlFor="pay-method" required>
              <select id="pay-method" className={nativeSelect} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                {opts.methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {name(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.fields.account} htmlFor="pay-account" required>
              <select id="pay-account" className={nativeSelect} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {opts.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {name(a)} · {t.cash.kinds[a.kind]}
                  </option>
                ))}
              </select>
            </Field>
            {method?.requires_verification && (
              <p className="flex gap-2 rounded-lg bg-gold-100 px-3 py-2 text-xs text-gold-700 sm:col-span-2">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t.cash.pendingNote}
              </p>
            )}
            <Field label={dict.common.reference} htmlFor="pay-ref">
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
            </Field>
            <Field label={t.fields.proof}>
              <FileUpload bucket="documents" folder="payments" value={proof} onChange={setProof} />
            </Field>

            {docs && docs.length > 0 && (
              <div className="space-y-2 sm:col-span-2">
                <p className="text-[0.82rem] font-medium">{t.cash.allocate}</p>
                <ul className="divide-y rounded-lg border">
                  {docs.map((d) => (
                    <li key={d.doc_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{d.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t.fields.outstanding}: {fmtMoney(d.outstanding, locale)}
                        </span>
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        max={d.outstanding}
                        value={alloc[d.doc_id] ?? ""}
                        onChange={(e) => setAlloc((a) => ({ ...a, [d.doc_id]: e.target.value }))}
                        className="h-8 w-28 tabular-nums"
                        aria-label={`${t.payments.allocations} ${d.label}`}
                      />
                    </li>
                  ))}
                </ul>
                {allocTotal > Number(amount || 0) && <p className="text-xs text-destructive">{t.payments.allocations} &gt; {t.payments.amount}</p>}
              </div>
            )}
            {canAuto && !docs?.length && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox checked={auto} onCheckedChange={(v) => setAuto(Boolean(v))} />
                {t.cash.autoAllocate}
              </label>
            )}
            <Field label={dict.common.notes} htmlFor="pay-notes" className="sm:col-span-2">
              <Textarea id="pay-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {dict.common.cancel}
          </Button>
          <Button onClick={submit} disabled={pending || !opts || !partyId || !(Number(amount) > 0) || allocTotal > Number(amount || 0) || (partyType === "investor" && !investmentId)}>
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
