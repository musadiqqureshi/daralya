"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { EntitySelect, type Option } from "@/components/erp/entity-select";
import { Field, nativeSelect } from "@/components/erp/field";
import { FileUpload } from "@/components/erp/file-upload";
import { LineEditor } from "@/components/erp/line-editor";
import { Money } from "@/components/erp/money";
import { Section } from "@/components/erp/section";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { fmtMoney, todayRiyadh } from "@/lib/i18n/format";
import { createPurchase } from "./actions";

type Line = { product_id: string | null; qty: string; unit_price: string; expiry_date: string };
type Named = { id: string; name_en: string; name_ar: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function PurchaseEditor({
  suppliers,
  products,
  storages,
  accounts,
  methods,
  defaultSupplier,
  canPay,
}: {
  suppliers: Option[];
  products: (Option & { unit: string; cost: number })[];
  storages: Named[];
  accounts: (Named & { kind: "cash" | "bank" })[];
  methods: (Named & { requires_verification: boolean })[];
  defaultSupplier?: string;
  canPay: boolean;
}) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const router = useRouter();
  const name = (r: Named) => (locale === "ar" ? r.name_ar : r.name_en);
  const [supplier, setSupplier] = useState<string | null>(defaultSupplier ?? null);
  const [date, setDate] = useState(todayRiyadh());
  const [ref, setRef] = useState("");
  const [storage, setStorage] = useState(storages[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([{ product_id: null, qty: "", unit_price: "", expiry_date: "" }]);
  const [transport, setTransport] = useState("");
  const [loading, setLoading] = useState("");
  const [other, setOther] = useState("");
  const [extrasFrom, setExtrasFrom] = useState("");
  const [vat, setVat] = useState("");
  const [notes, setNotes] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState(methods[0]?.id ?? "");
  const [payAccount, setPayAccount] = useState(accounts.find((a) => a.kind === "cash")?.id ?? accounts[0]?.id ?? "");
  const [payRef, setPayRef] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const { run, pending, error } = useServerAction();

  const subtotal = useMemo(() => lines.reduce((s, l) => s + r2((Number(l.qty) || 0) * (Number(l.unit_price) || 0)), 0), [lines]);
  const extras = (Number(transport) || 0) + (Number(loading) || 0) + (Number(other) || 0);
  const total = subtotal + (Number(vat) || 0) + (extrasFrom ? 0 : extras);
  const landed = (l: Line) => {
    const lt = r2((Number(l.qty) || 0) * (Number(l.unit_price) || 0));
    return subtotal > 0 && Number(l.qty) > 0 ? (lt + (extras * lt) / subtotal) / Number(l.qty) : Number(l.unit_price) || 0;
  };
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid = supplier && storage && lines.every((l) => l.product_id && Number(l.qty) > 0 && Number(l.unit_price) >= 0 && l.unit_price !== "");

  const submit = () =>
    run(
      () =>
        createPurchase({
          supplier_id: supplier!,
          date,
          supplier_invoice_no: ref,
          storage_id: storage,
          notes,
          transport_cost: transport || 0,
          loading_cost: loading || 0,
          other_cost: other || 0,
          extras_paid_from: extrasFrom || null,
          vat_amount: vat || 0,
          lines: lines.map((l) => ({ product_id: l.product_id!, qty: l.qty, unit_price: l.unit_price, expiry_date: l.expiry_date || null })),
          payment: Number(payAmount) > 0 ? { amount: payAmount, method_id: payMethod, money_account_id: payAccount, reference: payRef, proof_path: proof } : null,
        }),
      { success: t.purchases.posted, onSuccess: (id) => id && router.push(`/erp/purchases/${id}`) },
    );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.fields.supplier} required className="sm:col-span-2">
              <EntitySelect options={suppliers} value={supplier} onChange={setSupplier} />
            </Field>
            <Field label={dict.common.date} htmlFor="pu-date" required>
              <Input id="pu-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t.fields.supplierInvoiceNo} htmlFor="pu-ref">
              <Input id="pu-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
            </Field>
            <Field label={t.fields.storage} htmlFor="pu-storage" required className="sm:col-span-2">
              <select id="pu-storage" className={nativeSelect} value={storage} onChange={(e) => setStorage(e.target.value)}>
                {storages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {name(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title={t.fields.lines}>
          <LineEditor
            lines={lines}
            onAdd={() => setLines((ls) => [...ls, { product_id: null, qty: "", unit_price: "", expiry_date: "" }])}
            onRemove={(i) => setLines((ls) => ls.filter((_, j) => j !== i))}
            addLabel={t.purchases.addLine}
            headers={[
              { label: t.fields.product, className: "min-w-56" },
              { label: dict.common.qty, className: "w-28" },
              { label: dict.common.unitPrice, className: "w-32" },
              { label: t.fields.expiry, className: "w-40" },
              { label: t.fields.landedCost, className: "w-28 text-end" },
              { label: dict.common.total, className: "w-28 text-end" },
            ]}
            renderCells={(l, i) => [
              <EntitySelect
                key="p"
                options={products}
                value={l.product_id}
                onChange={(id) => {
                  const p = products.find((x) => x.value === id);
                  setLine(i, { product_id: id, unit_price: l.unit_price || (p?.cost ? String(p.cost) : "") });
                }}
              />,
              <Input key="q" type="number" min="0" step="0.001" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className="tabular-nums" aria-label={dict.common.qty} />,
              <Input key="u" type="number" min="0" step="0.01" inputMode="decimal" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} className="tabular-nums" aria-label={dict.common.unitPrice} />,
              <Input key="e" type="date" value={l.expiry_date} onChange={(e) => setLine(i, { expiry_date: e.target.value })} aria-label={t.fields.expiry} />,
              <p key="l" className="py-2 text-end text-muted-foreground"><Money value={landed(l)} currency={false} /></p>,
              <p key="t" className="py-2 text-end font-semibold"><Money value={r2((Number(l.qty) || 0) * (Number(l.unit_price) || 0))} currency={false} /></p>,
            ]}
          />
        </Section>

        <Section title={t.purchases.extras} description={t.purchases.extrasHint}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.fields.transport} htmlFor="pu-tr">
              <Input id="pu-tr" type="number" min="0" step="0.01" value={transport} onChange={(e) => setTransport(e.target.value)} />
            </Field>
            <Field label={t.fields.loading} htmlFor="pu-lo">
              <Input id="pu-lo" type="number" min="0" step="0.01" value={loading} onChange={(e) => setLoading(e.target.value)} />
            </Field>
            <Field label={t.fields.otherCost} htmlFor="pu-ot">
              <Input id="pu-ot" type="number" min="0" step="0.01" value={other} onChange={(e) => setOther(e.target.value)} />
            </Field>
            <Field label={t.fields.extrasPaidFrom} htmlFor="pu-ef">
              <select id="pu-ef" className={nativeSelect} value={extrasFrom} onChange={(e) => setExtrasFrom(e.target.value)}>
                <option value="">{t.fields.extrasOnBill}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {name(a)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.fields.vatAmount} htmlFor="pu-vat">
              <Input id="pu-vat" type="number" min="0" step="0.01" value={vat} onChange={(e) => setVat(e.target.value)} />
            </Field>
            <Field label={dict.common.notes} htmlFor="pu-notes" className="sm:col-span-2 lg:col-span-3">
              <Textarea id="pu-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Section>
      </div>

      <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <Section title={dict.common.total}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{dict.common.subtotal}</dt><dd><Money value={subtotal} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t.purchases.extras}</dt><dd><Money value={extras} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{dict.common.vat}</dt><dd><Money value={Number(vat) || 0} /></dd></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>{t.fields.due}</dt><dd><Money value={total} /></dd></div>
          </dl>
        </Section>
        {canPay && (
          <Section title={t.purchases.paymentNow} description={t.purchases.paymentNowHint}>
            <div className="space-y-3">
              <Field label={dict.common.amount} htmlFor="pu-pay">
                <Input id="pu-pay" type="number" min="0" step="0.01" max={total} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={fmtMoney(0, locale, { currency: false })} />
              </Field>
              {Number(payAmount) > 0 && (
                <>
                  <Field label={t.fields.method} htmlFor="pu-pm">
                    <select id="pu-pm" className={nativeSelect} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {methods.map((m) => (
                        <option key={m.id} value={m.id}>{name(m)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t.fields.account} htmlFor="pu-pa">
                    <select id="pu-pa" className={nativeSelect} value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{name(a)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={dict.common.reference} htmlFor="pu-pr">
                    <Input id="pu-pr" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                  </Field>
                  <FileUpload bucket="documents" folder="payments" value={proof} onChange={setProof} />
                </>
              )}
            </div>
          </Section>
        )}
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button className="h-11 w-full" disabled={!valid || pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          {t.purchases.post}
        </Button>
      </div>
    </div>
  );
}
