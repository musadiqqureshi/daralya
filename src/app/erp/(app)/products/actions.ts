"use server";
import { revalidatePath, updateTag } from "next/cache";
import { SITE_TAG } from "@/lib/site/data";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { optText, uuid } from "@/lib/erp/schemas";
import { guarded, must } from "@/lib/erp/server";

const spec = z.object({ label_en: z.string().trim().max(80), label_ar: z.string().trim().max(80), value_en: z.string().trim().max(200), value_ar: z.string().trim().max(200) });
const schema = z.object({
  id: uuid.optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  name_en: z.string().trim().min(2).max(120),
  name_ar: z.string().trim().min(1).max(120),
  name_ur: optText(120),
  variety: z.string().trim().min(1).max(60),
  grade: optText(60),
  unit: z.enum(["kg", "carton", "box", "tray", "piece"]),
  weight_kg: z.coerce.number().positive().max(10000),
  barcode: optText(64),
  selling_price: z.coerce.number().min(0),
  wholesale_price: z.union([z.literal("").transform(() => null), z.null(), z.coerce.number().min(0)]).optional(),
  purchase_price: z.coerce.number().min(0).optional(),
  min_stock: z.coerce.number().min(0),
  is_active: z.boolean(),
  is_published: z.boolean(),
  is_featured: z.boolean(),
  public_availability: z.enum(["available", "limited", "seasonal", "on_request"]),
  packaging_en: optText(200),
  packaging_ar: optText(200),
  description_en: optText(2000),
  description_ar: optText(2000),
  specs: z.array(spec).max(20),
  sort_order: z.coerce.number().int().min(0).max(9999),
});
export type ProductInput = z.input<typeof schema>;

export async function saveProduct(input: ProductInput): Promise<ActionResult<string>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { id, purchase_price, ...row } = parsed.data;
  const res = await guarded("products.manage", async ({ supabase }) => {
    const payload = { ...row, specs: row.specs.filter((s) => s.label_en || s.label_ar), ...(purchase_price !== undefined ? { purchase_price } : {}) };
    if (id) {
      must(await supabase.from("products").update(payload).eq("id", id));
      return id;
    }
    return must(await supabase.from("products").insert(payload).select("id").single()).id as string;
  });
  if (res.ok) {
    updateTag(SITE_TAG);
    revalidatePath("/", "layout");
  }
  return res;
}

export async function addProductImage(productId: string, src: string, alt_en: string | null, alt_ar: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success || !src || src.length > 500) return { ok: false, error: "Invalid image" };
  if (/^https?:\/\//.test(src) && !/^https:\/\//.test(src)) return { ok: false, error: "Use an https image URL" };
  const res = await guarded(["products.manage", "website.manage"], async ({ supabase }) => {
    const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
    must(await supabase.from("product_images").insert({ product_id: productId, src, alt_en, alt_ar, sort_order: count ?? 0 }));
    return undefined;
  });
  if (res.ok) {
    updateTag(SITE_TAG);
    revalidatePath("/", "layout");
  }
  return res;
}

export async function removeProductImage(imageId: string): Promise<ActionResult> {
  const res = await guarded(["products.manage", "website.manage"], async ({ supabase }) => {
    const img = must(await supabase.from("product_images").select("src").eq("id", imageId).single());
    must(await supabase.from("product_images").delete().eq("id", imageId));
    if (!/^https?:\/\//.test(img.src)) await supabase.storage.from("products").remove([img.src]);
    return undefined;
  });
  if (res.ok) {
    updateTag(SITE_TAG);
    revalidatePath("/", "layout");
  }
  return res;
}

export async function moveProductImage(productId: string, imageId: string, dir: -1 | 1): Promise<ActionResult> {
  const res = await guarded(["products.manage", "website.manage"], async ({ supabase }) => {
    const imgs = must(await supabase.from("product_images").select("id, sort_order").eq("product_id", productId).order("sort_order").order("created_at"));
    const i = imgs.findIndex((x) => x.id === imageId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= imgs.length) return undefined;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    await Promise.all(imgs.map((x, k) => supabase.from("product_images").update({ sort_order: k }).eq("id", x.id)));
    return undefined;
  });
  if (res.ok) {
    updateTag(SITE_TAG);
    revalidatePath("/", "layout");
  }
  return res;
}

export async function setProductFlags(id: string, flags: { is_published?: boolean; is_featured?: boolean; is_active?: boolean }): Promise<ActionResult> {
  const res = await guarded(["products.manage", "website.manage"], async ({ supabase }) => {
    must(await supabase.from("products").update(flags).eq("id", id));
    return undefined;
  });
  if (res.ok) {
    updateTag(SITE_TAG);
    revalidatePath("/", "layout");
  }
  return res;
}
