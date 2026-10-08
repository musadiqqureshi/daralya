"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { guarded, must } from "@/lib/erp/server";

const t = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const settingsSchema = z
  .object({
    company_name_en: z.string().trim().min(2).max(120),
    company_name_ar: z.string().trim().min(2).max(120),
    tagline_en: t(200),
    tagline_ar: t(200),
    phone: t(40),
    whatsapp: t(40),
    email: z.string().trim().email().max(200).nullable().optional().or(z.literal("")).transform((v) => v || null),
    address_en: t(300),
    address_ar: t(300),
    maps_url: z.string().trim().url().max(500).nullable().optional().or(z.literal("")).transform((v) => v || null),
    cr_number: t(40),
    vat_enabled: z.boolean(),
    vat_rate: z.coerce.number().min(0).max(100),
    vat_number: t(30),
    allow_negative_stock: z.boolean(),
    invoice_language: z.enum(["ar", "en", "both"]),
    invoice_footer_en: t(300),
    invoice_footer_ar: t(300),
    invoice_show_zatca_qr: z.boolean(),
    attendance_grace_minutes: z.coerce.number().int().min(0).max(180),
    attendance_photo_retention_hours: z.coerce.number().int().min(1).max(8760),
    email_invoices: z.boolean(),
    daily_report_enabled: z.boolean(),
    daily_report_emails: z.string().trim().max(500).nullable().optional().transform((v) => (v ? v : null)),
    attendance_notice_en: t(600),
    attendance_notice_ar: t(600),
    payroll_working_days_per_month: z.coerce.number().int().min(1).max(31),
    payroll_overtime_multiplier: z.coerce.number().min(0).max(5),
    payroll_late_deduction_mode: z.enum(["none", "per_occurrence", "per_minute"]),
    payroll_late_deduction_value: z.coerce.number().min(0),
    payroll_absence_deduction: z.boolean(),
    payroll_half_day_factor: z.coerce.number().min(0).max(1),
    payroll_paid_leave: z.boolean(),
    session_timeout_minutes: z.coerce.number().int().min(5).max(1440),
  })
  .partial();

export async function saveSettings(patch: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const res = await guarded("settings.manage", async ({ supabase }) => {
    must(await supabase.from("settings").update(parsed.data).eq("id", 1));
    return undefined;
  });
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

const qrSchema = z.object({
  id: z.string().uuid().optional(),
  label_en: z.string().trim().min(1).max(40),
  label_ar: z.string().trim().min(1).max(40),
  url: z.string().trim().regex(/^(https?:\/\/|tel:|mailto:)/i).max(500),
  is_enabled: z.boolean(),
  position: z.enum(["header", "footer"]),
  size_px: z.coerce.number().int().min(48).max(200),
  sort_order: z.coerce.number().int().min(0).max(99),
});
export async function saveQr(input: z.input<typeof qrSchema>): Promise<ActionResult> {
  const parsed = qrSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { id, ...row } = parsed.data;
  return guarded("settings.manage", async ({ supabase }) => {
    if (id) must(await supabase.from("invoice_qr_codes").update(row).eq("id", id));
    else must(await supabase.from("invoice_qr_codes").insert(row));
    return undefined;
  });
}
export async function deleteQr(id: string): Promise<ActionResult> {
  return guarded("settings.manage", async ({ supabase }) => {
    must(await supabase.from("invoice_qr_codes").delete().eq("id", id));
    return undefined;
  });
}

export async function saveListItem(table: "payment_methods" | "expense_categories", row: { id?: string; name_en: string; name_ar: string; is_active?: boolean; requires_verification?: boolean; code?: string }): Promise<ActionResult> {
  if (!["payment_methods", "expense_categories"].includes(table) || row.name_en.trim().length < 2) return { ok: false, error: "Enter a name" };
  return guarded("settings.manage", async ({ supabase }) => {
    const { id, ...data } = row;
    if (table === "payment_methods" && !id) data.code = data.code || row.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
    if (id) must(await supabase.from(table).update(data).eq("id", id));
    else must(await supabase.from(table).insert({ ...data, name_ar: data.name_ar || data.name_en }));
    return undefined;
  });
}

const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/),
  break_minutes: z.coerce.number().int().min(0).max(240),
  grace_minutes: z.union([z.coerce.number().int().min(0).max(180), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  half_day_minutes: z.coerce.number().int().min(30).max(720),
  working_days: z.array(z.number().int().min(0).max(6)).min(1),
  is_default: z.boolean(),
  is_active: z.boolean(),
});
export async function saveSchedule(input: z.input<typeof scheduleSchema>): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { id, ...row } = parsed.data;
  return guarded(["settings.manage", "employees.manage"], async ({ supabase }) => {
    if (row.is_default) must(await supabase.from("work_schedules").update({ is_default: false }).neq("id", id ?? "00000000-0000-0000-0000-000000000000"));
    if (id) must(await supabase.from("work_schedules").update(row).eq("id", id));
    else must(await supabase.from("work_schedules").insert(row));
    return undefined;
  });
}

export async function sendDailyReportNow(): Promise<ActionResult<number>> {
  const { getSession } = await import("@/lib/auth");
  const { mailDailyReport } = await import("@/lib/erp/mailers");
  const session = await getSession();
  if (!session?.can("settings.manage")) return { ok: false, error: "Permission denied" };
  const res = await mailDailyReport(undefined, session.email ? [session.email] : []);
  return res.ok ? { ok: true, data: res.recipients } : { ok: false, error: res.error ?? "Email failed" };
}
