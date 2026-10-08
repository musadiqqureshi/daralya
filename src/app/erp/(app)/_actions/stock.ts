"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isoDate, optText, qty, uuid } from "@/lib/erp/schemas";
import { callRpc, guarded, must } from "@/lib/erp/server";

const adjSchema = z.object({
  storage_id: uuid,
  date: isoDate,
  adj_type: z.enum(["damage", "wastage", "adjustment_in", "adjustment_out"]),
  reason: z.string().trim().min(3).max(500),
  lines: z.array(z.object({ product_id: uuid, batch_id: uuid.nullable().optional(), qty, unit_cost: z.coerce.number().min(0).nullable().optional() })).min(1),
});
export async function requestAdjustment(input: z.input<typeof adjSchema>): Promise<ActionResult<string>> {
  const parsed = adjSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc<string>("stock_adjustment_request", { p: parsed.data });
}

export async function reviewAdjustment(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  return callRpc("stock_adjustment_review", { p_id: id, p_approve: approve, p_note: note ?? null });
}

const transferSchema = z.object({
  from_storage_id: uuid,
  to_storage_id: uuid,
  date: isoDate,
  notes: optText(500),
  lines: z.array(z.object({ product_id: uuid, batch_id: uuid.nullable().optional(), qty })).min(1),
});
export async function transferStock(input: z.input<typeof transferSchema>): Promise<ActionResult<string>> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc<string>("stock_transfer_create", { p: parsed.data });
}

const openingSchema = z.object({
  storage_id: uuid,
  date: isoDate,
  lines: z.array(z.object({ product_id: uuid, qty, unit_cost: z.coerce.number().min(0), expiry_date: isoDate.nullable().optional() })).min(1),
});
export async function loadOpeningStock(input: z.input<typeof openingSchema>): Promise<ActionResult<string>> {
  const parsed = openingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc<string>("stock_opening_create", { p: parsed.data });
}

const storageSchema = z.object({
  id: uuid.optional(),
  name_en: z.string().trim().min(2).max(80),
  name_ar: z.string().trim().min(1).max(80),
  location: optText(160),
  capacity_kg: z.union([z.coerce.number().positive(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  temp_min: z.union([z.coerce.number(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  temp_max: z.union([z.coerce.number(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  is_active: z.boolean().default(true),
});
export async function saveStorage(input: z.input<typeof storageSchema>): Promise<ActionResult<string>> {
  const parsed = storageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const { id, ...row } = parsed.data;
  return guarded("storage.manage", async ({ supabase }) => {
    if (id) {
      must(await supabase.from("storages").update(row).eq("id", id));
      return id;
    }
    return must(await supabase.from("storages").insert(row).select("id").single()).id as string;
  });
}

const tempSchema = z.object({ storage_id: uuid, temperature_c: z.coerce.number().min(-40).max(60), humidity_pct: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)), notes: optText(300) });
export async function logTemperature(input: z.input<typeof tempSchema>): Promise<ActionResult> {
  const parsed = tempSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return guarded("storage.temperature", async ({ supabase }) => {
    must(await supabase.from("temperature_logs").insert(parsed.data));
    return undefined;
  });
}
