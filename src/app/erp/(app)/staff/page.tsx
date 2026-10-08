import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { todayRiyadh } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { NewEmployeeButton, StaffTable, type StaffRow } from "./staff-ui";

export default async function StaffPage() {
  const session = await requireSession();
  if (!session.can("employees.view")) return <NoAccess />;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const showSalary = session.can("payroll.view");
  const [{ data: emps }, { data: today }, { data: schedules }] = await Promise.all([
    supabase.from("employees").select("id, employee_no, full_name, full_name_ar, job_title, department, phone, salary_type, basic_salary, status, photo_path").order("status").order("full_name"),
    supabase.from("attendance").select("employee_id, status").eq("work_date", todayRiyadh()),
    supabase.from("work_schedules").select("id, name, start_time, end_time").eq("is_active", true).order("name"),
  ]);
  const photos = (emps ?? []).map((e) => e.photo_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (photos.length) {
    const { data } = await supabase.storage.from("staff").createSignedUrls(photos, 3600);
    for (const u of data ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const todayBy = new Map((today ?? []).map((a) => [a.employee_id, a.status as string]));
  const rows: StaffRow[] = (emps ?? []).map((e) => ({
    id: e.id,
    employee_no: e.employee_no,
    name: (locale === "ar" ? e.full_name_ar || e.full_name : e.full_name) ?? "",
    job_title: e.job_title,
    department: e.department,
    phone: e.phone,
    salary_type: e.salary_type,
    basic_salary: showSalary ? Number(e.basic_salary) : null,
    status: e.status,
    photo_url: e.photo_path ? signed.get(e.photo_path) ?? null : null,
    today: todayBy.get(e.id) ?? null,
  }));
  const managers = (emps ?? []).filter((e) => e.status === "active").map((e) => ({ value: e.id, label: (locale === "ar" ? e.full_name_ar || e.full_name : e.full_name) ?? "", sub: e.employee_no }));
  return (
    <>
      <PageHeader title={dict.erp.staff.title} description={dict.erp.staff.subtitle} />
      <StaffTable rows={rows} toolbar={session.can("employees.manage") && <NewEmployeeButton schedules={schedules ?? []} managers={managers} showSalary={showSalary} />} />
    </>
  );
}
