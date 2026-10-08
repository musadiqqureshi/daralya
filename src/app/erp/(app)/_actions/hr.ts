"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isoDate, optText, uuid } from "@/lib/erp/schemas";
import { callRpc, guarded, must } from "@/lib/erp/server";
import { after } from "next/server";
import { purgeAttendancePhotos } from "@/lib/erp/mailers";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

const employeeSchema = z.object({
  id: uuid.optional(),
  full_name: z.string().trim().min(2).max(120),
  full_name_ar: optText(120),
  photo_path: optText(300),
  phone: optText(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
  address: optText(300),
  id_number: optText(40),
  job_title: optText(80),
  department: optText(80),
  salary_type: z.enum(["monthly", "daily", "hourly"]),
  basic_salary: z.coerce.number().min(0).max(1_000_000),
  joining_date: isoDate,
  status: z.enum(["active", "inactive", "terminated"]),
  manager_id: uuid.nullable().optional().or(z.literal("")).transform((v) => v || null),
  schedule_id: uuid.nullable().optional().or(z.literal("")).transform((v) => v || null),
  notes: optText(1000),
});
export type EmployeeInput = z.input<typeof employeeSchema>;

export async function saveEmployee(input: EmployeeInput): Promise<ActionResult<string>> {
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { id, ...row } = parsed.data;
  return guarded("employees.manage", async ({ supabase }) => {
    if (id) {
      must(await supabase.from("employees").update(row).eq("id", id));
      return id;
    }
    return must(await supabase.from("employees").insert(row).select("id").single()).id as string;
  });
}

const markSchema = z.object({
  employee_id: uuid,
  kind: z.enum(["in", "out"]),
  photo_path: z.string().max(300).nullable(),
  manual_reason: optText(300),
  notes: optText(300),
  device: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});
export async function markAttendance(input: z.input<typeof markSchema>): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const p = parsed.data;
  if (hasAdminKey()) after(() => purgeAttendancePhotos().then(() => undefined));
  return callRpc(p.kind === "in" ? "attendance_check_in" : "attendance_check_out", {
    p_employee: p.employee_id,
    p_photo_path: p.photo_path,
    p_device: p.device ?? null,
    p_manual_reason: p.manual_reason,
    p_notes: p.notes,
  });
}

const correctSchema = z.object({
  status: z.enum(["present", "late", "absent", "half_day", "on_leave", "holiday"]).optional(),
  check_in_at: z.string().datetime({ offset: true }).nullable().optional(),
  check_out_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: optText(300),
});
export async function correctAttendance(id: string, patch: z.input<typeof correctSchema>, reason: string): Promise<ActionResult> {
  const parsed = correctSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc("attendance_correct", { p_id: id, p: parsed.data, p_reason: reason });
}

export async function closeAttendanceDay(date: string): Promise<ActionResult<number>> {
  if (!isoDate.safeParse(date).success) return { ok: false, error: "Invalid date" };
  return callRpc<number>("attendance_close_day", { p_date: date });
}

/** Detach photos past the retention period, then delete the files from private storage. */
export async function expireAttendancePhotos(): Promise<ActionResult<number>> {
  const res = await callRpc<string[]>("attendance_expire_photos", {});
  if (!res.ok) return res;
  const paths = res.data ?? [];
  if (paths.length && hasAdminKey()) {
    const admin = createAdminClient();
    for (let i = 0; i < paths.length; i += 100) await admin.storage.from("attendance").remove(paths.slice(i, i + 100));
  }
  return { ok: true, data: paths.length };
}

const leaveSchema = z.object({ employee_id: uuid, leave_type: z.enum(["annual", "sick", "emergency", "unpaid", "other"]), start_date: isoDate, end_date: isoDate, is_paid: z.boolean(), reason: optText(300) });
export async function addLeave(input: z.input<typeof leaveSchema>): Promise<ActionResult> {
  const parsed = leaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  if (parsed.data.end_date < parsed.data.start_date) return { ok: false, error: "End date is before start date" };
  return guarded("employees.manage", async ({ supabase }) => {
    must(await supabase.from("leave_records").insert({ ...parsed.data, status: "approved", is_paid: parsed.data.leave_type === "unpaid" ? false : parsed.data.is_paid }));
    return undefined;
  });
}

export async function setLeaveStatus(id: string, status: "approved" | "rejected"): Promise<ActionResult> {
  return guarded("employees.manage", async ({ supabase }) => {
    must(await supabase.from("leave_records").update({ status }).eq("id", id));
    return undefined;
  });
}

export async function addHoliday(date: string, name_en: string, name_ar: string): Promise<ActionResult> {
  if (!isoDate.safeParse(date).success || name_en.trim().length < 2) return { ok: false, error: "Enter a date and a name" };
  return guarded("employees.manage", async ({ supabase }) => {
    must(await supabase.from("holidays").insert({ holiday_date: date, name_en: name_en.trim(), name_ar: name_ar.trim() || name_en.trim() }));
    return undefined;
  });
}

export async function removeHoliday(id: string): Promise<ActionResult> {
  return guarded("employees.manage", async ({ supabase }) => {
    must(await supabase.from("holidays").delete().eq("id", id));
    return undefined;
  });
}

export async function generatePayroll(start: string, end: string, notes: string): Promise<ActionResult<string>> {
  if (!isoDate.safeParse(start).success || !isoDate.safeParse(end).success) return { ok: false, error: "Invalid period" };
  return callRpc<string>("payroll_generate", { p_start: start, p_end: end, p_notes: notes || null });
}

const itemSchema = z.object({
  bonus: z.coerce.number().min(0).optional(),
  other_deduction: z.coerce.number().min(0).optional(),
  late_deduction: z.coerce.number().min(0).optional(),
  absence_deduction: z.coerce.number().min(0).optional(),
  advance_deduction: z.coerce.number().min(0).optional(),
  notes: optText(300),
});
export async function updatePayrollItem(id: string, patch: z.input<typeof itemSchema>): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc("payroll_item_update", { p_id: id, p: parsed.data });
}

export async function approvePayroll(id: string): Promise<ActionResult> {
  return callRpc("payroll_approve", { p_run: id });
}

export async function cancelPayroll(id: string, reason: string): Promise<ActionResult> {
  return callRpc("payroll_cancel", { p_run: id, p_reason: reason });
}
