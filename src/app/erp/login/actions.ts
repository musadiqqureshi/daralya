"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getDictionary } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1), next: z.string().optional() });

export async function signIn(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const dict = await getDictionary();
  if (!isSupabaseConfigured) return { ok: false, error: dict.auth.notConfigured };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: dict.auth.invalid };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return { ok: false, error: dict.auth.invalid };
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: dict.auth.inactive };
  }
  const next = parsed.data.next && parsed.data.next.startsWith("/erp") ? parsed.data.next : "/erp";
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/erp/login");
}

export async function requestReset(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const dict = await getDictionary();
  const email = String(form.get("email") ?? "").trim();
  if (isSupabaseConfigured && z.string().email().safeParse(email).success) {
    const supabase = await createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/erp/auth/callback?next=/erp/profile` });
  }
  // same answer either way so account existence isn't revealed
  return { ok: true, message: dict.auth.resetSent };
}
