"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isoDate, money, optText, uuid } from "@/lib/erp/schemas";
import { callRpc, guarded, must } from "@/lib/erp/server";

const accountSchema = z.object({
  id: uuid.optional(),
  name_en: z.string().trim().min(2).max(80),
  name_ar: z.string().trim().min(1).max(80),
  kind: z.enum(["cash", "bank"]),
  bank_name: optText(80),
  account_no: optText(40),
  iban: optText(40),
  opening_balance: z.coerce.number().default(0),
  opening_date: isoDate.optional(),
  is_active: z.boolean().default(true),
});
export async function saveAccount(input: z.input<typeof accountSchema>): Promise<ActionResult<string>> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const { id, opening_balance, opening_date, ...row } = parsed.data;
  return guarded("accounts.manage", async ({ supabase }) => {
    if (id) {
      must(await supabase.from("money_accounts").update(row).eq("id", id));
      return id;
    }
    return must(await supabase.from("money_accounts").insert({ ...row, opening_balance, ...(opening_date ? { opening_date } : {}) }).select("id").single()).id as string;
  });
}

const transferSchema = z.object({ from_account_id: uuid, to_account_id: uuid, amount: z.coerce.number().positive(), date: isoDate, reference: optText(120), notes: optText(300) });
export async function transferMoney(input: z.input<typeof transferSchema>): Promise<ActionResult<string>> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc<string>("money_transfer_create", { p: parsed.data });
}

export async function closeCash(account: string, date: string, counted: number, notes: string): Promise<ActionResult<string>> {
  if (!uuid.safeParse(account).success || !isoDate.safeParse(date).success) return { ok: false, error: "Invalid input" };
  return callRpc<string>("cash_closing_create", { p_account: account, p_date: date, p_counted: counted, p_notes: notes || null });
}

const expenseSchema = z.object({
  date: isoDate,
  category_id: uuid,
  amount: z.coerce.number().positive(),
  vat_amount: money.default(0),
  money_account_id: uuid,
  method_id: uuid.nullable().optional(),
  payee: optText(120),
  description: optText(500),
  reference: optText(120),
  receipt_path: optText(300),
});
export async function createExpense(input: z.input<typeof expenseSchema>): Promise<ActionResult<string>> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc<string>("expense_create", { p: parsed.data });
}

export async function cancelExpense(id: string, reason: string): Promise<ActionResult> {
  return callRpc("expense_cancel", { p_id: id, p_reason: reason });
}
