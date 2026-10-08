"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).regex(/^[+\d\s()-]*$/).optional().or(z.literal("")),
  email: z.string().trim().max(200).email().optional().or(z.literal("")),
  category: z.enum(["general", "wholesale", "product", "export", "other"]),
  product: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(4000),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot
});

export async function submitInquiry(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const dict = await getDictionary();
  const raw = Object.fromEntries(form.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = dict.common.required;
    return { ok: false, error: dict.common.error, fieldErrors };
  }
  const v = parsed.data;
  if (v.website) return { ok: true, message: dict.site.contact.success }; // silently drop bots
  if (!v.phone && !v.email) return { ok: false, error: dict.site.contact.contactNeeded, fieldErrors: { phone: dict.site.contact.contactNeeded } };
  if (!hasAdminKey()) return { ok: false, error: dict.auth.notConfigured };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`${ip}:${process.env.CRON_SECRET ?? "dar-al-aaliya"}`).digest("hex").slice(0, 32);
  const admin = createAdminClient();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("contact_inquiries").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= 5) return { ok: false, error: dict.site.contact.rateLimited };

  let productId: string | null = null;
  if (v.product) {
    const { data } = await admin.from("products").select("id").eq("slug", v.product).eq("is_published", true).maybeSingle();
    productId = data?.id ?? null;
  }
  const { error } = await admin.from("contact_inquiries").insert({
    name: v.name,
    company: v.company || null,
    phone: v.phone || null,
    email: v.email || null,
    category: v.category,
    product_id: productId,
    message: v.message,
    locale: await getLocale(),
    ip_hash: ipHash,
  });
  if (error) return { ok: false, error: dict.common.error };
  return { ok: true, message: dict.site.contact.success };
}
