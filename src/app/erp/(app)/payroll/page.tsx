import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { GenerateDialog, RunsTable, type RunRow } from "./payroll-ui";

export default async function PayrollPage() {
  const session = await requireSession();
  if (!session.can("payroll.view")) return <NoAccess />;
  const dict = await getDictionary();
  const supabase = await createClient();
  const { data } = await supabase.from("payroll_runs").select("id, run_no, period_start, period_end, status, total_net, payroll_items(paid_amount)").order("period_start", { ascending: false });
  const rows: RunRow[] = ((data ?? []) as unknown as (Omit<RunRow, "employees" | "paid"> & { payroll_items: { paid_amount: number }[] })[]).map((r) => ({
    ...r,
    total_net: Number(r.total_net),
    employees: r.payroll_items.length,
    paid: r.payroll_items.reduce((s, i) => s + Number(i.paid_amount), 0),
  }));
  return (
    <>
      <PageHeader title={dict.erp.payroll.title} description={dict.erp.payroll.subtitle} actions={session.can("payroll.prepare") && <GenerateDialog />} />
      <RunsTable rows={rows} />
    </>
  );
}
