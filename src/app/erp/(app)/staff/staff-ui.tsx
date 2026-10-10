"use client";
import Image from "next/image";
import { useState } from "react";
import { Camera, Loader2, Plus, UserRound } from "lucide-react";
import { saveEmployee, type EmployeeInput } from "@/app/erp/(app)/_actions/hr";
import { DataTable, type Col } from "@/components/erp/data-table";
import { EntitySelect, type Option } from "@/components/erp/entity-select";
import { Field, nativeSelect } from "@/components/erp/field";
import { Money } from "@/components/erp/money";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { todayRiyadh } from "@/lib/i18n/format";
import { getBrowserClient } from "@/lib/supabase/client";

type Schedule = { id: string; name: string; start_time: string; end_time: string };

export function EmployeeForm({
  initial,
  photoUrl,
  trigger,
  schedules,
  managers,
  showSalary,
}: {
  initial?: EmployeeInput & { id: string };
  photoUrl?: string | null;
  trigger: React.ReactNode;
  schedules: Schedule[];
  managers: Option[];
  showSalary: boolean;
}) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const blank: EmployeeInput = { full_name: "", salary_type: "monthly", basic_salary: 0, joining_date: todayRiyadh(), status: "active" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<EmployeeInput>(initial ?? blank);
  const [preview, setPreview] = useState<string | null>(photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const { run, pending, error, setError } = useServerAction();
  const s = (k: keyof EmployeeInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  const upload = async (file: File) => {
    setUploading(true);
    const path = `${initial?.id ?? "new"}/${crypto.randomUUID()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
    const { error: err } = await getBrowserClient().storage.from("staff").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (err) return setError(err.message);
    setV((x) => ({ ...x, photo_path: path }));
    setPreview(URL.createObjectURL(file));
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial ?? blank); setPreview(photoUrl ?? null); } }}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side={locale === "ar" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>{initial ? t.staff.edit : t.staff.new}</SheetTitle></SheetHeader>
        <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <span className="relative size-20 overflow-hidden rounded-2xl bg-palm-50">
              {preview ? <Image src={preview} alt="" fill sizes="80px" className="object-cover" unoptimized /> : <UserRound className="absolute inset-0 m-auto size-8 text-palm-700" />}
            </span>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {t.fields.photo}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          <Field label={dict.common.name} htmlFor="em-n" required><Input id="em-n" value={v.full_name} onChange={s("full_name")} /></Field>
          <Field label={dict.common.nameAr} htmlFor="em-na"><Input id="em-na" dir="rtl" value={v.full_name_ar ?? ""} onChange={s("full_name_ar")} /></Field>
          <Field label={t.fields.jobTitle} htmlFor="em-j"><Input id="em-j" value={v.job_title ?? ""} onChange={s("job_title")} /></Field>
          <Field label={t.fields.department} htmlFor="em-d"><Input id="em-d" value={v.department ?? ""} onChange={s("department")} /></Field>
          <Field label={dict.common.phone} htmlFor="em-p"><Input id="em-p" dir="ltr" type="tel" value={v.phone ?? ""} onChange={s("phone")} /></Field>
          <Field label={dict.common.email} htmlFor="em-e"><Input id="em-e" dir="ltr" type="email" value={v.email ?? ""} onChange={s("email")} /></Field>
          <Field label={t.staff.idNumber} htmlFor="em-id"><Input id="em-id" dir="ltr" value={v.id_number ?? ""} onChange={s("id_number")} /></Field>
          <Field label={t.fields.joiningDate} htmlFor="em-jd" required><Input id="em-jd" type="date" value={v.joining_date} onChange={s("joining_date")} /></Field>
          <Field label={dict.common.address} htmlFor="em-a" className="sm:col-span-2"><Input id="em-a" value={v.address ?? ""} onChange={s("address")} /></Field>
          {showSalary && (
            <>
              <Field label={t.fields.salaryType} htmlFor="em-st">
                <select id="em-st" className={nativeSelect} value={v.salary_type} onChange={s("salary_type")}>
                  {(["monthly", "daily", "hourly"] as const).map((k) => <option key={k} value={k}>{t.salaryTypes[k]}</option>)}
                </select>
              </Field>
              <Field label={t.fields.basicSalary} htmlFor="em-bs"><Input id="em-bs" type="number" min="0" step="0.01" value={String(v.basic_salary ?? 0)} onChange={s("basic_salary")} /></Field>
            </>
          )}
          <Field label={t.fields.schedule} htmlFor="em-sch">
            <select id="em-sch" className={nativeSelect} value={v.schedule_id ?? ""} onChange={s("schedule_id")}>
              <option value="">{t.settings.default}</option>
              {schedules.map((sc) => <option key={sc.id} value={sc.id}>{sc.name} · {sc.start_time.slice(0, 5)}–{sc.end_time.slice(0, 5)}</option>)}
            </select>
          </Field>
          <Field label={t.fields.manager}><EntitySelect options={managers.filter((m) => m.value !== initial?.id)} value={v.manager_id ?? null} onChange={(m) => setV((x) => ({ ...x, manager_id: m }))} clearable /></Field>
          <Field label={dict.common.status} htmlFor="em-status">
            <select id="em-status" className={nativeSelect} value={v.status} onChange={s("status")}>
              {(["active", "inactive", "terminated"] as const).map((k) => <option key={k} value={k}>{t.staff.statuses[k]}</option>)}
            </select>
          </Field>
          <Field label={dict.common.notes} htmlFor="em-notes" className="sm:col-span-2"><Textarea id="em-notes" rows={2} value={v.notes ?? ""} onChange={s("notes")} /></Field>
          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
          <Button disabled={pending || uploading || v.full_name.trim().length < 2} onClick={() => run(() => saveEmployee({ ...v, id: initial?.id }), { success: t.staff.saved, onSuccess: () => setOpen(false) })}>
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export type StaffRow = { id: string; employee_no: string; name: string; job_title: string | null; department: string | null; phone: string | null; salary_type: string; basic_salary: number | null; status: string; photo_url: string | null; today: string | null };

export function StaffTable({ rows, toolbar }: { rows: StaffRow[]; toolbar?: React.ReactNode }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const cols: Col<StaffRow>[] = [
    {
      id: "name",
      header: dict.common.name,
      value: (r) => `${r.name} ${r.employee_no} ${r.department ?? ""} ${r.job_title ?? ""}`,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-palm-50">
            {r.photo_url ? <Image src={r.photo_url} alt="" fill sizes="40px" className="object-cover" unoptimized /> : <UserRound className="absolute inset-0 m-auto size-4 text-palm-700" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-palm-900">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground">{r.employee_no}{r.job_title ? ` · ${r.job_title}` : ""}</p>
          </div>
        </div>
      ),
    },
    { id: "dept", header: t.fields.department, value: (r) => r.department ?? "", cell: (r) => r.department ?? "—", hideBelow: "md" },
    { id: "phone", header: dict.common.phone, value: (r) => r.phone ?? "", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span>, hideBelow: "lg" },
    ...(rows.some((r) => r.basic_salary !== null)
      ? [{ id: "salary", header: t.fields.basicSalary, value: (r: StaffRow) => r.basic_salary ?? 0, cell: (r: StaffRow) => <span className="text-sm"><Money value={r.basic_salary} /> <span className="text-xs text-muted-foreground">/ {t.salaryTypes[r.salary_type as "monthly"]}</span></span>, align: "end" as const, hideBelow: "md" as const }]
      : []),
    { id: "today", header: t.attendance.today, value: (r) => r.today ?? "", cell: (r) => (r.today ? <StatusBadge status={r.today} /> : <span className="text-xs text-muted-foreground">—</span>), align: "center", hideBelow: "sm" },
    { id: "status", header: dict.common.status, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} />, align: "center" },
  ];
  return <DataTable rows={rows} columns={cols} rowHref={(r) => `/erp/staff/${r.id}`} emptyTitle={t.staff.empty} toolbar={toolbar} />;
}

export function NewEmployeeButton(props: { schedules: Schedule[]; managers: Option[]; showSalary: boolean }) {
  const { dict } = useI18n();
  return <EmployeeForm {...props} trigger={<Button><Plus />{dict.erp.staff.new}</Button>} />;
}
