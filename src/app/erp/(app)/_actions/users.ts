"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionResult } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { credentialsEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { uuid } from "@/lib/erp/schemas";
import { getDictionary } from "@/lib/i18n/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["owner", "manager", "accountant", "sales", "warehouse", "driver"] as const;

async function guard() {
  const session = await getSession();
  const dict = await getDictionary();
  if (!session?.can("users.manage")) return { error: dict.common.permissionDenied } as const;
  if (!hasAdminKey()) return { error: dict.erp.users.needsKey } as const;
  return { session } as const;
}

async function mailCredentials(u: { name: string; email: string; password: string; role: string; reset?: boolean }, sentBy: string) {
  const { data: st } = await createAdminClient().from("settings").select("company_name_en, company_name_ar, phone, whatsapp, email, address_en").eq("id", 1).single();
  const { subject, html } = credentialsEmail({ name_en: st?.company_name_en ?? "Dar Al-Aaliya Dates", name_ar: st?.company_name_ar ?? "دار العالية للتمور", phone: st?.phone, whatsapp: st?.whatsapp, email: st?.email, address_en: st?.address_en }, u);
  const res = await sendEmail({ to: u.email, subject, html, kind: "credentials", sentBy });
  return res.ok;
}

const tempPassword = () => `${randomBytes(6).toString("base64url")}-${randomBytes(3).toString("hex")}`;

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  driver_id: uuid.nullable().optional(),
  employee_id: uuid.nullable().optional(),
});

export async function createUser(input: z.input<typeof createSchema>): Promise<ActionResult<{ password: string | null; emailed: boolean }>> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error! };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const v = parsed.data;
  if (v.role === "owner" && g.session.profile.role !== "owner") return { ok: false, error: "Only an owner can create another owner." };
  const admin = createAdminClient();
  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({ email: v.email, password, email_confirm: true, user_metadata: { full_name: v.full_name } });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Could not create the user" };
  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id,
    full_name: v.full_name,
    email: v.email,
    phone: v.phone || null,
    role: v.role,
    driver_id: v.driver_id ?? null,
    employee_id: v.employee_id ?? null,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: friendlyError(pErr) };
  }
  if (v.employee_id) await admin.from("employees").update({ user_id: data.user.id }).eq("id", v.employee_id);
  revalidatePath("/erp/users");
  const dict = await getDictionary();
  const emailed = await mailCredentials({ name: v.full_name, email: v.email, password, role: dict.roles[v.role] }, g.session.userId);
  // the password is only shown on screen when the email could not be sent
  return { ok: true, data: { password: emailed ? null : password, emailed }, message: emailed ? dict.erp.users.emailedCredentials : dict.erp.users.created };
}

const updateSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  is_active: z.boolean(),
  phone: z.string().trim().max(40).optional().nullable(),
  driver_id: uuid.nullable().optional(),
  employee_id: uuid.nullable().optional(),
});

export async function updateUser(id: string, input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error! };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const v = parsed.data;
  if (id === g.session.userId && (v.role !== g.session.profile.role || !v.is_active)) return { ok: false, error: "You cannot change your own role or deactivate yourself." };
  if (v.role === "owner" && g.session.profile.role !== "owner") return { ok: false, error: "Only an owner can grant the owner role." };
  // writes go through the user's own session so RLS + audit triggers record who did it
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(v).eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  if (v.employee_id) await createAdminClient().from("employees").update({ user_id: id }).eq("id", v.employee_id);
  revalidatePath("/erp/users");
  return { ok: true };
}

export async function resetPassword(id: string): Promise<ActionResult<{ password: string | null; emailed: boolean }>> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error! };
  const password = tempPassword();
  const admin = createAdminClient();
  const { data: user, error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: error.message };
  const { data: profile } = await admin.from("profiles").select("full_name, role").eq("id", id).single();
  const dict = await getDictionary();
  const emailed = user.user.email
    ? await mailCredentials({ name: profile?.full_name ?? "", email: user.user.email, password, role: dict.roles[(profile?.role ?? "sales") as "sales"], reset: true }, g.session.userId)
    : false;
  return { ok: true, data: { password: emailed ? null : password, emailed }, message: emailed ? dict.erp.users.emailedCredentials : dict.erp.users.passwordReset };
}

export async function setUserPermission(userId: string, permission: string, mode: "grant" | "deny" | "inherit"): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.can("users.manage")) return { ok: false, error: "Permission denied" };
  const supabase = await createClient();
  const { error } =
    mode === "inherit"
      ? await supabase.from("user_permissions").delete().eq("user_id", userId).eq("permission", permission)
      : await supabase.from("user_permissions").upsert({ user_id: userId, permission, granted: mode === "grant" }, { onConflict: "user_id,permission" });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/erp/users");
  return { ok: true };
}

/** Signed-in user changes their own password. */
export async function changeOwnPassword(password: string): Promise<ActionResult> {
  if (password.length < 10) return { ok: false, error: "Use at least 10 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
