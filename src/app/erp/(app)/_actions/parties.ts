"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { optText, uuid } from "@/lib/erp/schemas";
import { guarded, must } from "@/lib/erp/server";

const base = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(160),
  name_ar: optText(160),
  phone: optText(40),
  whatsapp: optText(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
  address: optText(300),
  city: optText(80),
  vat_number: optText(30),
  notes: optText(1000),
  opening_balance: z.coerce.number().finite().optional(),
});
const customerSchema = base.extend({
  credit_limit: z.union([z.coerce.number().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  driver_id: uuid.optional().nullable().or(z.literal("")).transform((v) => v || null),
});

export type PartyInput = z.input<typeof customerSchema>;

export async function saveParty(kind: "customer" | "supplier", input: PartyInput): Promise<ActionResult<string>> {
  const schema = kind === "customer" ? customerSchema : base;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { id, opening_balance, ...row } = parsed.data as z.infer<typeof customerSchema>;
  const table = kind === "customer" ? "customers" : "suppliers";
  return guarded(`${kind}s.manage`, async ({ supabase }) => {
    if (id) {
      must(await supabase.from(table).update(row).eq("id", id));
      return id;
    }
    const created = must(await supabase.from(table).insert({ ...row, opening_balance: opening_balance ?? 0 }).select("id").single());
    return created.id as string;
  });
}

export async function setPartyActive(kind: "customer" | "supplier" | "driver", id: string, active: boolean): Promise<ActionResult> {
  const table = kind === "customer" ? "customers" : kind === "supplier" ? "suppliers" : "drivers";
  return guarded(`${kind}s.manage`, async ({ supabase }) => {
    must(await supabase.from(table).update({ is_active: active }).eq("id", id));
    return undefined;
  });
}
