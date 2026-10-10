"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeftRight, Check, Loader2, PackageMinus, Plus, Thermometer, X } from "lucide-react";
import { loadOpeningStock, logTemperature, requestAdjustment, reviewAdjustment, saveStorage, transferStock } from "@/app/erp/(app)/_actions/stock";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { fmtNumber, todayRiyadh } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { DataTable, type Col } from "./data-table";
import { EntitySelect, type Option } from "./entity-select";
import { Field, nativeSelect } from "./field";
import { LineEditor } from "./line-editor";
import { DateText, Money, Num } from "./money";
import { StatusBadge } from "./status-badge";
import { useServerAction } from "./use-server-action";

type Named = { id: string; name_en: string; name_ar: string };
type NamePair = { name_en: string; name_ar: string };
const useName = () => {
  const { locale } = useI18n();
  return (r: { name_en: string; name_ar: string } | null | undefined) => (r ? (locale === "ar" ? r.name_ar : r.name_en) : "—");
};

/* ------------------------------------------------------------------ */
export type LevelRow = { product_id: string; sku: string; name_en: string; name_ar: string; variety: string; unit: string; storage_en: string; storage_ar: string; qty: number; kg: number; value: number | null; min_stock: number; total_qty: number };

export function StockLevelsTable({ rows, showValue }: { rows: LevelRow[]; showValue: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const name = useName();
  const cols: Col<LevelRow>[] = [
    {
      id: "product",
      header: t.fields.product,
      value: (r) => `${r.name_en} ${r.name_ar} ${r.sku}`,
      cell: (r) => (
        <Link href={`/erp/products/${r.product_id}`} className="hover:underline">
          <span className="font-semibold text-palm-900">{name(r)}</span>
          <span className="block text-xs text-muted-foreground">{r.sku} · {r.variety}</span>
        </Link>
      ),
    },
    { id: "storage", header: t.fields.storage, value: (r) => r.storage_en, cell: (r) => name({ name_en: r.storage_en, name_ar: r.storage_ar }) },
    {
      id: "qty",
      header: t.fields.onHand,
      value: (r) => r.qty,
      cell: (r) => (
        <span className={cn("font-semibold", r.total_qty <= r.min_stock && "text-warning", r.qty < 0 && "text-destructive")}>
          <Num value={r.qty} /> <span className="text-xs font-normal text-muted-foreground">{t.units[r.unit as keyof typeof t.units]}</span>
        </span>
      ),
      align: "end",
    },
    { id: "kg", header: dict.common.kg, value: (r) => r.kg, cell: (r) => <Num value={r.kg} digits={1} />, align: "end", hideBelow: "sm" },
    ...(showValue ? [{ id: "value", header: t.inventory.value, value: (r: LevelRow) => r.value ?? 0, cell: (r: LevelRow) => <Money value={r.value} />, align: "end" as const, hideBelow: "md" as const }] : []),
  ];
  return <DataTable rows={rows} columns={cols} emptyTitle={t.inventory.empty} initialSort={{ id: "product" }} />;
}

/* ------------------------------------------------------------------ */
export type MovementRow = { id: number; movement_date: string; created_at: string; type: string; product: NamePair; storage: NamePair; batch_no: string; batch_id: string; qty: number; source_type: string; source_id: string | null };
const srcHref: Record<string, string> = { sale: "/erp/sales/", purchase: "/erp/purchases/" };

export function MovementsTable({ rows }: { rows: MovementRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const name = useName();
  const cols: Col<MovementRow>[] = [
    { id: "date", header: dict.common.date, value: (r) => r.created_at, cell: (r) => <DateText value={r.created_at} withTime /> },
    { id: "type", header: dict.common.type, value: (r) => r.type, cell: (r) => <span className="text-xs font-medium">{t.movement[r.type as keyof typeof t.movement]}</span> },
    { id: "product", header: t.fields.product, value: (r) => name(r.product), cell: (r) => name(r.product) },
    { id: "storage", header: t.fields.storage, value: (r) => name(r.storage), cell: (r) => name(r.storage), hideBelow: "md" },
    { id: "batch", header: t.fields.batch, value: (r) => r.batch_no, cell: (r) => <Link href={`/erp/batches/${r.batch_id}`} className="font-mono text-xs hover:underline">{r.batch_no}</Link>, hideBelow: "lg" },
    { id: "qty", header: dict.common.qty, value: (r) => r.qty, cell: (r) => <span className={cn("font-semibold tabular-nums", r.qty > 0 ? "text-success" : "text-destructive")}>{r.qty > 0 ? "+" : ""}<Num value={r.qty} /></span>, align: "end" },
    { id: "src", header: "", cell: (r) => (r.source_id && srcHref[r.source_type] ? <Link href={srcHref[r.source_type] + r.source_id} className="text-xs text-palm-700 hover:underline">{dict.common.view}</Link> : null), align: "end" },
  ];
  return <DataTable rows={rows} columns={cols} initialSort={{ id: "date", desc: true }} dense />;
}

/* ------------------------------------------------------------------ */
type ProdOpt = Option & { unit: string };
type AdjLine = { product_id: string | null; qty: string; unit_cost: string };

export function AdjustmentDialog({ storages, products, canApprove }: { storages: Named[]; products: ProdOpt[]; canApprove: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.inventory;
  const name = useName();
  const [open, setOpen] = useState(false);
  const [storage, setStorage] = useState(storages[0]?.id ?? "");
  const [type, setType] = useState<"damage" | "wastage" | "adjustment_in" | "adjustment_out">("damage");
  const [date, setDate] = useState(todayRiyadh());
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<AdjLine[]>([{ product_id: null, qty: "", unit_cost: "" }]);
  const { run, pending, error } = useServerAction();
  const setLine = (i: number, p: Partial<AdjLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const valid = storage && reason.trim().length >= 3 && lines.every((l) => l.product_id && Number(l.qty) > 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PackageMinus />
          {t.newAdjustment}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.newAdjustment}</DialogTitle>
          {!canApprove && <DialogDescription>{t.requested}</DialogDescription>}
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t.adjType} htmlFor="adj-type">
            <select id="adj-type" className={nativeSelect} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {(Object.keys(t.types) as (keyof typeof t.types)[]).map((k) => (
                <option key={k} value={k}>{t.types[k]}</option>
              ))}
            </select>
          </Field>
          <Field label={dict.erp.fields.storage} htmlFor="adj-storage">
            <select id="adj-storage" className={nativeSelect} value={storage} onChange={(e) => setStorage(e.target.value)}>
              {storages.map((s) => <option key={s.id} value={s.id}>{name(s)}</option>)}
            </select>
          </Field>
          <Field label={dict.common.date} htmlFor="adj-date">
            <Input id="adj-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <LineEditor
          lines={lines}
          onAdd={() => setLines((ls) => [...ls, { product_id: null, qty: "", unit_cost: "" }])}
          onRemove={(i) => setLines((ls) => ls.filter((_, j) => j !== i))}
          addLabel={dict.erp.sales.addLine}
          headers={[{ label: dict.erp.fields.product, className: "min-w-52" }, { label: dict.common.qty, className: "w-28" }, ...(type === "adjustment_in" ? [{ label: t.unitCost, className: "w-28" }] : [])]}
          renderCells={(l, i) => [
            <EntitySelect key="p" options={products} value={l.product_id} onChange={(v) => setLine(i, { product_id: v })} />,
            <Input key="q" type="number" min="0" step="0.001" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label={dict.common.qty} />,
            ...(type === "adjustment_in" ? [<Input key="c" type="number" min="0" step="0.01" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} aria-label={t.unitCost} />] : []),
          ]}
        />
        <Field label={dict.common.reason} htmlFor="adj-reason" required>
          <Textarea id="adj-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dict.erp.forms.reasonPlaceholder} />
        </Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              run(
                () =>
                  requestAdjustment({
                    storage_id: storage,
                    date,
                    adj_type: type,
                    reason,
                    lines: lines.map((l) => ({ product_id: l.product_id!, qty: l.qty, unit_cost: l.unit_cost === "" ? null : l.unit_cost })),
                  }),
                { success: t.requested, onSuccess: () => { setOpen(false); setLines([{ product_id: null, qty: "", unit_cost: "" }]); setReason(""); } },
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

export type AdjRow = { id: string; adj_no: string; adj_date: string; adj_type: string; reason: string; status: string; storage: NamePair; requested_by: string; total_cost: number | null; items: { product: NamePair; qty: number }[]; review_note: string | null };

export function AdjustmentsTable({ rows, canApprove, showCost }: { rows: AdjRow[]; canApprove: boolean; showCost: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.inventory;
  const name = useName();
  const { run, pending } = useServerAction();
  const cols: Col<AdjRow>[] = [
    { id: "no", header: dict.erp.fields.documentNo, value: (r) => r.adj_no, cell: (r) => <span className="font-mono text-xs font-semibold">{r.adj_no}</span> },
    { id: "date", header: dict.common.date, value: (r) => r.adj_date, cell: (r) => <DateText value={r.adj_date} /> },
    { id: "type", header: t.adjType, value: (r) => r.adj_type, cell: (r) => t.types[r.adj_type as keyof typeof t.types] },
    {
      id: "items",
      header: dict.erp.fields.products,
      value: (r) => r.items.map((i) => name(i.product)).join(" "),
      cell: (r) => (
        <ul className="text-xs">
          {r.items.map((i, k) => (
            <li key={k}>{name(i.product)} × <Num value={i.qty} /></li>
          ))}
          <li className="mt-1 text-muted-foreground">{name(r.storage)} · {r.reason}</li>
        </ul>
      ),
    },
    { id: "by", header: t.requestedBy, value: (r) => r.requested_by, cell: (r) => r.requested_by, hideBelow: "lg" },
    ...(showCost ? [{ id: "cost", header: dict.erp.fields.cost, value: (r: AdjRow) => r.total_cost ?? 0, cell: (r: AdjRow) => (r.status === "approved" ? <Money value={r.total_cost} /> : "—"), align: "end" as const, hideBelow: "md" as const }] : []),
    { id: "status", header: dict.common.status, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} />, align: "center" },
    {
      id: "act",
      header: "",
      align: "end",
      cell: (r) =>
        canApprove && r.status === "pending" ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reviewAdjustment(r.id, true), { success: t.reviewed })}>
              <Check className="text-success" />
              {t.approve}
            </Button>
            <Button size="icon-sm" variant="ghost" disabled={pending} onClick={() => run(() => reviewAdjustment(r.id, false), { success: t.reviewed })} aria-label={t.reject}>
              <X className="text-destructive" />
            </Button>
          </div>
        ) : null,
    },
  ];
  return <DataTable rows={rows} columns={cols} initialSort={{ id: "date", desc: true }} />;
}

/* ------------------------------------------------------------------ */
type OpenLine = { product_id: string | null; qty: string; unit_cost: string; expiry: string };

export function OpeningStockForm({ storages, products }: { storages: Named[]; products: ProdOpt[] }) {
  const { dict } = useI18n();
  const t = dict.erp.inventory;
  const name = useName();
  const [storage, setStorage] = useState(storages[0]?.id ?? "");
  const [date, setDate] = useState(todayRiyadh());
  const [lines, setLines] = useState<OpenLine[]>([{ product_id: null, qty: "", unit_cost: "", expiry: "" }]);
  const { run, pending, error } = useServerAction();
  const setLine = (i: number, p: Partial<OpenLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const valid = storage && lines.every((l) => l.product_id && Number(l.qty) > 0 && l.unit_cost !== "");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.openingHint}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Field label={dict.erp.fields.storage} htmlFor="op-st">
          <select id="op-st" className={nativeSelect} value={storage} onChange={(e) => setStorage(e.target.value)}>
            {storages.map((s) => <option key={s.id} value={s.id}>{name(s)}</option>)}
          </select>
        </Field>
        <Field label={dict.common.date} htmlFor="op-date">
          <Input id="op-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <LineEditor
        lines={lines}
        onAdd={() => setLines((ls) => [...ls, { product_id: null, qty: "", unit_cost: "", expiry: "" }])}
        onRemove={(i) => setLines((ls) => ls.filter((_, j) => j !== i))}
        addLabel={dict.erp.sales.addLine}
        headers={[
          { label: dict.erp.fields.product, className: "min-w-56" },
          { label: dict.common.qty, className: "w-28" },
          { label: t.unitCost, className: "w-32" },
          { label: dict.erp.fields.expiry, className: "w-40" },
        ]}
        renderCells={(l, i) => [
          <EntitySelect key="p" options={products} value={l.product_id} onChange={(v) => setLine(i, { product_id: v })} />,
          <Input key="q" type="number" min="0" step="0.001" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label={dict.common.qty} />,
          <Input key="c" type="number" min="0" step="0.01" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} aria-label={t.unitCost} />,
          <Input key="e" type="date" value={l.expiry} onChange={(e) => setLine(i, { expiry: e.target.value })} aria-label={dict.erp.fields.expiry} />,
        ]}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button
        disabled={!valid || pending}
        onClick={() =>
          run(() => loadOpeningStock({ storage_id: storage, date, lines: lines.map((l) => ({ product_id: l.product_id!, qty: l.qty, unit_cost: l.unit_cost, expiry_date: l.expiry || null })) }), {
            success: t.openingSaved,
            onSuccess: () => setLines([{ product_id: null, qty: "", unit_cost: "", expiry: "" }]),
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />}
        {dict.common.save}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
type TrLine = { product_id: string | null; qty: string };

export function TransferDialog({ storages, products, stock }: { storages: Named[]; products: ProdOpt[]; stock: Record<string, Record<string, number>> }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.storage;
  const name = useName();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(storages[0]?.id ?? "");
  const [to, setTo] = useState(storages[1]?.id ?? "");
  const [date, setDate] = useState(todayRiyadh());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<TrLine[]>([{ product_id: null, qty: "" }]);
  const { run, pending, error } = useServerAction();
  const setLine = (i: number, p: Partial<TrLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const avail = (pid: string | null) => (pid ? stock[pid]?.[from] ?? 0 : 0);
  const valid = from && to && from !== to && lines.every((l) => l.product_id && Number(l.qty) > 0 && Number(l.qty) <= avail(l.product_id));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={storages.length < 2}>
          <ArrowLeftRight />
          {t.transfer}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.transfer}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={dict.erp.fields.fromStorage} htmlFor="tr-from">
            <select id="tr-from" className={nativeSelect} value={from} onChange={(e) => setFrom(e.target.value)}>
              {storages.map((s) => <option key={s.id} value={s.id}>{name(s)}</option>)}
            </select>
          </Field>
          <Field label={dict.erp.fields.toStorage} htmlFor="tr-to">
            <select id="tr-to" className={nativeSelect} value={to} onChange={(e) => setTo(e.target.value)}>
              {storages.map((s) => <option key={s.id} value={s.id} disabled={s.id === from}>{name(s)}</option>)}
            </select>
          </Field>
          <Field label={dict.common.date} htmlFor="tr-date">
            <Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <LineEditor
          lines={lines}
          onAdd={() => setLines((ls) => [...ls, { product_id: null, qty: "" }])}
          onRemove={(i) => setLines((ls) => ls.filter((_, j) => j !== i))}
          addLabel={dict.erp.sales.addLine}
          headers={[{ label: dict.erp.fields.product, className: "min-w-56" }, { label: dict.common.qty, className: "w-32" }]}
          renderCells={(l, i) => [
            <div key="p">
              <EntitySelect options={products} value={l.product_id} onChange={(v) => setLine(i, { product_id: v })} />
              {l.product_id && <p className="mt-1 text-xs text-muted-foreground">{dict.erp.purchases.available}: {fmtNumber(avail(l.product_id), locale, 3)}</p>}
            </div>,
            <Input key="q" type="number" min="0" step="0.001" max={avail(l.product_id)} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className={cn(Number(l.qty) > avail(l.product_id) && "border-destructive")} aria-label={dict.common.qty} />,
          ]}
        />
        <Field label={dict.common.notes} htmlFor="tr-notes">
          <Input id="tr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              run(() => transferStock({ from_storage_id: from, to_storage_id: to, date, notes, lines: lines.map((l) => ({ product_id: l.product_id!, qty: l.qty })) }), {
                success: t.transferSaved,
                onSuccess: () => { setOpen(false); setLines([{ product_id: null, qty: "" }]); },
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {t.transfer}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
export type StorageRow = Named & { location: string | null; capacity_kg: number | null; temp_min: number | null; temp_max: number | null; is_active: boolean };

export function StorageDialog({ initial, trigger }: { initial?: StorageRow; trigger: React.ReactNode }) {
  const { dict } = useI18n();
  const t = dict.erp.storage;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string | boolean>>({});
  const { run, pending, error } = useServerAction();
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o)
          setV({
            name_en: initial?.name_en ?? "",
            name_ar: initial?.name_ar ?? "",
            location: initial?.location ?? "",
            capacity_kg: initial?.capacity_kg?.toString() ?? "",
            temp_min: initial?.temp_min?.toString() ?? "",
            temp_max: initial?.temp_max?.toString() ?? "",
            is_active: initial?.is_active ?? true,
          });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? t.edit : t.new}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={dict.erp.products.nameEn} htmlFor="st-en" required><Input id="st-en" value={String(v.name_en ?? "")} onChange={s("name_en")} /></Field>
          <Field label={dict.erp.products.nameAr} htmlFor="st-ar" required><Input id="st-ar" dir="rtl" value={String(v.name_ar ?? "")} onChange={s("name_ar")} /></Field>
          <Field label={dict.erp.fields.location} htmlFor="st-loc" className="sm:col-span-2"><Input id="st-loc" value={String(v.location ?? "")} onChange={s("location")} /></Field>
          <Field label={dict.erp.fields.capacityKg} htmlFor="st-cap"><Input id="st-cap" type="number" min="0" value={String(v.capacity_kg ?? "")} onChange={s("capacity_kg")} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t.tempMin} htmlFor="st-min"><Input id="st-min" type="number" step="0.1" value={String(v.temp_min ?? "")} onChange={s("temp_min")} /></Field>
            <Field label={t.tempMax} htmlFor="st-max"><Input id="st-max" type="number" step="0.1" value={String(v.temp_max ?? "")} onChange={s("temp_max")} /></Field>
          </div>
          {initial && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={Boolean(v.is_active)} onCheckedChange={(c) => setV((x) => ({ ...x, is_active: c }))} />
              {dict.common.active}
            </label>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  saveStorage({
                    id: initial?.id,
                    name_en: String(v.name_en),
                    name_ar: String(v.name_ar),
                    location: String(v.location ?? ""),
                    capacity_kg: String(v.capacity_kg ?? ""),
                    temp_min: String(v.temp_min ?? ""),
                    temp_max: String(v.temp_max ?? ""),
                    is_active: Boolean(v.is_active),
                  }),
                { success: dict.common.saved, onSuccess: () => setOpen(false) },
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

export function TemperatureDialog({ storages }: { storages: StorageRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp.storage;
  const name = useName();
  const [open, setOpen] = useState(false);
  const [storage, setStorage] = useState(storages[0]?.id ?? "");
  const [temp, setTemp] = useState("");
  const [hum, setHum] = useState("");
  const [notes, setNotes] = useState("");
  const { run, pending, error } = useServerAction();
  const st = storages.find((s) => s.id === storage);
  const out = st && temp !== "" && ((st.temp_min !== null && Number(temp) < Number(st.temp_min)) || (st.temp_max !== null && Number(temp) > Number(st.temp_max)));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Thermometer />
          {t.logTemperature}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.logTemperature}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={dict.erp.fields.storage} htmlFor="tp-st">
            <select id="tp-st" className={nativeSelect} value={storage} onChange={(e) => setStorage(e.target.value)}>
              {storages.map((s) => <option key={s.id} value={s.id}>{name(s)}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={dict.erp.fields.temperature} htmlFor="tp-t" required>
              <Input id="tp-t" type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} className={cn(out && "border-destructive")} />
            </Field>
            <Field label={dict.erp.fields.humidity} htmlFor="tp-h">
              <Input id="tp-h" type="number" min="0" max="100" step="1" value={hum} onChange={(e) => setHum(e.target.value)} />
            </Field>
          </div>
          {out && <p className="text-xs font-semibold text-destructive">{t.outOfRange}</p>}
          <Field label={dict.common.notes} htmlFor="tp-n">
            <Input id="tp-n" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending || temp === ""}
            onClick={() =>
              run(() => logTemperature({ storage_id: storage, temperature_c: temp, humidity_pct: hum, notes }), {
                success: t.tempSaved,
                onSuccess: () => { setOpen(false); setTemp(""); setHum(""); setNotes(""); },
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

export function NewStorageButton() {
  const { dict } = useI18n();
  return (
    <StorageDialog
      trigger={
        <Button variant="outline">
          <Plus />
          {dict.erp.storage.new}
        </Button>
      }
    />
  );
}
