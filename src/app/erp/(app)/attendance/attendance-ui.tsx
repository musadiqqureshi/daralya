"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarCheck2, Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { addHoliday, addLeave, closeAttendanceDay, correctAttendance, expireAttendancePhotos, removeHoliday, setLeaveStatus } from "@/app/erp/(app)/_actions/hr";
import { DataTable, type Col } from "@/components/erp/data-table";
import { EntitySelect, type Option } from "@/components/erp/entity-select";
import { Field, nativeSelect } from "@/components/erp/field";
import { DateText } from "@/components/erp/money";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/dictionaries/en";
import { fmtTime, minutesToHours, todayRiyadh } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export type AttRow = {
  id: string;
  employee_id: string;
  work_date: string;
  name: string;
  employee_no: string;
  department: string | null;
  staff_photo: string | null;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  in_photo: string | null;
  out_photo: string | null;
  late_minutes: number;
  worked_minutes: number | null;
  is_manual: boolean;
  manual_reason: string | null;
  notes: string | null;
  recorded_by: string | null;
};

/** datetime-local value in Saudi time ↔ ISO with +03:00 */
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? `${v}:00+03:00` : null);

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><UserRound className="size-4" /></span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block size-10 overflow-hidden rounded-lg ring-1 ring-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="size-full object-cover" loading="lazy" />
    </a>
  );
}

function CorrectDialog({ row }: { row: AttRow }) {
  const { dict } = useI18n();
  const t = dict.erp.attendance;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [cin, setCin] = useState(toLocal(row.check_in_at));
  const [cout, setCout] = useState(toLocal(row.check_out_at));
  const [notes, setNotes] = useState(row.notes ?? "");
  const [reason, setReason] = useState("");
  const { run, pending, error } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={t.correct}><Pencil /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.correct}</DialogTitle>
          <DialogDescription>{row.name} · <DateText value={row.work_date} /></DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={dict.common.status} htmlFor="co-st" className="sm:col-span-2">
            <select id="co-st" className={nativeSelect} value={status} onChange={(e) => setStatus(e.target.value)}>
              {(["present", "late", "half_day", "absent", "on_leave", "holiday"] as const).map((s) => <option key={s} value={s}>{dict.erp.status[s]}</option>)}
            </select>
          </Field>
          <Field label={t.checkIn} htmlFor="co-in"><Input id="co-in" type="datetime-local" value={cin} onChange={(e) => setCin(e.target.value)} /></Field>
          <Field label={t.checkOut} htmlFor="co-out"><Input id="co-out" type="datetime-local" value={cout} onChange={(e) => setCout(e.target.value)} /></Field>
          <Field label={dict.common.notes} htmlFor="co-n" className="sm:col-span-2"><Input id="co-n" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Field label={dict.common.reason} htmlFor="co-r" required className="sm:col-span-2"><Textarea id="co-r" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dict.erp.forms.reasonPlaceholder} /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending || reason.trim().length < 3}
            onClick={() => run(() => correctAttendance(row.id, { status: status as "present", check_in_at: fromLocal(cin), check_out_at: fromLocal(cout), notes }, reason), { success: t.correctionSaved, onSuccess: () => setOpen(false) })}
          >
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttendanceTable({ rows, canCorrect, showDate = false, toolbar }: { rows: AttRow[]; canCorrect: boolean; showDate?: boolean; toolbar?: React.ReactNode }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.attendance;
  const cols: Col<AttRow>[] = [
    ...(showDate ? [{ id: "date", header: dict.common.date, value: (r: AttRow) => r.work_date, cell: (r: AttRow) => <DateText value={r.work_date} /> }] : []),
    {
      id: "emp",
      header: dict.erp.fields.employee,
      value: (r) => `${r.name} ${r.employee_no} ${r.department ?? ""}`,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Thumb url={r.staff_photo} alt={r.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-palm-900">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground">{r.employee_no}{r.department ? ` · ${r.department}` : ""}</p>
          </div>
        </div>
      ),
    },
    { id: "in", header: t.checkIn, value: (r) => r.check_in_at ?? "", cell: (r) => (r.check_in_at ? <span className="tabular-nums">{fmtTime(r.check_in_at, locale)}</span> : "—") },
    { id: "out", header: t.checkOut, value: (r) => r.check_out_at ?? "", cell: (r) => (r.check_out_at ? <span className="tabular-nums">{fmtTime(r.check_out_at, locale)}</span> : "—") },
    { id: "worked", header: t.worked, value: (r) => r.worked_minutes ?? 0, cell: (r) => <span className="tabular-nums text-muted-foreground">{minutesToHours(r.worked_minutes, locale)}</span>, hideBelow: "md" },
    {
      id: "status",
      header: dict.common.status,
      value: (r) => r.status,
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={r.status} />
          {r.late_minutes > 0 && <span className="text-[0.7rem] text-gold-700">{tpl(t.lateBy, { m: r.late_minutes })}</span>}
          {r.is_manual && <span className="rounded bg-warning/10 px-1.5 text-[0.65rem] font-semibold text-warning" title={r.manual_reason ?? ""}>{t.manualFlag}</span>}
        </div>
      ),
    },
    {
      id: "photos",
      header: t.gallery,
      cell: (r) => (
        <div className="flex gap-1.5">
          <Thumb url={r.in_photo} alt={t.checkInPhoto} />
          {r.check_out_at && <Thumb url={r.out_photo} alt={t.checkOutPhoto} />}
        </div>
      ),
      hideBelow: "sm",
    },
    { id: "by", header: t.recordedBy, value: (r) => r.recorded_by ?? "", cell: (r) => <span className="text-xs text-muted-foreground">{r.recorded_by ?? "—"}</span>, hideBelow: "lg" },
    ...(canCorrect ? [{ id: "act", header: "", cell: (r: AttRow) => <CorrectDialog row={r} />, align: "end" as const }] : []),
  ];
  return <DataTable rows={rows} columns={cols} emptyTitle={t.empty} toolbar={toolbar} initialSort={showDate ? { id: "date", desc: true } : undefined} />;
}

export function GalleryGrid({ rows, employees }: { rows: AttRow[]; employees: Option[] }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.attendance;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const items = rows.flatMap((r) => [
    ...(r.in_photo ? [{ key: r.id + "in", url: r.in_photo, row: r, kind: t.checkIn, at: r.check_in_at }] : []),
    ...(r.out_photo ? [{ key: r.id + "out", url: r.out_photo, row: r, kind: t.checkOut, at: r.check_out_at }] : []),
  ]);
  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <EntitySelect
          options={employees}
          value={sp.get("employee")}
          clearable
          placeholder={t.selectEmployee}
          onChange={(v) => {
            const next = new URLSearchParams(sp.toString());
            if (v) next.set("employee", v);
            else next.delete("employee");
            next.set("tab", "gallery");
            router.replace(`${pathname}?${next}`, { scroll: false });
          }}
        />
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">{t.noPhoto}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((i) => (
            <li key={i.key} className="overflow-hidden rounded-xl border bg-card">
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.url} alt={`${i.row.name} ${i.kind}`} className="size-full object-cover" loading="lazy" />
              </a>
              <div className="p-2.5 text-xs">
                <p className="truncate font-semibold">{i.row.name}</p>
                <p className="text-muted-foreground"><DateText value={i.row.work_date} /> · {i.kind} {i.at ? fmtTime(i.at, locale) : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DayActions({ canClose, canExpire }: { canClose: boolean; canExpire: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.attendance;
  const [date, setDate] = useState(todayRiyadh());
  const { run, pending } = useServerAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canClose && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline"><CalendarCheck2 />{t.closeDay}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t.closeDay}</DialogTitle>
              <DialogDescription>{t.closeDayHint}</DialogDescription>
            </DialogHeader>
            <Input type="date" value={date} max={todayRiyadh()} onChange={(e) => setDate(e.target.value)} aria-label={dict.common.date} />
            <DialogFooter>
              <Button disabled={pending} onClick={() => run(async () => { const r = await closeAttendanceDay(date); return r.ok ? { ...r, message: tpl(t.closedDay, { n: r.data ?? 0 }) } : r; })}>
                {pending && <Loader2 className="animate-spin" />}
                {dict.common.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {canExpire && (
        <Button variant="ghost" className="text-muted-foreground" disabled={pending} onClick={() => run(async () => { const r = await expireAttendancePhotos(); return r.ok ? { ...r, message: tpl(t.expiredDeleted, { n: r.data ?? 0 }) } : r; })}>
          <Trash2 />
          {t.expirePhotos}
        </Button>
      )}
    </div>
  );
}

export type LeaveRow = { id: string; employee: string; leave_type: string; start_date: string; end_date: string; is_paid: boolean; reason: string | null; status: string };
export type HolidayRow = { id: string; holiday_date: string; name: string };

export function LeavePanel({ leaves, holidays, employees, canManage }: { leaves: LeaveRow[]; holidays: HolidayRow[]; employees: Option[]; canManage: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.attendance;
  const { run, pending, error } = useServerAction();
  const [emp, setEmp] = useState<string | null>(null);
  const [type, setType] = useState<"annual" | "sick" | "emergency" | "unpaid" | "other">("annual");
  const [start, setStart] = useState(todayRiyadh());
  const [end, setEnd] = useState(todayRiyadh());
  const [paid, setPaid] = useState(true);
  const [reason, setReason] = useState("");
  const [hDate, setHDate] = useState("");
  const [hEn, setHEn] = useState("");
  const [hAr, setHAr] = useState("");
  const cols: Col<LeaveRow>[] = [
    { id: "emp", header: dict.erp.fields.employee, value: (r) => r.employee, cell: (r) => <span className="font-medium">{r.employee}</span> },
    { id: "type", header: dict.common.type, value: (r) => r.leave_type, cell: (r) => <span>{t.leaveTypes[r.leave_type as keyof typeof t.leaveTypes]}{r.is_paid ? "" : ` · ${t.leaveTypes.unpaid}`}</span> },
    { id: "dates", header: dict.erp.fields.period, value: (r) => r.start_date, cell: (r) => <span className="text-sm"><DateText value={r.start_date} /> – <DateText value={r.end_date} /></span> },
    { id: "reason", header: dict.common.reason, value: (r) => r.reason ?? "", cell: (r) => r.reason ?? "—", hideBelow: "md" },
    {
      id: "status",
      header: dict.common.status,
      value: (r) => r.status,
      cell: (r) =>
        canManage && r.status !== "rejected" ? (
          <div className="flex items-center gap-2">
            <StatusBadge status={r.status} />
            <button type="button" className="text-xs text-destructive hover:underline" onClick={() => run(() => setLeaveStatus(r.id, "rejected"))}>{dict.erp.inventory.reject}</button>
          </div>
        ) : (
          <StatusBadge status={r.status} />
        ),
    },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {canManage && (
          <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
            <Field label={dict.erp.fields.employee} className="lg:col-span-2"><EntitySelect options={employees} value={emp} onChange={setEmp} /></Field>
            <Field label={dict.common.type} htmlFor="lv-t">
              <select id="lv-t" className={nativeSelect} value={type} onChange={(e) => { const v = e.target.value as typeof type; setType(v); if (v === "unpaid") setPaid(false); }}>
                {(Object.keys(t.leaveTypes) as (keyof typeof t.leaveTypes)[]).map((k) => <option key={k} value={k}>{t.leaveTypes[k]}</option>)}
              </select>
            </Field>
            <Field label={dict.common.from} htmlFor="lv-s"><Input id="lv-s" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label={dict.common.to} htmlFor="lv-e"><Input id="lv-e" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><Checkbox checked={paid} disabled={type === "unpaid"} onCheckedChange={(v) => setPaid(Boolean(v))} />{t.paidLeave}</label>
            <Field label={dict.common.reason} htmlFor="lv-r" className="sm:col-span-2 lg:col-span-5"><Input id="lv-r" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <div className="flex items-end">
              <Button className="w-full" disabled={!emp || pending} onClick={() => run(() => addLeave({ employee_id: emp!, leave_type: type, start_date: start, end_date: end, is_paid: paid, reason }), { success: dict.common.saved, onSuccess: () => { setEmp(null); setReason(""); } })}>
                <Plus />{t.addLeave}
              </Button>
            </div>
            {error && <p role="alert" className="text-sm text-destructive sm:col-span-full">{error}</p>}
          </div>
        )}
        <DataTable rows={leaves} columns={cols} initialSort={{ id: "dates", desc: true }} />
      </div>
      <div className="rounded-xl border bg-card">
        <p className="border-b px-4 py-3 text-sm font-semibold">{dict.erp.settings.holidays}</p>
        <ul className="divide-y">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span><span className="font-medium">{h.name}</span><span className="block text-xs text-muted-foreground"><DateText value={h.holiday_date} /></span></span>
              {canManage && <Button size="icon-sm" variant="ghost" aria-label={dict.common.remove} onClick={() => run(() => removeHoliday(h.id))}><Trash2 /></Button>}
            </li>
          ))}
        </ul>
        {canManage && (
          <div className={cn("space-y-2 border-t p-4")}>
            <Input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} aria-label={dict.common.date} />
            <Input value={hEn} onChange={(e) => setHEn(e.target.value)} placeholder={dict.erp.products.nameEn} />
            <Input dir="rtl" value={hAr} onChange={(e) => setHAr(e.target.value)} placeholder={dict.erp.products.nameAr} />
            <Button variant="outline" className="w-full" disabled={!hDate || hEn.trim().length < 2 || pending} onClick={() => run(() => addHoliday(hDate, hEn, hAr), { success: dict.common.saved, onSuccess: () => { setHDate(""); setHEn(""); setHAr(""); } })}>
              <Plus />{t.addHoliday}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
