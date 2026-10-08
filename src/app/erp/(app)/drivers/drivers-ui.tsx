"use client";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { saveDriver, type DriverInput } from "@/app/erp/(app)/_actions/logistics";
import { DataTable, type Col } from "@/components/erp/data-table";
import { Field, nativeSelect } from "@/components/erp/field";
import { DateText, Money } from "@/components/erp/money";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";

export function DriverForm({ initial, trigger }: { initial?: DriverInput & { id: string }; trigger: React.ReactNode }) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<DriverInput>(initial ?? { kind: "driver", name: "", commission_type: "none", commission_value: 0 });
  const { run, pending, error } = useServerAction();
  const s = (k: keyof DriverInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const unit = v.commission_type === "percent" ? "%" : v.commission_type === "per_kg" ? `${dict.common.sar} / ${dict.common.kg}` : dict.common.sar;
  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(initial ?? { kind: "driver", name: "", commission_type: "none", commission_value: 0 }); }}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side={locale === "ar" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{initial ? t.drivers.edit : t.drivers.new}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 px-4 sm:grid-cols-2">
          <Field label={t.fields.kind} htmlFor="dr-kind">
            <select id="dr-kind" className={nativeSelect} value={v.kind} onChange={s("kind")}>
              <option value="driver">{t.driverKinds.driver}</option>
              <option value="agent">{t.driverKinds.agent}</option>
            </select>
          </Field>
          <Field label={dict.common.phone} htmlFor="dr-phone"><Input id="dr-phone" dir="ltr" type="tel" value={v.phone ?? ""} onChange={s("phone")} /></Field>
          <Field label={dict.common.name} htmlFor="dr-name" required><Input id="dr-name" value={v.name} onChange={s("name")} /></Field>
          <Field label={dict.common.nameAr} htmlFor="dr-name-ar"><Input id="dr-name-ar" dir="rtl" value={v.name_ar ?? ""} onChange={s("name_ar")} /></Field>
          <Field label={t.fields.vehicle} htmlFor="dr-vt"><Input id="dr-vt" value={v.vehicle_type ?? ""} onChange={s("vehicle_type")} /></Field>
          <Field label={t.fields.vehicleNo} htmlFor="dr-vn"><Input id="dr-vn" dir="ltr" value={v.vehicle_no ?? ""} onChange={s("vehicle_no")} /></Field>
          <Field label={t.fields.commissionRule} htmlFor="dr-ct">
            <select id="dr-ct" className={nativeSelect} value={v.commission_type} onChange={s("commission_type")}>
              {(Object.keys(t.commissionTypes) as (keyof typeof t.commissionTypes)[]).map((k) => (
                <option key={k} value={k}>{t.commissionTypes[k]}</option>
              ))}
            </select>
          </Field>
          <Field label={`${t.fields.commissionValue} (${unit})`} htmlFor="dr-cv">
            <Input id="dr-cv" type="number" min="0" step="0.0001" disabled={v.commission_type === "none"} value={String(v.commission_value ?? 0)} onChange={s("commission_value")} />
          </Field>
          <Field label={dict.common.notes} htmlFor="dr-notes" className="sm:col-span-2"><Textarea id="dr-notes" rows={2} value={v.notes ?? ""} onChange={s("notes")} /></Field>
          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
          <Button disabled={pending || v.name.trim().length < 2} onClick={() => run(() => saveDriver(v), { success: dict.common.saved, onSuccess: () => setOpen(false) })}>
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export type DriverRow = { id: string; code: string; name: string; name_ar: string | null; kind: string; phone: string | null; vehicle_no: string | null; rule: string; value: number; earned: number; paid: number; owed: number; is_active: boolean };

export function DriversTable({ rows, canManage }: { rows: DriverRow[]; canManage: boolean }) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const cols: Col<DriverRow>[] = [
    { id: "name", header: dict.common.name, value: (r) => `${r.name} ${r.name_ar ?? ""} ${r.code}`, cell: (r) => <div><p className="font-semibold text-palm-900">{locale === "ar" ? r.name_ar || r.name : r.name}</p><p className="text-xs text-muted-foreground">{r.code} · {t.driverKinds[r.kind as "driver"]}</p></div> },
    { id: "phone", header: dict.common.phone, value: (r) => r.phone ?? "", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span>, hideBelow: "md" },
    { id: "vehicle", header: t.fields.vehicleNo, value: (r) => r.vehicle_no ?? "", cell: (r) => r.vehicle_no ?? "—", hideBelow: "lg" },
    { id: "rule", header: t.fields.commissionRule, value: (r) => r.rule, cell: (r) => <span className="text-xs">{t.commissionTypes[r.rule as keyof typeof t.commissionTypes]}{r.rule !== "none" ? ` · ${r.value}${r.rule === "percent" ? "%" : ""}` : ""}</span>, hideBelow: "sm" },
    { id: "earned", header: t.drivers.earned, value: (r) => r.earned, cell: (r) => <Money value={r.earned} />, align: "end", hideBelow: "md" },
    { id: "owed", header: t.drivers.owed, value: (r) => r.owed, cell: (r) => <Money value={r.owed} className={r.owed > 0 ? "font-semibold" : "text-muted-foreground"} />, align: "end" },
    { id: "status", header: dict.common.status, value: (r) => (r.is_active ? 1 : 0), cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} />, align: "center", hideBelow: "sm" },
  ];
  return (
    <DataTable
      rows={rows}
      columns={cols}
      rowHref={(r) => `/erp/drivers/${r.id}`}
      emptyTitle={t.drivers.empty}
      initialSort={{ id: "owed", desc: true }}
      toolbar={canManage && <DriverForm trigger={<Button><Plus />{t.drivers.new}</Button>} />}
    />
  );
}

export type CommissionRow = { id: string; created_at: string; invoice_no: string; sale_id: string; rule: string; basis: number; amount: number; note: string | null };

export function CommissionsTable({ rows }: { rows: CommissionRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const cols: Col<CommissionRow>[] = [
    { id: "date", header: dict.common.date, value: (r) => r.created_at, cell: (r) => <DateText value={r.created_at} /> },
    { id: "inv", header: t.fields.invoiceNo, value: (r) => r.invoice_no, cell: (r) => <a href={`/erp/sales/${r.sale_id}`} className="font-mono text-xs font-semibold hover:underline">{r.invoice_no}</a> },
    { id: "rule", header: t.fields.commissionRule, value: (r) => r.rule, cell: (r) => <span className="text-xs">{t.commissionTypes[r.rule as keyof typeof t.commissionTypes]}{r.note ? ` · ${r.note}` : ""}</span>, hideBelow: "md" },
    { id: "amount", header: dict.common.amount, value: (r) => r.amount, cell: (r) => <Money value={r.amount} signed className="font-semibold" />, align: "end" },
  ];
  return <DataTable rows={rows} columns={cols} initialSort={{ id: "date", desc: true }} search={false} />;
}
