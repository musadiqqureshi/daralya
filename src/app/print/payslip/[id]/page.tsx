import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fmtDate, fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PrintToolbar } from "../../print-toolbar";

export default async function PayslipPrint(props: PageProps<"/print/payslip/[id]">) {
  const session = await getSession();
  if (!session) redirect("/erp/login");
  const { id } = await props.params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.payroll;
  const supabase = await createClient();
  const { data: i } = await supabase.from("payroll_items").select("*, employees(employee_no, full_name, full_name_ar, job_title, department), payroll_runs(run_no, period_start, period_end, status)").eq("id", id).maybeSingle();
  if (!i) notFound();
  const { data: st } = await supabase.from("settings").select("company_name_en, company_name_ar, address_en, address_ar").eq("id", 1).single();
  const e = i.employees as { employee_no: string; full_name: string; full_name_ar: string | null; job_title: string | null; department: string | null };
  const r = i.payroll_runs as { run_no: string; period_start: string; period_end: string; status: string };
  const m = (v: number) => fmtMoney(Number(v), locale, { currency: false });
  const earnings: [string, number][] = [[t.base, i.base_earned], [t.overtime, i.overtime_amount], [t.bonus, i.bonus]];
  const deductions: [string, number][] = [[t.lateDeduction, i.late_deduction], [t.absenceDeduction, i.absence_deduction], [t.halfDayDeduction, i.half_day_deduction], [t.advanceDeduction, i.advance_deduction], [t.otherDeduction, i.other_deduction]];
  return (
    <>
      <PrintToolbar />
      <style>{"@page { size: A4; margin: 14mm; }"}</style>
      <article className="mx-auto w-[210mm] bg-white px-[16mm] py-[14mm] text-[12.5px] shadow-[0_10px_40px_-20px_rgba(0,0,0,.35)] print:w-auto print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-[#173d32] pb-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-block h-11 w-[72px] bg-[#173d32]" style={{ WebkitMask: "url(/brand/logo-mark.svg) center / contain no-repeat", mask: "url(/brand/logo-mark.svg) center / contain no-repeat" }} />
            <div>
              <p className="text-[16px] font-bold text-[#173d32]">{locale === "ar" ? st?.company_name_ar : st?.company_name_en}</p>
              <p className="text-[#6b6a62]">{locale === "ar" ? st?.address_ar : st?.address_en}</p>
            </div>
          </div>
          <div className="text-end">
            <h1 className="text-[20px] font-bold text-[#173d32] uppercase">{dict.erp.print.payslip}</h1>
            <p>{r.run_no}</p>
            <p>{fmtDate(r.period_start, locale)} – {fmtDate(r.period_end, locale)}</p>
          </div>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-2 rounded border border-[#e6dfd0] p-3">
          <p><span className="text-[#6b6a62]">{dict.erp.fields.employee}: </span><strong>{locale === "ar" ? e.full_name_ar || e.full_name : e.full_name}</strong></p>
          <p><span className="text-[#6b6a62]">{dict.common.code}: </span>{e.employee_no}</p>
          <p><span className="text-[#6b6a62]">{dict.erp.fields.jobTitle}: </span>{e.job_title ?? "—"}</p>
          <p><span className="text-[#6b6a62]">{dict.erp.fields.department}: </span>{e.department ?? "—"}</p>
          <p><span className="text-[#6b6a62]">{t.scheduled}: </span>{i.scheduled_days} · {t.present}: {i.present_days} · {t.absent}: {i.absent_days}</p>
          <p><span className="text-[#6b6a62]">{t.hours}: </span>{i.worked_hours} · {t.overtime}: {i.overtime_hours}</p>
        </section>
        <div className="mt-5 grid grid-cols-2 gap-6">
          {[["+", earnings], ["−", deductions]].map(([sign, list]) => (
            <table key={sign as string} className="w-full border-collapse">
              <tbody>
                {(list as [string, number][]).map(([label, v]) => (
                  <tr key={label} className="border-b border-[#e6dfd0]">
                    <td className="py-1.5">{label}</td>
                    <td className="py-1.5 text-end tabular-nums">{Number(v) ? `${sign} ${m(v)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
        <p className="mt-6 flex justify-between rounded bg-[#173d32] px-4 py-3 text-[16px] font-bold text-white">
          <span>{t.net}</span>
          <span className="tabular-nums" dir="ltr">{fmtMoney(i.net_pay, locale)}</span>
        </p>
        <p className="mt-2 text-end text-[#6b6a62]">{dict.erp.fields.paid}: {fmtMoney(i.paid_amount, locale)}</p>
        <div className="mt-16 grid grid-cols-2 gap-10 text-center text-[#6b6a62]">
          <p className="border-t border-[#1f2420] pt-2">{dict.erp.print.signature} · {dict.erp.fields.employee}</p>
          <p className="border-t border-[#1f2420] pt-2">{dict.erp.print.signature} · {dict.roles.accountant}</p>
        </div>
      </article>
    </>
  );
}
