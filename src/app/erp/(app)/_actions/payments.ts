"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getMoneyAccounts, getPaymentMethods } from "@/lib/erp/lookups";
import { isoDate, optText, PURPOSES, uuid } from "@/lib/erp/schemas";
import { callRpc } from "@/lib/erp/server";


const schema = z.object({
  purpose: z.enum(PURPOSES),
  party_id: uuid,
  investment_id: uuid.optional().nullable(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  method_id: uuid,
  money_account_id: uuid,
  date: isoDate,
  reference: optText(120),
  proof_path: optText(300),
  notes: optText(500),
  allocations: z.array(z.object({ doc_type: z.enum(["sale", "purchase", "payroll_item"]), doc_id: uuid, amount: z.coerce.number().positive() })).optional(),
  auto_allocate: z.boolean().optional(),
});

export type PaymentInput = z.input<typeof schema>;

export async function recordPayment(input: PaymentInput): Promise<ActionResult<string>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };
  return callRpc<string>("payment_create", { p: parsed.data });
}

export async function verifyPayment(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid payment" };
  return callRpc("payment_verify", { p_id: id });
}

export async function cancelPayment(id: string, reason: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid payment" };
  return callRpc("payment_cancel", { p_id: id, p_reason: reason });
}

export async function loadPaymentOptions() {
  const [accounts, methods] = await Promise.all([getMoneyAccounts(), getPaymentMethods()]);
  return { accounts, methods };
}
