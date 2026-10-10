"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Minus, Plus, Printer, ScanBarcode, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { EntitySelect, type Option } from "@/components/erp/entity-select";
import { Field, nativeSelect } from "@/components/erp/field";
import { Money } from "@/components/erp/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/dictionaries/en";
import { fmtMoney, fmtNumber, todayRiyadh } from "@/lib/i18n/format";
import { CURRENCIES, fmtCurrency, type Currency } from "@/lib/erp/currency";
import { cn } from "@/lib/utils";
import { createSale } from "../sales/actions";
import { QuickCustomer } from "../sales/sale-editor";

export type PosProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  other: string;
  variety: string;
  grade: string | null;
  unit: string;
  weight_kg: number;
  retail: number;
  wholesale: number | null;
  stock: Record<string, number>;
  image: string | null;
};
type Named = { id: string; name_en: string; name_ar: string };
type Customer = Option & { email: string | null };
type Mode = "retail" | "wholesale" | "custom";
type Line = { id: string; qty: string; mode: Mode; custom: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const AUTOPRINT_KEY = "pos-autoprint";

/** Print the 80 mm slip through a hidden frame: no new tab, no extra click. */
function printSlip(id: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.src = `/print/invoice/${id}?format=receipt&autoprint=1`;
  const cleanup = () => {
    window.removeEventListener("message", onMsg);
    frame.remove();
  };
  const onMsg = (e: MessageEvent) => {
    if (e.origin === window.location.origin && e.source === frame.contentWindow && e.data?.type === "slip-printed") setTimeout(cleanup, 500);
  };
  window.addEventListener("message", onMsg);
  setTimeout(cleanup, 120_000);
  document.body.appendChild(frame);
}

export function PosScreen({
  products,
  customers: initialCustomers,
  defaultCustomer,
  storages,
  accounts,
  methods,
  vat,
  rates,
  totals: initialTotals,
  canCollect,
  canOverridePrice,
  canAddCustomer,
}: {
  products: PosProduct[];
  customers: Customer[];
  defaultCustomer: string | null;
  storages: Named[];
  accounts: (Named & { kind: "cash" | "bank" })[];
  methods: (Named & { requires_verification: boolean })[];
  vat: { enabled: boolean; rate: number };
  rates: Partial<Record<Currency, number>>;
  totals: { today: number; todayCount: number; month: number; monthCount: number };
  canCollect: boolean;
  canOverridePrice: boolean;
  canAddCustomer: boolean;
}) {
  const { dict, locale } = useI18n();
  const t = dict.erp.pos;
  const name = (r: Named) => (locale === "ar" ? r.name_ar : r.name_en);

  const [stock, setStock] = useState(() => Object.fromEntries(products.map((p) => [p.id, p.stock])));
  const [storage, setStorage] = useState(() => {
    // default to the storage holding the most stock
    const sums = storages.map((s) => [s.id, products.reduce((n, p) => n + (p.stock[s.id] ?? 0), 0)] as const);
    return sums.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  });
  const [query, setQuery] = useState("");
  const [variety, setVariety] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState(initialCustomers);
  const [customer, setCustomer] = useState<string | null>(defaultCustomer);
  const [customerEmail, setCustomerEmail] = useState("");
  const [currency, setCurrency] = useState<Currency>("SAR");
  const [paidNow, setPaidNow] = useState(canCollect);
  const [payMethod, setPayMethod] = useState(methods[0]?.id ?? "");
  const [payAccount, setPayAccount] = useState(accounts.find((a) => a.kind === "cash")?.id ?? accounts[0]?.id ?? "");
  const [autoPrint, setAutoPrint] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState(initialTotals);
  const [last, setLast] = useState<{ id: string; total: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- per-device preference, read after hydration
      if (localStorage.getItem(AUTOPRINT_KEY) === "0") setAutoPrint(false);
    } catch {}
  }, []);
  const toggleAutoPrint = (v: boolean) => {
    setAutoPrint(v);
    try {
      localStorage.setItem(AUTOPRINT_KEY, v ? "1" : "0");
    } catch {}
  };

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const varieties = useMemo(() => [...new Set(products.map((p) => p.variety))], [products]);
  const avail = useCallback((id: string) => stock[id]?.[storage] ?? 0, [stock, storage]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!variety || p.variety === variety) &&
        (!q || [p.name, p.other, p.sku, p.barcode ?? "", p.variety].some((s) => s.toLowerCase().includes(q))),
    );
  }, [products, query, variety]);

  // prices: lines keep retail/wholesale live and custom prices in the invoice currency
  const rate = currency === "SAR" ? 1 : rates[currency] ?? 0;
  const toCur = (sar: number) => (rate ? r2(sar / rate) : 0);
  const priceOf = (l: Line) => {
    const p = byId.get(l.id)!;
    if (l.mode === "custom") return Number(l.custom) || 0;
    return toCur(l.mode === "wholesale" && p.wholesale !== null ? p.wholesale : p.retail);
  };
  const qtyOf = (l: Line) => Number(l.qty) || 0;
  const subtotal = lines.reduce((s, l) => s + r2(qtyOf(l) * priceOf(l)), 0);
  const vatAmt = vat.enabled ? r2((subtotal * vat.rate) / 100) : 0;
  const total = r2(subtotal + vatAmt);
  // mirrors the database conversion (each price converted and rounded, then totals)
  const subtotalSar = lines.reduce((s, l) => s + r2(qtyOf(l) * r2(priceOf(l) * rate)), 0);
  const totalSar = r2(subtotalSar + (vat.enabled ? r2((subtotalSar * vat.rate) / 100) : 0));
  const count = lines.length;
  const money = (v: number) => (currency === "SAR" ? fmtMoney(v, locale) : fmtCurrency(v, currency, locale));

  const add = useCallback(
    (p: PosProduct) => {
      setLines((ls) => {
        const i = ls.findIndex((l) => l.id === p.id);
        if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: String(qtyOf(l) + 1) } : l));
        return [...ls, { id: p.id, qty: "1", mode: "retail", custom: "" }];
      });
    },
    [],
  );
  const setLine = (id: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.id !== id));
  const step = (l: Line, d: number) => setLine(l.id, { qty: String(Math.max(r2(qtyOf(l) + d), 0)) });
  const setMode = (l: Line, mode: Mode) => setLine(l.id, { mode, custom: mode === "custom" && !l.custom ? String(priceOf(l)) : l.custom });

  const byCode = (code: string) => {
    const c = code.trim().toLowerCase();
    return products.find((p) => p.barcode?.toLowerCase() === c || p.sku.toLowerCase() === c);
  };
  const onScan = (code: string) => {
    const p = byCode(code);
    if (p) {
      add(p);
      toast.success(p.name, { duration: 1200 });
    } else toast.error(`${dict.common.noResults}: ${code}`);
  };
  const onSearchEnter = () => {
    const q = query.trim();
    if (!q) {
      if (count) setOpen(true); // empty search + Enter = checkout
      return;
    }
    const p = byCode(q) ?? (shown.length === 1 ? shown[0] : null);
    if (p) {
      add(p);
      setQuery("");
    } else toast.error(`${dict.common.noResults}: ${q}`);
  };

  const changeCurrency = (next: Currency) => {
    const nextRate = next === "SAR" ? 1 : rates[next] ?? 0;
    if (!nextRate) return;
    setLines((ls) => ls.map((l) => (l.mode === "custom" && l.custom !== "" ? { ...l, custom: String(r2((Number(l.custom) * rate) / nextRate)) } : l)));
    setCurrency(next);
  };

  const cust = customers.find((c) => c.value === customer);
  const valid = Boolean(customer && storage && rate > 0 && count && lines.every((l) => qtyOf(l) > 0 && priceOf(l) >= 0 && (l.mode !== "custom" || l.custom !== "")));

  const complete = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createSale(
        {
          customer_id: customer!,
          currency,
          customer_email: cust && !cust.email ? customerEmail : "",
          storage_id: storage,
          date: todayRiyadh(),
          lines: lines.map((l) => ({ product_id: l.id, qty: qtyOf(l), unit_price: priceOf(l), discount_amount: 0 })),
          payment: canCollect && paidNow && totalSar > 0 ? { amount: totalSar, method_id: payMethod, money_account_id: payAccount, reference: null } : null,
        },
        { fast: true },
      );
      if (!res.ok || !res.data) {
        const msg = res.ok ? dict.common.error : res.error;
        setError(msg);
        toast.error(msg);
        return;
      }
      const id = res.data;
      if (autoPrint) printSlip(id);
      // update the screen locally instead of reloading the page
      setStock((s) => {
        const next = { ...s };
        for (const l of lines) next[l.id] = { ...next[l.id], [storage]: r2((next[l.id]?.[storage] ?? 0) - qtyOf(l)) };
        return next;
      });
      setTotals((x) => ({ today: x.today + totalSar, todayCount: x.todayCount + 1, month: x.month + totalSar, monthCount: x.monthCount + 1 }));
      setLast({ id, total: totalSar });
      toast.success(autoPrint ? `${dict.erp.sales.posted} · ${t.printing}` : dict.erp.sales.posted, {
        action: { label: t.reprint, onClick: () => printSlip(id) },
      });
      setLines([]);
      setCustomer(defaultCustomer);
      setCustomerEmail("");
      setCurrency("SAR");
      setOpen(false);
      setTimeout(() => searchRef.current?.focus(), 50);
    } catch (e) {
      const msg = (e as Error)?.message || dict.common.error;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // "/" jumps to search from anywhere on the screen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && !open) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const unitLabel = (u: string) => dict.erp.units[u as keyof typeof dict.erp.units] ?? u;

  return (
    <div className={cn("grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]", count > 0 && "pb-20 lg:pb-0")}>
      {/* ── products ─────────────────────────────── */}
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold text-palm-900">{t.title}</h1>
          <div className="flex gap-2 text-sm">
            <Stat label={t.today} value={fmtMoney(totals.today, locale)} n={totals.todayCount} />
            <Stat label={t.month} value={fmtMoney(totals.month, locale)} n={totals.monthCount} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1">
            <ScanBarcode className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSearchEnter();
                } else if (e.key === "Escape") setQuery("");
              }}
              placeholder={t.searchProducts}
              aria-label={t.searchProducts}
              className="h-12 ps-11 text-base"
            />
          </div>
          <BarcodeScanner onScan={onScan} className="h-12 flex-1 px-4 sm:flex-none" />
          {storages.length > 1 && (
            <select aria-label={dict.erp.fields.storage} className={cn(nativeSelect, "h-12 w-auto max-w-44 flex-1 sm:flex-none")} value={storage} onChange={(e) => setStorage(e.target.value)}>
              {storages.map((s) => (
                <option key={s.id} value={s.id}>{name(s)}</option>
              ))}
            </select>
          )}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={dict.erp.fields.variety}>
          {[null, ...varieties].map((v) => (
            <button
              key={v ?? "all"}
              type="button"
              role="tab"
              aria-selected={variety === v}
              onClick={() => setVariety(v)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                variety === v ? "border-palm-800 bg-palm-800 text-cream" : "bg-card text-foreground hover:border-palm-700/50",
              )}
            >
              {v ?? t.all}
            </button>
          ))}
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((p, i) => {
            const a = avail(p.id);
            const inCart = lines.find((l) => l.id === p.id);
            const out = a <= 0;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={out}
                  onClick={() => add(p)}
                  aria-pressed={Boolean(inCart)}
                  className={cn(
                    "group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-start shadow-xs transition",
                    "hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-0",
                    inCart && "border-palm-700 ring-2 ring-palm-700/70",
                    out && "cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-xs",
                  )}
                >
                  <div className="relative aspect-[4/3] w-full bg-palm-50">
                    {p.image ? (
                      <Image src={p.image} alt="" fill sizes="(min-width: 1280px) 15vw, (min-width: 640px) 28vw, 45vw" quality={60} priority={i < 8} className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground"><ShoppingBag className="size-8" /></div>
                    )}
                    {inCart && (
                      <span className="absolute end-2 top-2 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full bg-palm-800 px-2 text-xs font-bold text-cream shadow">
                        <Check className="size-3.5" />
                        {fmtNumber(qtyOf(inCart), locale, 2)}
                      </span>
                    )}
                    <span className={cn("absolute start-2 bottom-2 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold shadow-sm", out ? "bg-destructive text-white" : "bg-white/90 text-palm-900")}>
                      {out ? t.noStock : tpl(t.left, { qty: `${fmtNumber(a, locale, 1)} ${unitLabel(p.unit)}` })}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 p-3">
                    <p className="line-clamp-1 font-semibold leading-tight">{p.name}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{p.variety}{p.grade ? ` · ${p.grade}` : ""}</p>
                    <p className="mt-1 font-semibold tabular-nums text-palm-800" dir="ltr">
                      {fmtMoney(p.retail, locale)} <span className="text-xs font-normal text-muted-foreground">/ {unitLabel(p.unit)}</span>
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {!shown.length && <p className="py-10 text-center text-muted-foreground">{dict.common.noResults}</p>}
      </section>

      {/* ── cart ─────────────────────────────── */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex max-h-[calc(100dvh-6.5rem)] flex-col rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShoppingBag className="size-4" />
              {t.cart}
              {count > 0 && <span className="rounded-full bg-palm-800 px-2 text-xs text-cream">{count}</span>}
            </h2>
            {count > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setLines([])}>
                <Trash2 />
                {t.clear}
              </Button>
            )}
          </div>
          <div className="min-h-32 flex-1 overflow-y-auto">
            {!count ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">{t.emptyCart}</p>
            ) : (
              <ul className="divide-y">
                {lines.map((l) => {
                  const p = byId.get(l.id)!;
                  const short = qtyOf(l) > avail(l.id);
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className={cn("text-xs tabular-nums", short ? "font-semibold text-destructive" : "text-muted-foreground")} dir="ltr">
                          {money(priceOf(l))} × {fmtNumber(qtyOf(l), locale, 3)}
                        </p>
                      </div>
                      <Stepper value={l.qty} onChange={(v) => setLine(l.id, { qty: v })} onStep={(d) => step(l, d)} label={dict.common.qty} />
                      <button type="button" onClick={() => remove(l.id)} className="text-muted-foreground hover:text-destructive" aria-label={dict.common.remove}>
                        <X className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="space-y-3 border-t p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">{dict.common.total}</span>
              <span className="text-2xl font-semibold tabular-nums" dir="ltr">{money(total)}</span>
            </div>
            <Button className="h-12 w-full text-base" disabled={!count} onClick={() => setOpen(true)}>
              {t.checkout}
              <kbd className="ms-2 rounded border border-white/30 px-1.5 text-[0.7rem] font-normal opacity-80">Enter</kbd>
            </Button>
            {last && (
              <Button variant="outline" className="w-full" onClick={() => printSlip(last.id)}>
                <Printer />
                {t.reprint} · <span dir="ltr">{fmtMoney(last.total, locale)}</span>
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* phones/tablets: the cart sits below the grid, so keep checkout one tap away */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
          <Button className="h-12 w-full justify-between text-base" onClick={() => setOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingBag />
              {tpl(t.items, { n: String(count) })}
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums" dir="ltr">{money(total)}</span>· {t.checkout}
            </span>
          </Button>
        </div>
      )}

      {/* ── checkout ─────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent
          className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"
          onOpenAutoFocus={(e) => {
            // focus the complete button so a single Enter finishes the sale
            e.preventDefault();
            submitRef.current?.focus();
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void complete();
            }}
            onKeyDown={(e) => {
              // Enter completes the sale even when focus sits on a price/qty button or a select
              const el = e.target as HTMLElement;
              if (e.key !== "Enter" || !e.currentTarget.contains(el)) return;
              const isPlainButton = el.tagName === "BUTTON" && el.getAttribute("type") === "button" && !el.hasAttribute("aria-haspopup") && el.getAttribute("role") !== "combobox";
              if (isPlainButton || el.tagName === "SELECT") {
                e.preventDefault();
                void complete();
              }
            }}
            className="space-y-5"
          >
            <DialogHeader>
              <DialogTitle>{t.checkout}</DialogTitle>
              <DialogDescription>{t.enterHint}</DialogDescription>
            </DialogHeader>

            <ul className="divide-y rounded-xl border">
              {lines.map((l) => {
                const p = byId.get(l.id)!;
                return (
                  <li key={l.id} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <ModeButton active={l.mode === "retail"} onClick={() => setMode(l, "retail")}>
                          {t.retail} <span dir="ltr" className="tabular-nums">{toCur(p.retail).toFixed(2)}</span>
                        </ModeButton>
                        {p.wholesale !== null && (
                          <ModeButton active={l.mode === "wholesale"} onClick={() => setMode(l, "wholesale")}>
                            {t.wholesale} <span dir="ltr" className="tabular-nums">{toCur(p.wholesale).toFixed(2)}</span>
                          </ModeButton>
                        )}
                        {canOverridePrice && (
                          <ModeButton active={l.mode === "custom"} onClick={() => setMode(l, "custom")}>
                            {t.custom}
                          </ModeButton>
                        )}
                        {l.mode === "custom" && (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            autoFocus
                            value={l.custom}
                            onChange={(e) => setLine(l.id, { custom: e.target.value })}
                            className="h-8 w-28 tabular-nums"
                            aria-label={`${dict.common.unitPrice} (${currency})`}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <Stepper value={l.qty} onChange={(v) => setLine(l.id, { qty: v })} onStep={(d) => step(l, d)} label={dict.common.qty} big />
                      <p className="w-28 text-end font-semibold tabular-nums" dir="ltr">{money(r2(qtyOf(l) * priceOf(l)))}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dict.erp.fields.customer} required className="sm:col-span-2">
                <div className="flex gap-2">
                  <EntitySelect className="h-10" options={customers} value={customer} onChange={setCustomer} />
                  {canAddCustomer && (
                    <QuickCustomer
                      onCreated={(c) => {
                        setCustomers((xs) => [...xs, c]);
                        setCustomer(c.value);
                      }}
                    />
                  )}
                </div>
              </Field>
              {cust && !cust.email && (
                <Field label={dict.erp.sales.customerEmail} htmlFor="pos-email">
                  <Input id="pos-email" type="email" dir="ltr" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="name@example.com" />
                </Field>
              )}
              <Field label={dict.erp.sales.currency} htmlFor="pos-cur">
                <select id="pos-cur" className={nativeSelect} value={currency} onChange={(e) => changeCurrency(e.target.value as Currency)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c} disabled={c !== "SAR" && !rates[c]}>{c}</option>
                  ))}
                </select>
              </Field>
              {canCollect && (
                <div className="space-y-2 sm:col-span-2">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup">
                    <ModeButton big active={paidNow} onClick={() => setPaidNow(true)}>{t.paid}</ModeButton>
                    <ModeButton big active={!paidNow} onClick={() => setPaidNow(false)}>{t.onCredit}</ModeButton>
                  </div>
                  {paidNow && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select aria-label={dict.erp.fields.method} className={nativeSelect} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                        {methods.map((m) => (
                          <option key={m.id} value={m.id}>{name(m)}</option>
                        ))}
                      </select>
                      <select aria-label={dict.erp.fields.account} className={nativeSelect} value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{name(a)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <dl className="space-y-1.5 rounded-xl bg-palm-50/60 p-4 text-sm">
              {vat.enabled && (
                <>
                  <div className="flex justify-between"><dt className="text-muted-foreground">{dict.common.subtotal}</dt><dd className="tabular-nums" dir="ltr">{money(subtotal)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">{dict.common.vat} ({vat.rate}%)</dt><dd className="tabular-nums" dir="ltr">{money(vatAmt)}</dd></div>
                </>
              )}
              <div className="flex items-baseline justify-between text-lg font-semibold">
                <dt>{dict.common.total}</dt>
                <dd className="text-2xl tabular-nums" dir="ltr">{money(total)}</dd>
              </div>
              {currency !== "SAR" && (
                <div className="flex justify-between font-medium text-palm-800">
                  <dt>{dict.erp.sales.sarEquivalent}</dt>
                  <dd><Money value={totalSar} /></dd>
                </div>
              )}
            </dl>

            {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={autoPrint} onCheckedChange={(v) => toggleAutoPrint(v === true)} />
                {t.autoPrint}
              </label>
              <Button ref={submitRef} type="submit" className="h-12 px-8 text-base" disabled={!valid || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Printer />}
                {t.completeSale}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, n }: { label: string; value: string; n: number }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-1.5">
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums" dir="ltr">{value} <span className="text-xs font-normal text-muted-foreground">· {n}</span></p>
    </div>
  );
}

function Stepper({ value, onChange, onStep, label, big }: { value: string; onChange: (v: string) => void; onStep: (d: number) => void; label: string; big?: boolean }) {
  const btn = cn("flex shrink-0 items-center justify-center rounded-md border bg-background hover:bg-muted", big ? "size-10" : "size-8");
  return (
    <div className="flex items-center gap-1" dir="ltr">
      <button type="button" className={btn} onClick={() => onStep(-1)} aria-label="−1"><Minus className="size-4" /></button>
      <Input
        type="number"
        min="0"
        step="0.001"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        className={cn("px-1 text-center tabular-nums", big ? "h-10 w-20 text-base" : "h-8 w-14")}
        aria-label={label}
      />
      <button type="button" className={btn} onClick={() => onStep(1)} aria-label="+1"><Plus className="size-4" /></button>
    </div>
  );
}

function ModeButton({ active, onClick, children, big }: { active: boolean; onClick: () => void; children: React.ReactNode; big?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors",
        big ? "h-11 text-sm" : "h-8 px-2.5 text-xs",
        active ? "border-palm-800 bg-palm-800 text-cream" : "bg-background hover:border-palm-700/50",
      )}
    >
      {children}
    </button>
  );
}
