import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { after } from "next/server";
import { requireSession } from "@/lib/auth";
import { purgeAttendancePhotos } from "@/lib/erp/mailers";
import { hasAdminKey } from "@/lib/supabase/admin";
import { getEmployees, getSettings } from "@/lib/erp/lookups";
import { todayRiyadh } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AttendanceCamera, type CamEmployee } from "./attendance-camera";

export default async function MarkAttendancePage() {
  const session = await requireSession();
  if (!session.can("attendance.mark")) return <NoAccess />;
  // drop photos older than the retention window (24 h) after the response is sent
  if (hasAdminKey()) after(() => purgeAttendancePhotos().then(() => undefined));
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const [employees, settings, { data: today }] = await Promise.all([
    getEmployees(),
    getSettings(),
    supabase.from("attendance").select("employee_id, status, check_in_at, check_out_at").eq("work_date", todayRiyadh()),
  ]);
  const photos = employees.map((e) => e.photo_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (photos.length) {
    const { data } = await supabase.storage.from("staff").createSignedUrls(photos, 3600);
    for (const u of data ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const todayBy = new Map((today ?? []).map((a) => [a.employee_id, a]));
  const rows: CamEmployee[] = employees.map((e) => ({
    id: e.id,
    employee_no: e.employee_no,
    name: locale === "ar" ? e.full_name_ar || e.full_name : e.full_name,
    department: e.department,
    job_title: e.job_title,
    photo_url: e.photo_path ? signed.get(e.photo_path) ?? null : null,
    today: todayBy.get(e.id) ?? null,
  }));
  return (
    <>
      <PageHeader back={{ href: "/erp/attendance", label: dict.erp.attendance.title }} title={dict.erp.attendance.mark} description={dict.erp.attendance.subtitle} />
      <AttendanceCamera employees={rows} canManual={session.can("attendance.manual")} notice={String(locale === "ar" ? settings?.attendance_notice_ar : settings?.attendance_notice_en)} />
    </>
  );
}
