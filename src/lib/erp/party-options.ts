import "server-only";
import type { Option } from "@/components/erp/entity-select";
import type { Session } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

/** Party option lists for the generic payment dialog, limited to what the user may pay. */
export async function partyOptions(session: Session, locale: Locale) {
  const supabase = await createClient();
  const ar = locale === "ar";
  const map: Partial<Record<"customer" | "supplier" | "driver" | "employee" | "investor", Option[]>> = {};
  const investmentMap: Record<string, Option[]> = {};
  const jobs: Promise<void>[] = [];
  const add = (key: keyof typeof map, table: string, cols: string, label: (r: Record<string, string | null>) => Option) =>
    jobs.push(
      (async () => {
        const { data } = await supabase.from(table).select(cols).limit(2000);
        map[key] = ((data ?? []) as unknown as Record<string, string | null>[]).map(label);
      })(),
    );
  if (session.can("customers.view")) add("customer", "customers", "id, code, name, name_ar", (r) => ({ value: r.id!, label: (ar ? r.name_ar || r.name : r.name) ?? "", sub: r.code ?? undefined }));
  if (session.can("suppliers.view")) add("supplier", "suppliers", "id, code, name, name_ar", (r) => ({ value: r.id!, label: (ar ? r.name_ar || r.name : r.name) ?? "", sub: r.code ?? undefined }));
  if (session.can("drivers.view")) add("driver", "drivers", "id, code, name, name_ar", (r) => ({ value: r.id!, label: (ar ? r.name_ar || r.name : r.name) ?? "", sub: r.code ?? undefined }));
  if (session.can("payroll.prepare")) add("employee", "employees", "id, employee_no, full_name, full_name_ar", (r) => ({ value: r.id!, label: (ar ? r.full_name_ar || r.full_name : r.full_name) ?? "", sub: r.employee_no ?? undefined }));
  if (session.can("investors.manage")) {
    add("investor", "investors", "id, investor_no, name, name_ar", (r) => ({ value: r.id!, label: (ar ? r.name_ar || r.name : r.name) ?? "", sub: r.investor_no ?? undefined }));
    jobs.push(
      (async () => {
        const { data } = await supabase.from("investments").select("id, investor_id, investment_no, model, project_name").eq("status", "active");
        for (const i of data ?? []) (investmentMap[i.investor_id] ??= []).push({ value: i.id, label: `${i.investment_no}${i.project_name ? ` · ${i.project_name}` : ""}`, sub: i.model });
      })(),
    );
  }
  await Promise.all(jobs);
  return { map, investmentMap };
}
