import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { PartyTable, type PartyListRow } from "@/components/erp/party-table";
import { requireSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function SuppliersPage() {
  const session = await requireSession();
  if (!session.can("suppliers.view")) return <NoAccess />;
  const dict = await getDictionary();
  const supabase = await createClient();
  const [{ data: parties }, { data: balances }, { data: docs }, drivers] = await Promise.all([
    supabase.from("suppliers").select("id, code, name, name_ar, phone, city, is_active").order("name"),
    supabase.from("v_party_balances").select("party_id, balance").eq("party_type", "supplier").eq("gl_code", "2100"),
    supabase.from("purchases").select("supplier_id").eq("status", "posted"),
    Promise.resolve({ data: null }),
  ]);
  const bal = new Map((balances ?? []).map((b) => [b.party_id as string, Number(b.balance) * -1]));
  const count = new Map<string, number>();
  for (const d of (docs ?? []) as Record<string, string>[]) count.set(d.supplier_id, (count.get(d.supplier_id) ?? 0) + 1);
  const rows: PartyListRow[] = (parties ?? []).map((p) => ({ ...p, balance: bal.get(p.id) ?? 0, docs: count.get(p.id) ?? 0 }));
  const t = dict.erp.suppliers;
  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} />
      <PartyTable
        kind="supplier"
        rows={rows}
        canManage={session.can("suppliers.manage")}
        drivers={((drivers.data ?? []) as { id: string; name: string; kind: string }[]).map((d) => ({ value: d.id, label: d.name, sub: dict.erp.driverKinds[d.kind as "driver" | "agent"] }))}
      />
    </>
  );
}
