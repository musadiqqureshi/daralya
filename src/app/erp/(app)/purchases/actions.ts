"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isoDate, money, optText, qty, uuid } from "@/lib/erp/schemas";
import { callRpc } from "@/lib/erp/server";

const schema = z.object({
  supplier_id: uuid,
  date: isoDate,
  supplier_invoice_no: optText(60),
  storage_id: uuid,
  notes: optText(1000),
  transport_cost: money.default(0),
  loading_cost: money.default(0),
  other_cost: money.default(0),
  extras_paid_from: uuid.nullable().optional(),
  vat_amount: money.default(0),
  lines: z.array(z.object({ product_id: uuid, qty, unit_price: money, storage_id: uuid.optional().nullable(), expiry_date: isoDate.optional().nullable() })).min(1),
  payment: z
    .object({ amount: money, method_id: uuid, money_account_id: uuid, reference: optText(120), proof_path: optText(300) })
    .optional()
    .nullable(),
});
export type PurchaseInput = z.input<typeof schema>;

export async function createPurchase(input: PurchaseInput): Promise<ActionResult<string>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const p = parsed.data;
  if (p.payment && !(p.payment.amount > 0)) p.payment = null;
  return callRpc<string>("purchase_create", { p });
}

const returnSchema = z.object({
  purchase_id: uuid,
  date: isoDate,
  reason: z.string().trim().min(3).max(500),
  lines: z.array(z.object({ purchase_item_id: uuid, qty: z.coerce.number().min(0), storage_id: uuid.optional().nullable() })),
});
export async function returnPurchase(input: z.input<typeof returnSchema>): Promise<ActionResult<string>> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return callRpc<string>("purchase_return_create", { p: { ...parsed.data, lines: parsed.data.lines.filter((l) => l.qty > 0) } });
}

export async function cancelPurchase(id: string, reason: string): Promise<ActionResult> {
  return callRpc("purchase_cancel", { p_id: id, p_reason: reason });
}
