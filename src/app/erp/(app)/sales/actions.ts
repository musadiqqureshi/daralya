"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isoDate, money, optText, qty, uuid } from "@/lib/erp/schemas";
import { callRpc } from "@/lib/erp/server";

const schema = z.object({
  customer_id: uuid,
  storage_id: uuid,
  driver_id: uuid.nullable().optional(),
  date: isoDate,
  notes: optText(1000),
  discount_amount: money.default(0),
  lines: z.array(z.object({ product_id: uuid, qty, unit_price: money, discount_amount: money.default(0) })).min(1),
  payment: z.object({ amount: money, method_id: uuid, money_account_id: uuid, reference: optText(120), proof_path: optText(300) }).nullable().optional(),
  delivery: z.object({ scheduled_date: isoDate, address: optText(300), notes: optText(300) }).nullable().optional(),
});
export type SaleInput = z.input<typeof schema>;

export async function createSale(input: SaleInput): Promise<ActionResult<string>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const p = parsed.data;
  if (p.payment && !(p.payment.amount > 0)) p.payment = null;
  if (!p.delivery) delete p.delivery;
  return callRpc<string>("sale_create", { p });
}

const returnSchema = z.object({
  sale_id: uuid,
  date: isoDate,
  reason: z.string().trim().min(3).max(500),
  lines: z.array(z.object({ sale_item_id: uuid, qty: z.coerce.number().min(0) })),
  refund: z.object({ amount: money, method_id: uuid, money_account_id: uuid }).nullable().optional(),
});
export async function returnSale(input: z.input<typeof returnSchema>): Promise<ActionResult<string>> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const p = { ...parsed.data, lines: parsed.data.lines.filter((l) => l.qty > 0) };
  if (!p.refund || !(p.refund.amount > 0)) delete p.refund;
  return callRpc<string>("sale_return_create", { p });
}

export async function cancelSale(id: string, reason: string): Promise<ActionResult> {
  return callRpc("sale_cancel", { p_id: id, p_reason: reason });
}
