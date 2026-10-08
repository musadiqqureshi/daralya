import { notFound } from "next/navigation";
import { DateText } from "@/components/erp/money";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { StatusBadge } from "@/components/erp/status-badge";
import { requireSession } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { RunDetail, type ItemRow } from "../payroll-ui";

export default async function PayrollRunPage(props: PageProps<"/erp/payroll/[id]">) {
  const session = await requireSession();
  if (!session.can("payroll.view")) return <NoAccess />;
  const { id } = await props.params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const { data: run } = await supabase.from("payroll_runs").select("*").eq("id", id).maybeSingle();
  if (!run) notFound();
  const { data } = await supabase.from("payroll_items").select("*, employees(employee_no, full_name, full_name_ar)").eq("run_id", id);
  const items: ItemRow[] = ((data ?? []) as unknown as (Record<string, number | string | null> & { employees: { employee_no: string; full_name: string; full_name_ar: string | null } })[])
    .map((i) => {
      const num = (k: string) => Number(i[k] ?? 0);
      return {
        id: String(i.id),
        employee_id: String(i.employee_id),
        name: (locale === "ar" ? i.employees.full_name_ar || i.employees.full_name : i.employees.full_name) ?? "",
        employee_no: i.employees.employee_no,
        salary_type: String(i.salary_type),
        scheduled_days: num("scheduled_days"),
        present_days: num("present_days"),
        late_count: num("late_count"),
        late_minutes: num("late_minutes"),
        half_days: num("half_days"),
        absent_days: num("absent_days"),
        paid_leave_days: num("paid_leave_days"),
        unpaid_leave_days: num("unpaid_leave_days"),
        unrecorded_days: num("unrecorded_days"),
        worked_hours: num("worked_hours"),
        overtime_hours: num("overtime_hours"),
        base_earned: num("base_earned"),
        overtime_amount: num("overtime_amount"),
        late_deduction: num("late_deduction"),
        absence_deduction: num("absence_deduction"),
        half_day_deduction: num("half_day_deduction"),
        advance_balance: num("advance_balance"),
        advance_deduction: num("advance_deduction"),
        bonus: num("bonus"),
        other_deduction: num("other_deduction"),
        net_pay: num("net_pay"),
        paid_amount: num("paid_amount"),
        notes: (i.notes as string | null) ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader
        back={{ href: "/erp/payroll", label: dict.erp.payroll.title }}
        title={run.run_no}
        description={<span><DateText value={run.period_start} /> – <DateText value={run.period_end} /></span>}
        meta={<StatusBadge status={run.status} />}
      />
      {run.cancel_reason && <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm">{dict.common.cancelledReason.replace("{reason}", run.cancel_reason)}</p>}
      <RunDetail
        runId={id}
        status={run.status}
        items={items}
        canPrepare={session.can("payroll.prepare")}
        canApprove={session.can("payroll.approve")}
        canPay={session.can("payments.create") && session.can("payroll.prepare")}
      />
    </>
  );
}
