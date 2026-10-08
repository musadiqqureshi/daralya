"use client";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { EntitySelect, type Option } from "@/components/erp/entity-select";
import { Field, nativeSelect } from "@/components/erp/field";
import { LineEditor } from "@/components/erp/line-editor";
import { Money } from "@/components/erp/money";
import { Section } from "@/components/erp/section";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/dictionaries/en";
import { fmtNumber, todayRiyadh } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { createSale } from "./actions";

export type SaleProduct = Option & { barcode: string | null; sku: string; unit: string; weight_kg: number; price: number };
type Named = { id: string; name_en: string; name_ar: string };
type Line = { product_id: string | null; qty: string; unit_price: string; discount: string };
const blank: Line = { product_id: null, qty: "1", unit_price: "", discount: "" };
const r2 = (n: number) => Math.round(n * 100) / 100;

export function SaleEditor({
  customers,
  products,
  storages,
  drivers,
  accounts,
  methods,
  stock,
  vat,
  defaultCustomer,
  canCollect,
  canOverridePrice,
  canDeliver,
}: {
  customers: (Option & { driver_id: string | null; address: string | null; balance: number; credit_limit: number | null })[];
  products: SaleProduct[];
  storages: Named[];
  drivers: (Option & { commission: string })[];
  accounts: (Named & { kind: "cash" | "bank" })[];
  methods: (Named & { requires_verification: boolean })[];
  stock: Record<string, Record<string, number>>;
  vat: { enabled: boolean; rate: number };
  defaultCustomer?: string;
  canCollect: boolean;
  canOverridePrice: boolean;
  canDeliver: boolean;
}) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const router = useRouter();
  const name = (r: Named) => (locale === "ar" ? r.name_ar : r.name_en);
  const initialCustomer = customers.find((c) => c.value === defaultCustomer) ?? null;
  const [customer, setCustomer] = useState<string | null>(initialCustomer?.value ?? null);
  const [storage, setStorage] = useState(storages[0]?.id ?? "");
  const [driver, setDriver] = useState<string | null>(initialCustomer?.driver_id ?? null);
  const [date, setDate] = useState(todayRiyadh());
  const [lines, setLines] = useState<Line[]>([{ ...blank }]);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [collect, setCollect] = useState(canCollect);
  const [payAmount, setPayAmount] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState(methods[0]?.id ?? "");
  const [payAccount, setPayAccount] = useState(accounts.find((a) => a.kind === "cash")?.id ?? accounts[0]?.id ?? "");
  const [payRef, setPayRef] = useState("");
  const [deliver, setDeliver] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(todayRiyadh());
  const [address, setAddress] = useState(initialCustomer?.address ?? "");
  const [scan, setScan] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const { run, pending, error } = useServerAction();

  const productById = useMemo(() => new Map(products.map((p) => [p.value, p])), [products]);
  const cust = customers.find((c) => c.value === customer);
  const avail = (pid: string | null) => (pid ? stock[pid]?.[storage] ?? 0 : 0);
  const lineTotal = (l: Line) => r2((Number(l.qty) || 0) * (Number(l.unit_price) || 0)) - (Number(l.discount) || 0);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const taxable = Math.max(subtotal - (Number(discount) || 0), 0);
  const vatAmt = vat.enabled ? r2((taxable * vat.rate) / 100) : 0;
  const total = r2(taxable + vatAmt);
  const kg = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (productById.get(l.product_id ?? "")?.weight_kg ?? 0), 0);
  const pay = payAmount === null ? total : Number(payAmount) || 0;
  const overCredit = cust?.credit_limit != null && cust.balance + total - (collect ? pay : 0) > cust.credit_limit;

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const addProduct = useCallback(
    (p: SaleProduct) => {
      setLines((ls) => {
        const existing = ls.findIndex((l) => l.product_id === p.value);
        if (existing >= 0) return ls.map((l, j) => (j === existing ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l));
        const empty = ls.findIndex((l) => !l.product_id);
        const line = { ...blank, product_id: p.value, unit_price: String(p.price) };
        return empty >= 0 ? ls.map((l, j) => (j === empty ? line : l)) : [...ls, line];
      });
    },
    [],
  );

  const onCode = useCallback(
    (code: string) => {
      const c = code.trim();
      const p = products.find((x) => x.barcode === c || x.sku.toLowerCase() === c.toLowerCase());
      if (p) {
        addProduct(p);
        toast.success(p.label);
      } else toast.error(`${dict.common.noResults}: ${c}`);
    },
    [products, addProduct, dict.common.noResults],
  );

  const valid = customer && storage && lines.every((l) => l.product_id && Number(l.qty) > 0 && l.unit_price !== "");

  const submit = () =>
    run(
      () =>
        createSale({
          customer_id: customer!,
          storage_id: storage,
          driver_id: driver,
          date,
          notes,
          discount_amount: discount || 0,
          lines: lines.map((l) => ({ product_id: l.product_id!, qty: l.qty, unit_price: l.unit_price, discount_amount: l.discount || 0 })),
          payment: collect && pay > 0 ? { amount: Math.min(pay, total), method_id: payMethod, money_account_id: payAccount, reference: payRef } : null,
          delivery: deliver ? { scheduled_date: deliveryDate, address, notes: null } : null,
        }),
      { success: t.sales.posted, onSuccess: (id) => id && router.push(`/erp/sales/${id}`) },
    );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.fields.customer} required className="sm:col-span-2">
              <EntitySelect
                options={customers}
                value={customer}
                onChange={(id) => {
                  setCustomer(id);
                  const c = customers.find((x) => x.value === id);
                  if (c?.driver_id) setDriver(c.driver_id);
                  if (c?.address) setAddress(c.address);
                }}
              />
            </Field>
            <Field label={dict.common.date} htmlFor="sa-date" required>
              <Input id="sa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t.fields.storage} htmlFor="sa-storage" required>
              <select id="sa-storage" className={nativeSelect} value={storage} onChange={(e) => setStorage(e.target.value)}>
                {storages.map((s) => (
                  <option key={s.id} value={s.id}>{name(s)}</option>
                ))}
              </select>
            </Field>
            <Field label={t.fields.driver} className="sm:col-span-2">
              <EntitySelect options={drivers} value={driver} onChange={setDriver} clearable placeholder={dict.common.none} />
            </Field>
            {cust && (
              <div className="flex items-end gap-4 text-sm sm:col-span-2">
                <p>
                  <span className="text-muted-foreground">{dict.common.balance}: </span>
                  <Money value={cust.balance} className="font-semibold" signed />
                </p>
                {cust.credit_limit != null && (
                  <p>
                    <span className="text-muted-foreground">{t.fields.creditLimit}: </span>
                    <Money value={cust.credit_limit} />
                  </p>
                )}
              </div>
            )}
          </div>
        </Section>

        <Section
          title={t.fields.lines}
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <ScanBarcode className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  ref={scanRef}
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (scan.trim()) onCode(scan);
                      setScan("");
                    }
                  }}
                  placeholder={t.fields.barcode}
                  className="h-8 w-40 ps-8 text-xs"
                  aria-label={t.fields.barcode}
                />
              </div>
              <BarcodeScanner onScan={onCode} />
            </div>
          }
        >
          <LineEditor
            lines={lines}
            onAdd={() => setLines((ls) => [...ls, { ...blank }])}
            onRemove={(i) => setLines((ls) => ls.filter((_, j) => j !== i))}
            addLabel={t.sales.addLine}
            headers={[
              { label: t.fields.product, className: "min-w-56" },
              { label: dict.common.qty, className: "w-28" },
              { label: dict.common.unitPrice, className: "w-32" },
              { label: dict.common.discount, className: "w-28" },
              { label: dict.common.total, className: "w-28 text-end" },
            ]}
            renderCells={(l, i) => {
              const p = l.product_id ? productById.get(l.product_id) : null;
              const a = avail(l.product_id);
              const short = p && Number(l.qty) > a;
              const below = p && Number(l.unit_price) < p.price;
              return [
                <div key="p">
                  <EntitySelect
                    options={products}
                    value={l.product_id}
                    onChange={(id) => {
                      const np = id ? productById.get(id) : null;
                      setLine(i, { product_id: id, unit_price: np ? String(np.price) : "" });
                    }}
                  />
                  {p && (
                    <p className={cn("mt-1 text-xs", short ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {tpl(t.sales.available, { qty: fmtNumber(a, locale, 3) })} · {t.units[p.unit as keyof typeof t.units]}
                    </p>
                  )}
                </div>,
                <Input key="q" type="number" min="0" step="0.001" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className={cn("tabular-nums", short && "border-destructive")} aria-label={dict.common.qty} />,
                <div key="u">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={l.unit_price}
                    onChange={(e) => setLine(i, { unit_price: e.target.value })}
                    readOnly={!canOverridePrice}
                    className={cn("tabular-nums", below && "border-warning")}
                    aria-label={dict.common.unitPrice}
                  />
                  {below && <p className="mt-1 text-[0.7rem] text-warning">{t.sales.priceBelowList}</p>}
                </div>,
                <Input key="d" type="number" min="0" step="0.01" inputMode="decimal" value={l.discount} onChange={(e) => setLine(i, { discount: e.target.value })} className="tabular-nums" aria-label={dict.common.discount} />,
                <p key="t" className="py-2 text-end font-semibold"><Money value={lineTotal(l)} currency={false} /></p>,
              ];
            }}
          />
        </Section>

        <Section>
          <div className="grid gap-4 sm:grid-cols-2">
            {canDeliver && (
              <div className="space-y-3 sm:col-span-2">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <Switch checked={deliver} onCheckedChange={setDeliver} />
                  {t.sales.createDelivery}
                </label>
                {deliver && (
                  <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                    <Field label={t.sales.deliveryDate} htmlFor="sa-dd">
                      <Input id="sa-dd" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                    </Field>
                    <Field label={t.sales.deliveryAddress} htmlFor="sa-addr">
                      <Input id="sa-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
            )}
            <Field label={dict.common.notes} htmlFor="sa-notes" className="sm:col-span-2">
              <Textarea id="sa-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Section>
      </div>

      <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <Section title={dict.common.total}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{dict.common.subtotal}</dt><dd><Money value={subtotal} /></dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.sales.invoiceDiscount}</dt>
              <dd><Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 w-28 text-end tabular-nums" aria-label={t.sales.invoiceDiscount} /></dd>
            </div>
            {vat.enabled && <div className="flex justify-between"><dt className="text-muted-foreground">{dict.common.vat} ({vat.rate}%)</dt><dd><Money value={vatAmt} /></dd></div>}
            <div className="flex justify-between border-t pt-2 text-lg font-semibold"><dt>{dict.common.total}</dt><dd><Money value={total} /></dd></div>
            <div className="flex justify-between text-xs text-muted-foreground"><dt>{t.fields.kgTotal}</dt><dd className="tabular-nums">{fmtNumber(kg, locale, 2)} {dict.common.kg}</dd></div>
          </dl>
        </Section>
        {canCollect && (
          <Section>
            <label className="flex items-center gap-3 text-sm font-medium">
              <Switch checked={collect} onCheckedChange={setCollect} />
              {t.sales.collectNow}
            </label>
            {collect ? (
              <div className="mt-4 space-y-3">
                <Field label={dict.common.amount} htmlFor="sa-pay">
                  <Input id="sa-pay" type="number" min="0" step="0.01" max={total} value={payAmount ?? String(total)} onChange={(e) => setPayAmount(e.target.value)} className="tabular-nums" />
                </Field>
                <Field label={t.fields.method} htmlFor="sa-pm">
                  <select id="sa-pm" className={nativeSelect} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>{name(m)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t.fields.account} htmlFor="sa-pa">
                  <select id="sa-pa" className={nativeSelect} value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{name(a)}</option>
                    ))}
                  </select>
                </Field>
                {methods.find((m) => m.id === payMethod)?.requires_verification && <p className="text-xs text-gold-700">{t.cash.pendingNote}</p>}
                <Field label={dict.common.reference} htmlFor="sa-pr">
                  <Input id="sa-pr" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                </Field>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">{t.sales.creditWarning}</p>
            )}
          </Section>
        )}
        {overCredit && (
          <p className="flex gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {t.fields.creditLimit}: <Money value={cust!.credit_limit} />
          </p>
        )}
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button className="h-11 w-full text-base" disabled={!valid || pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          {t.sales.post}
        </Button>
      </div>
    </div>
  );
}
