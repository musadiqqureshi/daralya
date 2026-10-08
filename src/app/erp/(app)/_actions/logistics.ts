"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isoDate, optText, uuid } from "@/lib/erp/schemas";
import { callRpc, guarded, must } from "@/lib/erp/server";

const driverSchema = z.object({
  id: uuid.optional(),
  kind: z.enum(["driver", "agent"]),
  name: z.string().trim().min(2).max(120),
  name_ar: optText(120),
  phone: optText(40),
  vehicle_type: optText(60),
  vehicle_no: optText(30),
  commission_type: z.enum(["none", "fixed", "percent", "per_kg"]),
  commission_value: z.coerce.number().min(0).max(100000),
  notes: optText(500),
});
export type DriverInput = z.input<typeof driverSchema>;

export async function saveDriver(input: DriverInput): Promise<ActionResult<string>> {
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { id, ...row } = parsed.data;
  if (row.commission_type === "percent" && row.commission_value > 100) return { ok: false, error: "Percentage cannot exceed 100" };
  return guarded("drivers.manage", async ({ supabase }) => {
    if (id) {
      must(await supabase.from("drivers").update(row).eq("id", id));
      return id;
    }
    return must(await supabase.from("drivers").insert(row).select("id").single()).id as string;
  });
}

const deliverySchema = z.object({ customer_id: uuid, driver_id: uuid.nullable().optional(), vehicle_no: optText(30), scheduled_date: isoDate, address: optText(300), notes: optText(300), sale_id: uuid.nullable().optional() });
export async function createDelivery(input: z.input<typeof deliverySchema>): Promise<ActionResult<string>> {
  const parsed = deliverySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc<string>("delivery_create", { p: parsed.data });
}

const updateSchema = z.object({
  status: z.enum(["pending", "in_transit", "delivered", "failed", "cancelled"]),
  note: optText(300),
  recipient_name: optText(120),
  proof_photo_path: optText(300),
  signature_path: optText(300),
  driver_id: uuid.nullable().optional(),
  vehicle_no: optText(30),
});
export async function updateDelivery(id: string, input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const p = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== null && v !== undefined));
  return callRpc("delivery_update", { p_id: id, p });
}
