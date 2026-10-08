import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getStaffNames } from "@/lib/erp/lookups";
import { readRange } from "@/lib/erp/range";
import { addDays } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AuditTable, type AuditRow } from "./audit-table";

export default async function AuditPage(props: PageProps<"/erp/audit">) {
  const session = await requireSession();
  if (!session.can("audit.view")) return <NoAccess />;
  const { from, to } = readRange(await props.searchParams, "today");
  const dict = await getDictionary();
  const supabase = await createClient();
  const [{ data }, names] = await Promise.all([
    supabase.from("audit_logs").select("id, at, user_id, action, table_name, record_id, reason, old_data, new_data").gte("at", `${from}T00:00:00+03:00`).lt("at", `${addDays(to, 1)}T00:00:00+03:00`).order("at", { ascending: false }).limit(2000),
    getStaffNames(),
  ]);
  const rows: AuditRow[] = (data ?? []).map((r) => ({ ...r, user: r.user_id ? names[r.user_id] ?? r.user_id.slice(0, 8) : "system" }));
  return (
    <>
      <PageHeader title={dict.erp.audit.title} description={dict.erp.audit.subtitle} actions={<DateRangeFilter from={from} to={to} />} />
      <AuditTable rows={rows} />
    </>
  );
}
