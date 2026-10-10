"use server";
import { after } from "next/server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isoDate, money, optText, qty, uuid } from "@/lib/erp/schemas";
import { getSession } from "@/lib/auth";
import { CURRENCIES } from "@/lib/erp/currency";
import { getRates } from "@/lib/erp/fx";
import { mailInvoice } from "@/lib/erp/mailers";
import { callRpc } from "@/lib/erp/server";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  customer_id: uuid,
  currency: z.enum(CURRENCIES).default("SAR"),
  customer_email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
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

/**
 * Prices and discounts arrive in the chosen currency. The database converts them
 * to SAR with the stored live rate (refreshed here first) and keeps the original.
 */
export async function createSale(input: SaleInput, opts: { fast?: boolean } = {}): Promise<ActionResult<string>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { customer_email, ...p } = parsed.data;
  if (p.payment && !(p.payment.amount > 0)) p.payment = null;
  if (!p.delivery) delete p.delivery;
  if (p.currency !== "SAR") await getRates();

  const supabase = await createClient();
  // capture a customer email given at the counter (only fills an empty field)
  if (customer_email) await supabase.from("customers").update({ email: customer_email }).eq("id", p.customer_id).is("email", null);

  const res = await callRpc<string>("sale_create_fx", { p }, opts.fast ? false : []);
  if (!res.ok || !res.data) return res;
  const dict = await getDictionary();
  const session = await getSession();
  const saleId = res.data;
  // the emailed invoice goes out after the response, so the counter never waits for the mail server
  after(() => mailInvoice(supabase, saleId, { auto: true, sentBy: session?.userId }));
  return { ...res, message: dict.erp.sales.posted };
}

export async function emailInvoice(id: string, to?: string): Promise<ActionResult> {
  const session = await getSession();
  const dict = await getDictionary();
  if (!session?.can("sales.view")) return { ok: false, error: dict.common.permissionDenied };
  const target = to?.trim() ? z.string().email().safeParse(to.trim()) : null;
  if (target && !target.success) return { ok: false, error: dict.common.email };
  const res = await mailInvoice(await createClient(), id, { sentBy: session.userId, to: target?.data });
  return res.ok ? { ok: true, message: dict.erp.sales.emailed } : { ok: false, error: res.error ?? dict.common.error };
}

export async function refreshRatesAction() {
  return getRates({ force: true });
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
