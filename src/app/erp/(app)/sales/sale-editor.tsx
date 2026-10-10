"use client";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Plus, RefreshCw, ScanBarcode } from "lucide-react";
import { saveParty } from "@/app/erp/(app)/_actions/parties";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { CURRENCIES, CURRENCY_INFO, fmtCurrency, type Currency } from "@/lib/erp/currency";
import { createSale, refreshRatesAction } from "./actions";

export type SaleProduct = Option & { barcode: string | null; sku: string; unit: string; weight_kg: number; price: number };
type Named = { id: string; name_en: string; name_ar: string };
type Line = { product_id: string | null; qty: string; unit_price: string; discount: string };
const blank: Line = { product_id: null, qty: "1", unit_price: "", discount: "" };
const r2 = (n: number) => Math.round(n * 100) / 100;

export function SaleEditor({
  customers: initialCustomers,
  products,
  storages,
  drivers,
  accounts,
  methods,
  stock,
  vat,
  rates: initialRates,
  ratesAt: initialRatesAt,
  defaultCustomer,
  canCollect,
  canOverridePrice,
  canDeliver,
  simple = false,
  canAddCustomer = false,
}: {
  customers: (Option & { driver_id: string | null; address: string | null; balance: number; credit_limit: number | null; email: string | null })[];
  products: SaleProduct[];
  storages: Named[];
  drivers: (Option & { commission: string })[];
  accounts: (Named & { kind: "cash" | "bank" })[];
  methods: (Named & { requires_verification: boolean })[];
  stock: Record<string, Record<string, number>>;
  vat: { enabled: boolean; rate: number };
  rates: Partial<Record<Currency, number>>;
  ratesAt: string | null;
  defaultCustomer?: string;
  canCollect: boolean;
  canOverridePrice: boolean;
  canDeliver: boolean;
  /** salesman mode: big scanner first, only the essentials */
  simple?: boolean;
  canAddCustomer?: boolean;
}) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const router = useRouter();
  const name = (r: Named) => (locale === "ar" ? r.name_ar : r.name_en);
  const [customers, setCustomers] = useState(initialCustomers);
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
  const [currency, setCurrency] = useState<Currency>("SAR");
  const [rates, setRates] = useState(initialRates);
  const [ratesAt, setRatesAt] = useState(initialRatesAt);
  const [refreshing, setRefreshing] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const { run, pending, error } = useServerAction();

  const productById = useMemo(() => new Map(products.map((p) => [p.value, p])), [products]);
  const rate = currency === "SAR" ? 1 : rates[currency] ?? 0;
  const r2c = (sar: number) => (rate ? Math.round((sar / rate) * 100) / 100 : 0);
  const changeCurrency = (next: Currency) => {
    const nextRate = next === "SAR" ? 1 : rates[next] ?? 0;
    if (!nextRate) return;
    // keep the agreed prices' value when switching currency
    setLines((ls) => ls.map((l) => (l.unit_price === "" ? l : { ...l, unit_price: String(Math.round(((Number(l.unit_price) * rate) / nextRate) * 100) / 100) })));
    setCurrency(next);
  };
  const cust = customers.find((c) => c.value === customer);
  const avail = (pid: string | null) => (pid ? stock[pid]?.[storage] ?? 0 : 0);
  const lineTotal = (l: Line) => r2((Number(l.qty) || 0) * (Number(l.unit_price) || 0)) - (Number(l.discount) || 0);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const taxable = Math.max(subtotal - (Number(discount) || 0), 0);
  const vatAmt = vat.enabled ? r2((taxable * vat.rate) / 100) : 0;
  const total = r2(taxable + vatAmt);
  // mirror the database conversion exactly: each price/discount converted and rounded, then totals
  const subtotalSar = lines.reduce((s, l) => s + r2((Number(l.qty) || 0) * r2((Number(l.unit_price) || 0) * rate)) - r2((Number(l.discount) || 0) * rate), 0);
  const taxableSar = Math.max(subtotalSar - r2((Number(discount) || 0) * rate), 0);
  const totalSar = r2(taxableSar + (vat.enabled ? r2((taxableSar * vat.rate) / 100) : 0));
  const kg = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (productById.get(l.product_id ?? "")?.weight_kg ?? 0), 0);
  const pay = payAmount === null ? totalSar : Number(payAmount) || 0;
  const overCredit = cust?.credit_limit != null && cust.balance + totalSar - (collect ? pay : 0) > cust.credit_limit;

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const addProduct = useCallback(
    (p: SaleProduct) => {
      setLines((ls) => {
        const existing = ls.findIndex((l) => l.product_id === p.value);
        if (existing >= 0) return ls.map((l, j) => (j === existing ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l));
        const empty = ls.findIndex((l) => !l.product_id);
        const line = { ...blank, product_id: p.value, unit_price: String(r2c(p.price)) };
        return empty >= 0 ? ls.map((l, j) => (j === empty ? line : l)) : [...ls, line];
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rate],
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

  const valid = customer && storage && rate > 0 && lines.every((l) => l.product_id && Number(l.qty) > 0 && l.unit_price !== "");

  const submit = () =>
    run(
      () =>
        createSale({
          customer_id: customer!,
          currency,
          customer_email: cust && !cust.email ? customerEmail : "",
          storage_id: storage,
          driver_id: driver,
          date,
          notes,
          discount_amount: discount || 0,
          lines: lines.map((l) => ({ product_id: l.product_id!, qty: l.qty, unit_price: l.unit_price, discount_amount: l.discount || 0 })),
          payment: collect && pay > 0 ? { amount: Math.min(pay, totalSar), method_id: payMethod, money_account_id: payAccount, reference: payRef } : null,
          delivery: deliver ? { scheduled_date: deliveryDate, address, notes: null } : null,
        }),
      { success: t.sales.posted, onSuccess: (id) => id && router.push(simple ? `/erp/pos?last=${id}` : `/erp/sales/${id}`) },
    );

  const scanBox = (big: boolean) => (
    <div className={big ? "relative flex-1" : "relative"}>
      <ScanBarcode className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground ${big ? "start-4 size-6" : "start-2.5 size-4"}`} aria-hidden />
      <Input
        ref={scanRef}
        autoFocus={big}
        value={scan}
        onChange={(e) => setScan(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (scan.trim()) onCode(scan);
            setScan("");
          }
        }}
        placeholder={big ? t.pos.scanHere : t.fields.barcode}
        className={big ? "h-14 border-2 ps-13 text-lg" : "h-8 w-40 ps-8 text-xs"}
        aria-label={t.fields.barcode}
      />
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {simple && (
          <section className="rounded-2xl border-2 border-gold-500/60 bg-card p-4 shadow-sm sm:p-5">
            <ol className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {[t.pos.step1, t.pos.step2, t.pos.step3].map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-palm-800 text-[0.7rem] font-bold text-cream">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              {scanBox(true)}
              <BarcodeScanner onScan={onCode} className="h-14 px-5 text-base" />
            </div>
          </section>
        )}
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.fields.customer} required className="sm:col-span-2">
              <div className="flex gap-2">
                <EntitySelect
                  className={simple ? "h-11 text-base" : undefined}
                  options={customers}
                  value={customer}
                  onChange={(id) => {
                    setCustomer(id);
                    const c = customers.find((x) => x.value === id);
                    if (c?.driver_id) setDriver(c.driver_id);
                    if (c?.address) setAddress(c.address);
                  }}
                />
                {canAddCustomer && (
                  <QuickCustomer
                    big={simple}
                    onCreated={(c) => {
                      setCustomers((xs) => [...xs, c]);
                      setCustomer(c.value);
                      setCustomerEmail("");
                    }}
                  />
                )}
              </div>
            </Field>
            {!simple && (
              <Field label={dict.common.date} htmlFor="sa-date" required>
                <Input id="sa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            )}
            <Field label={t.fields.storage} htmlFor="sa-storage" required>
              <select id="sa-storage" className={nativeSelect} value={storage} onChange={(e) => setStorage(e.target.value)}>
                {storages.map((s) => (
                  <option key={s.id} value={s.id}>{name(s)}</option>
                ))}
              </select>
            </Field>
            {!simple && (
              <Field label={t.fields.driver} className="sm:col-span-2">
                <EntitySelect options={drivers} value={driver} onChange={setDriver} clearable placeholder={dict.common.none} />
              </Field>
            )}
            <Field label={t.sales.currency} htmlFor="sa-cur">
              <select id="sa-cur" className={nativeSelect} value={currency} onChange={(e) => changeCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} disabled={c !== "SAR" && !rates[c]}>
                    {c} · {CURRENCY_INFO[c][locale]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end gap-2 text-sm">
              {currency !== "SAR" && (
                <p className="pb-2">
                  <span className="text-muted-foreground">{t.sales.rate}: </span>
                  <span className="font-semibold tabular-nums" dir="ltr">1 {currency} = {rate.toFixed(4)} SAR</span>
                </p>
              )}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="mb-1"
                disabled={refreshing}
                aria-label={t.sales.refreshRates}
                title={ratesAt ? `${t.sales.refreshRates} · ${new Date(ratesAt).toLocaleTimeString()}` : t.sales.refreshRates}
                onClick={async () => {
                  setRefreshing(true);
                  const r = await refreshRatesAction();
                  setRates(r.rates);
                  setRatesAt(r.fetchedAt);
                  setRefreshing(false);
                  toast.success(t.sales.ratesUpdated);
                }}
              >
                <RefreshCw className={refreshing ? "animate-spin" : ""} />
              </Button>
            </div>
            {cust && !cust.email && (
              <Field label={t.sales.customerEmail} htmlFor="sa-email" className="sm:col-span-2">
                <Input id="sa-email" type="email" dir="ltr" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="name@example.com" />
              </Field>
            )}
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
            !simple && (
              <div className="flex items-center gap-2">
                {scanBox(false)}
                <BarcodeScanner onScan={onCode} />
              </div>
            )
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
              { label: `${dict.common.unitPrice} (${currency})`, className: "w-32" },
              { label: `${dict.common.discount} (${currency})`, className: "w-28" },
              { label: `${dict.common.total} (${currency})`, className: "w-28 text-end" },
            ]}
            renderCells={(l, i) => {
              const p = l.product_id ? productById.get(l.product_id) : null;
              const a = avail(l.product_id);
              const short = p && Number(l.qty) > a;
              const below = p && Number(l.unit_price) * rate < p.price - 0.005;
              return [
                <div key="p">
                  <EntitySelect
                    options={products}
                    value={l.product_id}
                    onChange={(id) => {
                      const np = id ? productById.get(id) : null;
                      setLine(i, { product_id: id, unit_price: np ? String(r2c(np.price)) : "" });
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
            {canDeliver && !simple && (
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
{!simple && (
            <Field label={dict.common.notes} htmlFor="sa-notes" className="sm:col-span-2">
              <Textarea id="sa-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            )}
          </div>
        </Section>
      </div>

      <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <Section title={dict.common.total}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{dict.common.subtotal}</dt><dd className="tabular-nums" dir="ltr">{currency === "SAR" ? <Money value={subtotal} /> : fmtCurrency(subtotal, currency, locale)}</dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.sales.invoiceDiscount}</dt>
              <dd><Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 w-28 text-end tabular-nums" aria-label={t.sales.invoiceDiscount} /></dd>
            </div>
            {vat.enabled && <div className="flex justify-between"><dt className="text-muted-foreground">{dict.common.vat} ({vat.rate}%)</dt><dd><Money value={vatAmt} /></dd></div>}
            <div className="flex justify-between border-t pt-2 text-lg font-semibold">
              <dt>{dict.common.total}</dt>
              <dd className="tabular-nums" dir="ltr">{currency === "SAR" ? <Money value={total} /> : fmtCurrency(total, currency, locale)}</dd>
            </div>
            {currency !== "SAR" && (
              <div className="flex justify-between rounded-lg bg-palm-50 px-2 py-1.5 font-semibold text-palm-800">
                <dt>{t.sales.sarEquivalent}</dt>
                <dd><Money value={totalSar} /></dd>
              </div>
            )}
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
                <Field label={`${dict.common.amount} (SAR)`} htmlFor="sa-pay">
                  <Input id="sa-pay" type="number" min="0" step="0.01" max={totalSar} value={payAmount ?? String(totalSar)} onChange={(e) => setPayAmount(e.target.value)} className="tabular-nums" />
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

export function QuickCustomer({ onCreated, big }: { onCreated: (c: Option & { driver_id: null; address: string | null; balance: number; credit_limit: null; email: string | null }) => void; big?: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.pos;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    const res = await saveParty("customer", { name, phone, email });
    setBusy(false);
    if (!res.ok || !res.data) return setErr(res.ok ? dict.common.error : res.error);
    toast.success(t.customerAdded);
    onCreated({ value: res.data, label: name, sub: phone || undefined, keywords: [phone, email], driver_id: null, address: null, balance: 0, credit_limit: null, email: email || null });
    setOpen(false);
    setName("");
    setPhone("");
    setEmail("");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={big ? "h-11 shrink-0" : "shrink-0"}>
          <Plus />
          {t.newCustomer}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.newCustomer}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={dict.common.name} htmlFor="qc-name" required><Input id="qc-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label={dict.common.phone} htmlFor="qc-phone"><Input id="qc-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label={dict.common.email} htmlFor="qc-email"><Input id="qc-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button disabled={busy || name.trim().length < 2} onClick={save}>
            {busy && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
