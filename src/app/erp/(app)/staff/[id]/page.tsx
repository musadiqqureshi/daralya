import Image from "next/image";
import { notFound } from "next/navigation";
import { HandCoins, Pencil, UserRound } from "lucide-react";
import { PaymentsTable } from "@/components/erp/doc-tables";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { PaymentDialog } from "@/components/erp/payment-dialog";
import { KeyValues, Section } from "@/components/erp/section";
import { StatCard } from "@/components/erp/stat-card";
import { StatusBadge } from "@/components/erp/status-badge";
import { UrlTabs } from "@/components/erp/url-tabs";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { getStaffNames } from "@/lib/erp/lookups";
import { loadPayments } from "@/lib/erp/loaders";
import { addDays, fmtDate, fmtMoney, todayRiyadh } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AttendanceTable, type AttRow } from "../../attendance/attendance-ui";
import { EmployeeForm } from "../staff-ui";

export default async function EmployeePage(props: PageProps<"/erp/staff/[id]">) {
  const session = await requireSession();
  if (!session.can("employees.view")) return <NoAccess />;
  const { id } = await props.params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const { data: e } = await supabase.from("employees").select("*, work_schedules(name, start_time, end_time), manager:employees!employees_manager_id_fkey(id, full_name, full_name_ar)").eq("id", id).maybeSingle();
  if (!e) notFound();
  const canPay = session.can("payroll.view");
  const [{ data: att }, { data: adv }, payments, { data: schedules }, { data: others }, names, { data: items }] = await Promise.all([
    supabase.from("attendance").select("id, employee_id, work_date, status, check_in_at, check_out_at, check_in_photo, check_out_photo, late_minutes, worked_minutes, is_manual, manual_reason, notes, recorded_by").eq("employee_id", id).gte("work_date", addDays(todayRiyadh(), -60)).order("work_date", { ascending: false }),
    canPay ? supabase.from("v_party_balances").select("gl_code, balance").eq("party_type", "employee").eq("party_id", id) : Promise.resolve({ data: [] }),
    canPay ? loadPayments(supabase, locale, { partyType: "employee", partyId: id }) : Promise.resolve([]),
    supabase.from("work_schedules").select("id, name, start_time, end_time").eq("is_active", true),
    supabase.from("employees").select("id, employee_no, full_name, full_name_ar").eq("status", "active"),
    getStaffNames(),
    canPay ? supabase.from("payroll_items").select("id, net_pay, paid_amount, payroll_runs(run_no, period_start, period_end, status)").eq("employee_id", id) : Promise.resolve({ data: [] }),
  ]);
  const paths = [e.photo_path].filter(Boolean) as string[];
  const evidence = session.can("attendance.photos") ? ((att ?? []).flatMap((a) => [a.check_in_photo, a.check_out_photo]).filter(Boolean) as string[]) : [];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("staff").createSignedUrls(paths, 3600);
    for (const u of data ?? []) if (u.path && u.signedUrl) signed.set(`staff:${u.path}`, u.signedUrl);
  }
  if (evidence.length) {
    const { data } = await supabase.storage.from("attendance").createSignedUrls(evidence, 1800);
    for (const u of data ?? []) if (u.path && u.signedUrl) signed.set(`attendance:${u.path}`, u.signedUrl);
  }
  const name = (locale === "ar" ? e.full_name_ar || e.full_name : e.full_name) as string;
  const photo = e.photo_path ? signed.get(`staff:${e.photo_path}`) ?? null : null;
  const advances = Number(((adv ?? []) as { gl_code: string; balance: number }[]).find((b) => b.gl_code === "1400")?.balance ?? 0);
  const salaryOwed = -Number(((adv ?? []) as { gl_code: string; balance: number }[]).find((b) => b.gl_code === "2400")?.balance ?? 0);
  const rows: AttRow[] = (att ?? []).map((a) => ({
    ...a,
    name,
    employee_no: e.employee_no,
    department: e.department,
    staff_photo: photo,
    in_photo: a.check_in_photo ? signed.get(`attendance:${a.check_in_photo}`) ?? null : null,
    out_photo: a.check_out_photo ? signed.get(`attendance:${a.check_out_photo}`) ?? null : null,
    recorded_by: a.recorded_by ? names[a.recorded_by] ?? null : null,
  }));
  const unpaid = ((items ?? []) as unknown as { id: string; net_pay: number; paid_amount: number; payroll_runs: { run_no: string; period_end: string; status: string } }[])
    .filter((i) => i.payroll_runs.status === "approved" && Number(i.net_pay) - Number(i.paid_amount) > 0.004)
    .map((i) => ({ doc_type: "payroll_item" as const, doc_id: i.id, label: `${i.payroll_runs.run_no} · ${fmtDate(i.payroll_runs.period_end, locale)}`, outstanding: Math.round((Number(i.net_pay) - Number(i.paid_amount)) * 100) / 100 }));
  const sched = e.work_schedules as { name: string; start_time: string; end_time: string } | null;
  const mgr = e.manager as unknown as { full_name: string; full_name_ar: string | null } | null;

  return (
    <>
      <PageHeader
        back={{ href: "/erp/staff", label: t.staff.title }}
        title={
          <span className="flex items-center gap-4">
            <span className="relative size-14 overflow-hidden rounded-2xl bg-palm-50">
              {photo ? <Image src={photo} alt="" fill sizes="56px" className="object-cover" unoptimized /> : <UserRound className="absolute inset-0 m-auto size-6 text-palm-700" />}
            </span>
            {name}
          </span>
        }
        description={`${e.employee_no}${e.job_title ? ` · ${e.job_title}` : ""}${e.department ? ` · ${e.department}` : ""}`}
        meta={<StatusBadge status={e.status} />}
        actions={
          <>
            {session.can("payments.create") && session.can("payroll.prepare") && (
              <>
                <PaymentDialog purposes={["salary_advance"]} party={{ id, label: name }} title={t.staff.advance} trigger={<Button variant="outline"><HandCoins />{t.staff.advance}</Button>} />
                {unpaid.length > 0 && <PaymentDialog purposes={["salary"]} party={{ id, label: name }} docs={unpaid} defaultAmount={unpaid.reduce((s, d) => s + d.outstanding, 0)} title={t.payroll.pay} trigger={<Button><HandCoins />{t.payroll.pay}</Button>} />}
              </>
            )}
            {session.can("employees.manage") && (
              <EmployeeForm
                initial={{ ...e, id, basic_salary: Number(e.basic_salary), manager_id: e.manager_id, schedule_id: e.schedule_id }}
                photoUrl={photo}
                schedules={schedules ?? []}
                managers={(others ?? []).map((o) => ({ value: o.id, label: (locale === "ar" ? o.full_name_ar || o.full_name : o.full_name) ?? "", sub: o.employee_no }))}
                showSalary={canPay}
                trigger={<Button variant="outline" size="icon" aria-label={dict.common.edit}><Pencil /></Button>}
              />
            )}
          </>
        }
      />
      {canPay && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label={t.fields.basicSalary} value={fmtMoney(e.basic_salary, locale)} hint={t.salaryTypes[e.salary_type as "monthly"]} />
          <StatCard label={t.staff.advances} value={fmtMoney(advances, locale)} tone={advances > 0 ? "warning" : "default"} />
          <StatCard label={t.payroll.net} value={fmtMoney(salaryOwed, locale)} hint={t.fields.outstanding} tone={salaryOwed > 0 ? "brand" : "default"} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_20rem]">
        <UrlTabs
          tabs={[
            { value: "attendance", label: t.staff.attendanceHistory, content: <AttendanceTable rows={rows} canCorrect={session.can("attendance.correct")} showDate /> },
            ...(canPay ? [{ value: "payments", label: t.staff.payHistory, content: <PaymentsTable rows={payments} showParty={false} canCancel={session.can("payments.cancel")} /> }] : []),
          ]}
        />
        <Section title={dict.common.details}>
          <KeyValues
            cols={1}
            items={[
              { label: dict.common.phone, value: e.phone ? <a href={`tel:${e.phone}`} dir="ltr">{e.phone}</a> : null },
              { label: dict.common.email, value: e.email },
              { label: t.staff.idNumber, value: e.id_number },
              { label: dict.common.address, value: e.address },
              { label: t.fields.joiningDate, value: fmtDate(e.joining_date, locale) },
              { label: t.fields.schedule, value: sched ? `${sched.name} · ${sched.start_time.slice(0, 5)}–${sched.end_time.slice(0, 5)}` : t.settings.default },
              { label: t.fields.manager, value: mgr ? (locale === "ar" ? mgr.full_name_ar || mgr.full_name : mgr.full_name) : null },
              { label: dict.common.notes, value: e.notes },
            ]}
          />
        </Section>
      </div>
    </>
  );
}
