import Link from "next/link";
import { Camera, Clock, LogOut, UserCheck, UserMinus, Users, UserX, Palmtree, Timer } from "lucide-react";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { UrlTabs } from "@/components/erp/url-tabs";
import { Button } from "@/components/ui/button";
import { after } from "next/server";
import { requireSession } from "@/lib/auth";
import { purgeAttendancePhotos } from "@/lib/erp/mailers";
import { hasAdminKey } from "@/lib/supabase/admin";
import { getStaffNames } from "@/lib/erp/lookups";
import { readRange } from "@/lib/erp/range";
import { addDays, fmtNumber, todayRiyadh } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AttendanceTable, DayActions, GalleryGrid, LeavePanel, type AttRow, type HolidayRow, type LeaveRow } from "./attendance-ui";

type Raw = {
  id: string; employee_id: string; work_date: string; status: string; check_in_at: string | null; check_out_at: string | null;
  check_in_photo: string | null; check_out_photo: string | null; late_minutes: number; worked_minutes: number | null; is_manual: boolean;
  manual_reason: string | null; notes: string | null; recorded_by: string | null;
  employees: { employee_no: string; full_name: string; full_name_ar: string | null; department: string | null; photo_path: string | null };
};
const COLS = "id, employee_id, work_date, status, check_in_at, check_out_at, check_in_photo, check_out_photo, late_minutes, worked_minutes, is_manual, manual_reason, notes, recorded_by, employees(employee_no, full_name, full_name_ar, department, photo_path)";

export default async function AttendancePage(props: PageProps<"/erp/attendance">) {
  const session = await requireSession();
  if (!session.canAny("attendance.view", "attendance.mark")) return <NoAccess />;
  const sp = await props.searchParams;
  const { from, to } = readRange(sp, "month");
  const today = todayRiyadh();
  // drop photos older than the retention window (24 h) after the response is sent
  if (hasAdminKey()) after(() => purgeAttendancePhotos().then(() => undefined));
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.attendance;
  const supabase = await createClient();
  const canPhotos = session.can("attendance.photos");
  const employeeFilter = typeof sp.employee === "string" ? sp.employee : null;

  let galleryQ = supabase.from("attendance").select(COLS).gte("work_date", employeeFilter ? addDays(today, -90) : addDays(today, -7)).order("work_date", { ascending: false }).limit(300);
  if (employeeFilter) galleryQ = galleryQ.eq("employee_id", employeeFilter);

  const [{ data: todayRaw }, { data: histRaw }, { data: galRaw }, { count: totalEmployees }, { data: leaves }, { data: holidays }, { data: emps }, names] = await Promise.all([
    supabase.from("attendance").select(COLS).eq("work_date", today),
    supabase.from("attendance").select(COLS).gte("work_date", from).lte("work_date", to).order("work_date", { ascending: false }).limit(2000),
    canPhotos ? galleryQ : Promise.resolve({ data: [] }),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("leave_records").select("id, leave_type, start_date, end_date, is_paid, reason, status, employees(full_name, full_name_ar)").order("start_date", { ascending: false }).limit(300),
    supabase.from("holidays").select("id, holiday_date, name_en, name_ar").gte("holiday_date", addDays(today, -60)).order("holiday_date"),
    supabase.from("employees").select("id, employee_no, full_name, full_name_ar").eq("status", "active").order("full_name"),
    getStaffNames(),
  ]);

  // signed URLs for private photos (attendance evidence needs the photos permission)
  const all = [...((todayRaw ?? []) as unknown as Raw[]), ...((histRaw ?? []) as unknown as Raw[]), ...((galRaw ?? []) as unknown as Raw[])];
  const evidence = canPhotos ? [...new Set(all.flatMap((r) => [r.check_in_photo, r.check_out_photo]).filter(Boolean) as string[])] : [];
  const staff = [...new Set(all.map((r) => r.employees?.photo_path).filter(Boolean) as string[])];
  const signed = new Map<string, string>();
  const sign = async (bucket: string, paths: string[]) => {
    for (let i = 0; i < paths.length; i += 200) {
      const { data } = await supabase.storage.from(bucket).createSignedUrls(paths.slice(i, i + 200), 1800);
      for (const u of data ?? []) if (u.path && u.signedUrl) signed.set(`${bucket}:${u.path}`, u.signedUrl);
    }
  };
  await Promise.all([sign("attendance", evidence), sign("staff", staff)]);
  const toRow = (r: Raw): AttRow => ({
    id: r.id,
    employee_id: r.employee_id,
    work_date: r.work_date,
    name: (locale === "ar" ? r.employees.full_name_ar || r.employees.full_name : r.employees.full_name) ?? "—",
    employee_no: r.employees.employee_no,
    department: r.employees.department,
    staff_photo: r.employees.photo_path ? signed.get(`staff:${r.employees.photo_path}`) ?? null : null,
    status: r.status,
    check_in_at: r.check_in_at,
    check_out_at: r.check_out_at,
    in_photo: r.check_in_photo ? signed.get(`attendance:${r.check_in_photo}`) ?? null : null,
    out_photo: r.check_out_photo ? signed.get(`attendance:${r.check_out_photo}`) ?? null : null,
    late_minutes: r.late_minutes,
    worked_minutes: r.worked_minutes,
    is_manual: r.is_manual,
    manual_reason: r.manual_reason,
    notes: r.notes,
    recorded_by: r.recorded_by ? names[r.recorded_by] ?? null : null,
  });
  const todayRows = ((todayRaw ?? []) as unknown as Raw[]).map(toRow);
  const present = todayRows.filter((r) => ["present", "late", "half_day"].includes(r.status));
  const onLeave = todayRows.filter((r) => r.status === "on_leave").length;
  const working = present.filter((r) => r.check_in_at && !r.check_out_at).length;
  // server component: rendered per request, so "now" is the request time
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const minutesToday = present.reduce((s, r) => s + (r.worked_minutes ?? (r.check_in_at && !r.check_out_at ? Math.max(0, (nowMs - new Date(r.check_in_at).getTime()) / 60000) : 0)), 0);
  const empOptions = (emps ?? []).map((e) => ({ value: e.id, label: (locale === "ar" ? e.full_name_ar || e.full_name : e.full_name) ?? "", sub: e.employee_no }));

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <>
            <DayActions canClose={session.can("attendance.mark")} canExpire={session.can("settings.manage")} />
            {session.can("attendance.mark") && (
              <Button asChild size="lg" className="h-10">
                <Link href="/erp/attendance/mark"><Camera />{t.mark}</Link>
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard icon={Users} label={t.totalEmployees} value={fmtNumber(totalEmployees ?? 0, locale)} />
        <StatCard icon={UserCheck} label={t.presentToday} value={fmtNumber(present.length, locale)} tone="brand" />
        <StatCard icon={UserX} label={t.absentToday} value={fmtNumber(Math.max((totalEmployees ?? 0) - present.length - onLeave, 0), locale)} />
        <StatCard icon={Clock} label={t.lateToday} value={fmtNumber(todayRows.filter((r) => r.status === "late").length, locale)} tone="warning" />
        <StatCard icon={Palmtree} label={t.onLeave} value={fmtNumber(onLeave, locale)} />
        <StatCard icon={LogOut} label={t.checkedOutCount} value={fmtNumber(present.filter((r) => r.check_out_at).length, locale)} />
        <StatCard icon={UserMinus} label={t.working} value={fmtNumber(working, locale)} />
        <StatCard icon={Timer} label={t.hoursToday} value={fmtNumber(minutesToday / 60, locale, 1)} />
      </div>
      <UrlTabs
        tabs={[
          { value: "today", label: t.today, content: <AttendanceTable rows={todayRows} canCorrect={session.can("attendance.correct")} /> },
          {
            value: "history",
            label: t.history,
            content: <AttendanceTable rows={((histRaw ?? []) as unknown as Raw[]).map(toRow)} canCorrect={session.can("attendance.correct")} showDate toolbar={<DateRangeFilter from={from} to={to} />} />,
          },
          ...(canPhotos ? [{ value: "gallery", label: t.gallery, content: <GalleryGrid rows={((galRaw ?? []) as unknown as Raw[]).map(toRow)} employees={empOptions} /> }] : []),
          {
            value: "leave",
            label: t.leave,
            content: (
              <LeavePanel
                canManage={session.can("employees.manage")}
                employees={empOptions}
                leaves={((leaves ?? []) as unknown as (Omit<LeaveRow, "employee"> & { employees: { full_name: string; full_name_ar: string | null } })[]).map((l) => ({
                  ...l,
                  employee: (locale === "ar" ? l.employees.full_name_ar || l.employees.full_name : l.employees.full_name) ?? "—",
                }))}
                holidays={((holidays ?? []) as { id: string; holiday_date: string; name_en: string; name_ar: string }[]).map((h): HolidayRow => ({ id: h.id, holiday_date: h.holiday_date, name: locale === "ar" ? h.name_ar : h.name_en }))}
              />
            ),
          },
        ]}
      />
    </>
  );
}
