import "server-only";
import { loadStatement } from "@/lib/erp/loaders";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

const TABLE = { customer: "customers", supplier: "suppliers", driver: "drivers", employee: "employees", investor: "investors" } as const;
export type StatementType = keyof typeof TABLE;

export async function statementData(type: string, id: string, from: string, to: string, locale: Locale) {
  if (!(type in TABLE)) return null;
  const supabase = await createClient();
  const cols = type === "employee" ? "id, code:employee_no, name:full_name, name_ar:full_name_ar, phone" : "id, code, name, name_ar, phone";
  const col = type === "investor" ? "id, code:investor_no, name, name_ar, phone" : cols;
  const { data: party } = await supabase.from(TABLE[type as StatementType]).select(col).eq("id", id).maybeSingle();
  if (!party) return null;
  const rows = await loadStatement(supabase, type as StatementType, id, from, to);
  const p = party as unknown as { code: string; name: string; name_ar: string | null; phone: string | null };
  return { party: { ...p, display: locale === "ar" ? p.name_ar || p.name : p.name }, rows };
}
