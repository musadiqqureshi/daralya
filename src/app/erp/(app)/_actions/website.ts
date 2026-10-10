"use server";
import { revalidatePath, updateTag } from "next/cache";
import { SITE_TAG } from "@/lib/site/data";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { callRpc, guarded, must } from "@/lib/erp/server";
import { contentKeys } from "@/lib/site/content";

const keySchema = z.enum(contentKeys as [string, ...string[]]);

export async function saveDraft(key: string, content: unknown): Promise<ActionResult> {
  if (!keySchema.safeParse(key).success) return { ok: false, error: "Unknown section" };
  const json = JSON.stringify(content ?? {});
  if (json.length > 100_000) return { ok: false, error: "Content is too large" };
  return guarded("website.manage", async ({ supabase }) => {
    must(await supabase.from("site_content").upsert({ key, draft: JSON.parse(json) }, { onConflict: "key" }));
    return undefined;
  });
}

export async function publishSection(key: string, content: unknown): Promise<ActionResult> {
  const saved = await saveDraft(key, content);
  if (!saved.ok) return saved;
  const res = await callRpc<undefined>("site_content_publish", { p_key: key });
  if (res.ok) {
    updateTag(SITE_TAG);
    revalidatePath("/", "layout");
  }
  return res;
}

export async function updateInquiry(id: string, patch: { status?: "new" | "in_progress" | "closed"; internal_notes?: string }): Promise<ActionResult> {
  return guarded("inquiries.view", async ({ supabase }) => {
    must(await supabase.from("contact_inquiries").update(patch).eq("id", id));
    return undefined;
  });
}
