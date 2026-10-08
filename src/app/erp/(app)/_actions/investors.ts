"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isoDate, optText, uuid } from "@/lib/erp/schemas";
import { callRpc, guarded, must } from "@/lib/erp/server";

const investorSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(120),
  name_ar: optText(120),
  phone: optText(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
  id_number: optText(40),
  address: optText(300),
  notes: optText(1000),
});
export type InvestorInput = z.input<typeof investorSchema>;
export async function saveInvestor(input: InvestorInput): Promise<ActionResult<string>> {
  const parsed = investorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const { id, ...row } = parsed.data;
  return guarded("investors.manage", async ({ supabase }) => {
    if (id) {
      must(await supabase.from("investors").update(row).eq("id", id));
      return id;
    }
    return must(await supabase.from("investors").insert(row).select("id").single()).id as string;
  });
}

const num = (min = 0, max = 100) => z.union([z.coerce.number().min(min).max(max), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v));
const investmentSchema = z.object({
  id: uuid.optional(),
  investor_id: uuid,
  model: z.enum(["profit_share", "project", "equity", "loan"]),
  project_name: optText(120),
  committed_amount: z.coerce.number().positive(),
  start_date: isoDate,
  end_date: isoDate.optional().nullable().or(z.literal("")).transform((v) => v || null),
  profit_share_pct: num(),
  profit_frequency: z.enum(["monthly", "quarterly", "yearly", "project"]),
  equity_pct: num(),
  terms: optText(2000),
  agreement_path: optText(300),
  notes: optText(1000),
  status: z.enum(["active", "closed"]).default("active"),
});
export type InvestmentInput = z.input<typeof investmentSchema>;
export async function saveInvestment(input: InvestmentInput): Promise<ActionResult<string>> {
  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { id, ...row } = parsed.data;
  return guarded("investors.manage", async ({ supabase }) => {
    if (id) {
      must(await supabase.from("investments").update(row).eq("id", id));
      return id;
    }
    return must(await supabase.from("investments").insert(row).select("id").single()).id as string;
  });
}

const allocSchema = z.object({
  investment_id: uuid,
  kind: z.enum(["allocation", "adjustment"]).default("allocation"),
  period_label: z.string().trim().min(1).max(60),
  period_start: isoDate.optional().nullable(),
  period_end: isoDate.optional().nullable(),
  basis_net_profit: z.coerce.number().optional().nullable(),
  share_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  amount: z.coerce.number().optional().nullable(),
  adjusts_id: uuid.optional().nullable(),
  reason: optText(500),
  notes: optText(500),
});
export async function createAllocation(input: z.input<typeof allocSchema>): Promise<ActionResult<string>> {
  const parsed = allocSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return callRpc<string>("profit_allocation_create", { p: parsed.data });
}
export async function approveAllocation(id: string): Promise<ActionResult> {
  return callRpc("profit_allocation_approve", { p_id: id });
}
export async function cancelAllocation(id: string, reason: string): Promise<ActionResult> {
  return callRpc("profit_allocation_cancel", { p_id: id, p_reason: reason });
}

/** Net profit from the books for a period, to help the owner decide the approved figure. */
export async function bookProfit(start: string, end: string): Promise<ActionResult<number>> {
  return guarded("reports.financial", async ({ supabase }) => {
    const rows = must(await supabase.rpc("report_profit_loss", { p_start: start, p_end: end })) as { type: string; amount: number }[];
    return rows.reduce((s, r) => s + (r.type === "income" ? Number(r.amount) : -Number(r.amount)), 0);
  });
}
