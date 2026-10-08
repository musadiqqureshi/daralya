"use client";
import { useState } from "react";
import { Loader2, Mail, Plus, Save, Trash2 } from "lucide-react";
import { deleteQr, saveListItem, saveQr, saveSchedule, saveSettings, sendDailyReportNow } from "@/app/erp/(app)/_actions/settings";
import { Field, nativeSelect } from "@/components/erp/field";
import { Section } from "@/components/erp/section";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type S = Record<string, string | number | boolean | null>;

function useSettingsForm(initial: S) {
  const [v, setV] = useState<S>(initial);
  const { run, pending, error } = useServerAction();
  const text = (k: string) => ({ value: String(v[k] ?? ""), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value })) });
  const bool = (k: string) => ({ checked: Boolean(v[k]), onCheckedChange: (c: boolean) => setV((x) => ({ ...x, [k]: c })) });
  return { v, setV, text, bool, run, pending, error };
}

function SaveBar({ onSave, pending, error }: { onSave: () => void; pending: boolean; error: string | null }) {
  const { dict } = useI18n();
  return (
    <div className="mt-5 flex items-center justify-end gap-3 border-t pt-4">
      {error && <p role="alert" className="me-auto text-sm text-destructive">{error}</p>}
      <Button onClick={onSave} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Save />}{dict.common.saveChanges}</Button>
    </div>
  );
}

export function SettingsForm({ initial, keys, children }: { initial: S; keys: string[]; children: (f: ReturnType<typeof useSettingsForm>) => React.ReactNode }) {
  const { dict } = useI18n();
  const f = useSettingsForm(initial);
  return (
    <Section>
      {children(f)}
      <SaveBar pending={f.pending} error={f.error} onSave={() => f.run(() => saveSettings(Object.fromEntries(keys.map((k) => [k, f.v[k]]))), { success: dict.erp.settings.saved })} />
    </Section>
  );
}

export function CompanySettings({ initial }: { initial: S }) {
  const { dict } = useI18n();
  const keys = ["company_name_en", "company_name_ar", "tagline_en", "tagline_ar", "phone", "whatsapp", "email", "address_en", "address_ar", "maps_url", "cr_number", "vat_number"];
  return (
    <SettingsForm initial={initial} keys={keys}>
      {({ text }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={dict.erp.products.nameEn} htmlFor="s-cn"><Input id="s-cn" {...text("company_name_en")} /></Field>
          <Field label={dict.erp.products.nameAr} htmlFor="s-ca"><Input id="s-ca" dir="rtl" {...text("company_name_ar")} /></Field>
          <Field label={`${dict.erp.settings.tagline} (EN)`} htmlFor="s-te"><Input id="s-te" {...text("tagline_en")} /></Field>
          <Field label={`${dict.erp.settings.tagline} (AR)`} htmlFor="s-ta"><Input id="s-ta" dir="rtl" {...text("tagline_ar")} /></Field>
          <Field label={dict.common.phone} htmlFor="s-ph"><Input id="s-ph" dir="ltr" {...text("phone")} /></Field>
          <Field label={dict.common.whatsapp} htmlFor="s-wa"><Input id="s-wa" dir="ltr" {...text("whatsapp")} /></Field>
          <Field label={dict.common.email} htmlFor="s-em"><Input id="s-em" dir="ltr" type="email" {...text("email")} /></Field>
          <Field label={dict.erp.settings.mapsUrl} htmlFor="s-map"><Input id="s-map" dir="ltr" {...text("maps_url")} /></Field>
          <Field label={`${dict.common.address} (EN)`} htmlFor="s-ae"><Input id="s-ae" {...text("address_en")} /></Field>
          <Field label={`${dict.common.address} (AR)`} htmlFor="s-aa"><Input id="s-aa" dir="rtl" {...text("address_ar")} /></Field>
          <Field label={dict.erp.settings.crNumber} htmlFor="s-cr"><Input id="s-cr" dir="ltr" {...text("cr_number")} /></Field>
          <Field label={dict.erp.fields.vatNumber} htmlFor="s-vn"><Input id="s-vn" dir="ltr" {...text("vat_number")} /></Field>
        </div>
      )}
    </SettingsForm>
  );
}

export function InvoiceSettings({ initial }: { initial: S }) {
  const { dict } = useI18n();
  const t = dict.erp.settings;
  return (
    <SettingsForm initial={initial} keys={["vat_enabled", "vat_rate", "invoice_language", "invoice_footer_en", "invoice_footer_ar", "invoice_show_zatca_qr"]}>
      {({ text, bool, v, setV }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm font-medium"><Switch {...bool("vat_enabled")} />{t.vatEnabled}</label>
          <Field label={t.vatRate} htmlFor="s-vr"><Input id="s-vr" type="number" min="0" max="100" step="0.01" {...text("vat_rate")} disabled={!v.vat_enabled} /></Field>
          <Field label={t.invoiceLanguage} htmlFor="s-il">
            <select id="s-il" className={nativeSelect} value={String(v.invoice_language)} onChange={(e) => setV((x) => ({ ...x, invoice_language: e.target.value }))}>
              <option value="both">English + العربية</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </Field>
          <label className="flex items-center gap-3 text-sm"><Switch {...bool("invoice_show_zatca_qr")} />{t.zatcaQr}</label>
          <Field label={t.footerEn} htmlFor="s-fe"><Textarea id="s-fe" rows={2} {...text("invoice_footer_en")} /></Field>
          <Field label={t.footerAr} htmlFor="s-fa"><Textarea id="s-fa" dir="rtl" rows={2} {...text("invoice_footer_ar")} /></Field>
        </div>
      )}
    </SettingsForm>
  );
}

export function StockSettings({ initial }: { initial: S }) {
  const { dict } = useI18n();
  return (
    <SettingsForm initial={initial} keys={["allow_negative_stock"]}>
      {({ bool }) => <label className="flex items-center gap-3 text-sm"><Switch {...bool("allow_negative_stock")} />{dict.erp.settings.allowNegative}</label>}
    </SettingsForm>
  );
}

export function AttendanceSettings({ initial }: { initial: S }) {
  const { dict } = useI18n();
  const t = dict.erp.settings;
  return (
    <SettingsForm initial={initial} keys={["attendance_grace_minutes", "attendance_photo_retention_hours", "attendance_notice_en", "attendance_notice_ar"]}>
      {({ text }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.grace} htmlFor="s-gr"><Input id="s-gr" type="number" min="0" {...text("attendance_grace_minutes")} /></Field>
          <Field label={t.retentionHours} htmlFor="s-ret"><Input id="s-ret" type="number" min="1" {...text("attendance_photo_retention_hours")} /></Field>
          <Field label={`${t.notice} (EN)`} htmlFor="s-ne"><Textarea id="s-ne" rows={3} {...text("attendance_notice_en")} /></Field>
          <Field label={`${t.notice} (AR)`} htmlFor="s-na"><Textarea id="s-na" dir="rtl" rows={3} {...text("attendance_notice_ar")} /></Field>
        </div>
      )}
    </SettingsForm>
  );
}

export function PayrollSettings({ initial }: { initial: S }) {
  const { dict } = useI18n();
  const t = dict.erp.settings;
  return (
    <SettingsForm initial={initial} keys={["payroll_working_days_per_month", "payroll_overtime_multiplier", "payroll_late_deduction_mode", "payroll_late_deduction_value", "payroll_absence_deduction", "payroll_half_day_factor", "payroll_paid_leave"]}>
      {({ text, bool, v, setV }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.daysPerMonth} htmlFor="s-dpm"><Input id="s-dpm" type="number" min="1" max="31" {...text("payroll_working_days_per_month")} /></Field>
          <Field label={t.otMultiplier} htmlFor="s-ot"><Input id="s-ot" type="number" min="0" step="0.05" {...text("payroll_overtime_multiplier")} /></Field>
          <Field label={t.lateMode} htmlFor="s-lm">
            <select id="s-lm" className={nativeSelect} value={String(v.payroll_late_deduction_mode)} onChange={(e) => setV((x) => ({ ...x, payroll_late_deduction_mode: e.target.value }))}>
              {(Object.keys(t.lateModes) as (keyof typeof t.lateModes)[]).map((k) => <option key={k} value={k}>{t.lateModes[k]}</option>)}
            </select>
          </Field>
          <Field label={t.lateValue} htmlFor="s-lv"><Input id="s-lv" type="number" min="0" step="0.01" {...text("payroll_late_deduction_value")} disabled={v.payroll_late_deduction_mode === "none"} /></Field>
          <Field label={t.halfDayFactor} htmlFor="s-hd"><Input id="s-hd" type="number" min="0" max="1" step="0.05" {...text("payroll_half_day_factor")} /></Field>
          <div className="space-y-3 pt-6">
            <label className="flex items-center gap-3 text-sm"><Switch {...bool("payroll_absence_deduction")} />{t.absenceDeduction}</label>
            <label className="flex items-center gap-3 text-sm"><Switch {...bool("payroll_paid_leave")} />{t.paidLeave}</label>
          </div>
        </div>
      )}
    </SettingsForm>
  );
}

export function SecuritySettings({ initial }: { initial: S }) {
  const { dict } = useI18n();
  return (
    <SettingsForm initial={initial} keys={["session_timeout_minutes"]}>
      {({ text }) => (
        <Field label={dict.erp.settings.sessionTimeout} htmlFor="s-st" className="max-w-xs"><Input id="s-st" type="number" min="5" max="1440" {...text("session_timeout_minutes")} /></Field>
      )}
    </SettingsForm>
  );
}

export type QrRow = { id: string; label_en: string; label_ar: string; url: string; is_enabled: boolean; position: "header" | "footer"; size_px: number; sort_order: number };

export function QrSettings({ rows }: { rows: QrRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp.settings;
  const blank: Omit<QrRow, "id"> & { id?: string } = { label_en: "", label_ar: "", url: "https://", is_enabled: true, position: "footer", size_px: 88, sort_order: rows.length + 1 };
  const [items, setItems] = useState<(Omit<QrRow, "id"> & { id?: string })[]>(rows);
  const { run, pending, error } = useServerAction();
  const set = (i: number, patch: Partial<QrRow>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Section title={t.qr} actions={<Button size="sm" variant="outline" onClick={() => setItems((xs) => [...xs, { ...blank }])}><Plus />{t.addQr}</Button>}>
      <ul className="space-y-3">
        {items.map((q, i) => (
          <li key={q.id ?? `new-${i}`} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_2fr_auto_auto_auto_auto]">
            <Input aria-label={`${t.label} EN`} placeholder={`${t.label} (EN)`} value={q.label_en} onChange={(e) => set(i, { label_en: e.target.value })} />
            <Input aria-label={`${t.label} AR`} placeholder={`${t.label} (AR)`} dir="rtl" value={q.label_ar} onChange={(e) => set(i, { label_ar: e.target.value })} />
            <Input aria-label="URL" dir="ltr" value={q.url} onChange={(e) => set(i, { url: e.target.value })} />
            <select aria-label={t.position} className={cn(nativeSelect, "w-28")} value={q.position} onChange={(e) => set(i, { position: e.target.value as "footer" })}>
              <option value="header">{t.header}</option>
              <option value="footer">{t.footer}</option>
            </select>
            <Input aria-label={t.size} type="number" min="48" max="200" className="w-20" value={q.size_px} onChange={(e) => set(i, { size_px: Number(e.target.value) })} />
            <label className="flex items-center gap-2 text-xs"><Switch checked={q.is_enabled} onCheckedChange={(c) => set(i, { is_enabled: c })} />{t.enabled}</label>
            <div className="flex gap-1">
              <Button size="icon-sm" variant="outline" disabled={pending} onClick={() => run(() => saveQr(q), { success: t.saved })} aria-label={dict.common.save}><Save /></Button>
              {q.id && <Button size="icon-sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteQr(q.id!), { onSuccess: () => setItems((xs) => xs.filter((_, j) => j !== i)) })} aria-label={dict.common.delete}><Trash2 /></Button>}
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </Section>
  );
}

type ListRow = { id?: string; name_en: string; name_ar: string; is_active: boolean; requires_verification?: boolean };

export function ListEditor({ table, title, rows }: { table: "payment_methods" | "expense_categories"; title: string; rows: ListRow[] }) {
  const { dict } = useI18n();
  const [items, setItems] = useState<ListRow[]>(rows);
  const { run, pending } = useServerAction();
  const set = (i: number, patch: Partial<ListRow>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Section title={title} actions={<Button size="sm" variant="outline" onClick={() => setItems((xs) => [...xs, { name_en: "", name_ar: "", is_active: true, requires_verification: false }])}><Plus />{dict.common.add}</Button>}>
      <ul className="space-y-2">
        {items.map((r, i) => (
          <li key={r.id ?? `n${i}`} className="flex flex-wrap items-center gap-2">
            <Input className="min-w-32 flex-1" aria-label="EN" value={r.name_en} onChange={(e) => set(i, { name_en: e.target.value })} />
            <Input className="min-w-32 flex-1" aria-label="AR" dir="rtl" value={r.name_ar} onChange={(e) => set(i, { name_ar: e.target.value })} />
            {table === "payment_methods" && <label className="flex items-center gap-1.5 text-xs"><Switch checked={Boolean(r.requires_verification)} onCheckedChange={(c) => set(i, { requires_verification: c })} />{dict.erp.settings.requiresVerification}</label>}
            <label className="flex items-center gap-1.5 text-xs"><Switch checked={r.is_active} onCheckedChange={(c) => set(i, { is_active: c })} />{dict.common.active}</label>
            <Button size="icon-sm" variant="outline" disabled={pending} onClick={() => run(() => saveListItem(table, r), { success: dict.common.saved })} aria-label={dict.common.save}><Save /></Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export type ScheduleRow = { id?: string; name: string; start_time: string; end_time: string; break_minutes: number; grace_minutes: number | null; half_day_minutes: number; working_days: number[]; is_default: boolean; is_active: boolean };

export function ScheduleEditor({ rows }: { rows: ScheduleRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp.settings;
  const [items, setItems] = useState<ScheduleRow[]>(rows);
  const { run, pending, error } = useServerAction();
  const set = (i: number, patch: Partial<ScheduleRow>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Section
      title={t.schedules}
      actions={<Button size="sm" variant="outline" onClick={() => setItems((xs) => [...xs, { name: "", start_time: "08:00", end_time: "17:00", break_minutes: 60, grace_minutes: null, half_day_minutes: 240, working_days: [0, 1, 2, 3, 4, 6], is_default: false, is_active: true }])}><Plus />{dict.common.add}</Button>}
    >
      <ul className="space-y-3">
        {items.map((s, i) => (
          <li key={s.id ?? `n${i}`} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-2 sm:grid-cols-6">
              <Field label={dict.common.name} className="sm:col-span-2"><Input value={s.name} onChange={(e) => set(i, { name: e.target.value })} /></Field>
              <Field label={t.startTime}><Input type="time" value={s.start_time.slice(0, 5)} onChange={(e) => set(i, { start_time: e.target.value })} /></Field>
              <Field label={t.endTime}><Input type="time" value={s.end_time.slice(0, 5)} onChange={(e) => set(i, { end_time: e.target.value })} /></Field>
              <Field label={t.breakMin}><Input type="number" min="0" value={s.break_minutes} onChange={(e) => set(i, { break_minutes: Number(e.target.value) })} /></Field>
              <Field label={t.halfDayMin}><Input type="number" min="30" value={s.half_day_minutes} onChange={(e) => set(i, { half_day_minutes: Number(e.target.value) })} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">{t.workingDays}</span>
              <div className="flex flex-wrap gap-1">
                {t.days.map((d, k) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={s.working_days.includes(k)}
                    onClick={() => set(i, { working_days: s.working_days.includes(k) ? s.working_days.filter((x) => x !== k) : [...s.working_days, k].sort() })}
                    className={cn("rounded-md border px-2 py-1 text-xs font-medium", s.working_days.includes(k) ? "border-palm-800 bg-palm-800 text-cream" : "text-muted-foreground")}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-xs"><Switch checked={s.is_default} onCheckedChange={(c) => set(i, { is_default: c })} />{t.default}</label>
              <label className="flex items-center gap-1.5 text-xs"><Switch checked={s.is_active} onCheckedChange={(c) => set(i, { is_active: c })} />{dict.common.active}</label>
              <Field label={t.grace} className="w-36"><Input type="number" min="0" placeholder="—" value={s.grace_minutes ?? ""} onChange={(e) => set(i, { grace_minutes: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              <Button size="sm" className="ms-auto" disabled={pending || s.name.length < 2} onClick={() => run(() => saveSchedule({ ...s, grace_minutes: s.grace_minutes ?? "" }), { success: t.saved })}><Save />{dict.common.save}</Button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </Section>
  );
}

export function EmailSettings({ initial, configured }: { initial: S; configured: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.settings;
  const { run, pending } = useServerAction();
  return (
    <div className="space-y-4">
      {!configured && <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">{t.emailNotConfigured}</p>}
      <SettingsForm initial={initial} keys={["email_invoices", "daily_report_enabled", "daily_report_emails"]}>
        {({ text, bool }) => (
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm"><Switch {...bool("email_invoices")} />{t.emailInvoices}</label>
            <label className="flex items-center gap-3 text-sm"><Switch {...bool("daily_report_enabled")} />{t.dailyReport}</label>
            <Field label={t.reportRecipients} htmlFor="s-rr" hint={t.reportRecipientsHint}><Input id="s-rr" dir="ltr" {...text("daily_report_emails")} placeholder="owner@example.com, manager@example.com" /></Field>
          </div>
        )}
      </SettingsForm>
      <Button variant="outline" disabled={pending || !configured} onClick={() => run(sendDailyReportNow, { success: t.reportSent })}>
        {pending ? <Loader2 className="animate-spin" /> : <Mail />}
        {t.sendReportNow}
      </Button>
    </div>
  );
}
