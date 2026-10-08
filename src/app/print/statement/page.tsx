import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { statementData } from "@/lib/erp/statement-data";
import { fmtDate, fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PrintToolbar } from "../print-toolbar";

export default async function StatementPrint(props: PageProps<"/print/statement">) {
  if (!(await getSession())) redirect("/erp/login");
  const sp = await props.searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const data = await statementData(get("type"), get("id"), get("from"), get("to"), locale);
  if (!data) notFound();
  const { data: st } = await (await createClient()).from("settings").select("company_name_en, company_name_ar, phone, address_en, address_ar, vat_number").eq("id", 1).single();
  const m = (v: number | null) => (v === null ? "" : fmtMoney(v, locale, { currency: false }));
  const closing = data.rows.length ? data.rows[data.rows.length - 1].balance : 0;
  return (
    <>
      <PrintToolbar />
      <style>{"@page { size: A4; margin: 12mm; }"}</style>
      <article className="mx-auto min-h-[297mm] w-[210mm] bg-white px-[14mm] py-[12mm] text-[12px] shadow-[0_10px_40px_-20px_rgba(0,0,0,.35)] print:min-h-0 print:w-auto print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-[#173d32] pb-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-block h-11 w-[72px] bg-[#173d32]" style={{ WebkitMask: "url(/brand/logo-mark.svg) center / contain no-repeat", mask: "url(/brand/logo-mark.svg) center / contain no-repeat" }} />
            <div>
              <p className="text-[16px] font-bold text-[#173d32]">{locale === "ar" ? st?.company_name_ar : st?.company_name_en}</p>
              <p className="text-[#6b6a62]">{locale === "ar" ? st?.address_ar : st?.address_en}</p>
            </div>
          </div>
          <div className="text-end">
            <h1 className="text-[20px] font-bold text-[#173d32] uppercase">{dict.erp.print.statement}</h1>
            <p>{fmtDate(get("from"), locale)} – {fmtDate(get("to"), locale)}</p>
          </div>
        </header>
        <section className="mt-4 rounded border border-[#e6dfd0] p-3">
          <p className="font-semibold">{data.party.display}</p>
          <p className="text-[#6b6a62]">{data.party.code}{data.party.phone ? ` · ${data.party.phone}` : ""}</p>
        </section>
        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="bg-[#173d32] text-white">
              <th className="px-2 py-1.5 text-start">{dict.common.date}</th>
              <th className="px-2 py-1.5 text-start">{dict.erp.fields.documentNo}</th>
              <th className="px-2 py-1.5 text-start">{dict.common.description}</th>
              <th className="px-2 py-1.5 text-end">{dict.erp.reports.debit}</th>
              <th className="px-2 py-1.5 text-end">{dict.erp.reports.credit}</th>
              <th className="px-2 py-1.5 text-end">{dict.common.balance}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-b border-[#e6dfd0]">
                <td className="px-2 py-1.5">{fmtDate(r.entry_date, locale)}</td>
                <td className="px-2 py-1.5 font-mono text-[11px]">{r.entry_no}</td>
                <td className="px-2 py-1.5">{r.is_opening ? dict.erp.print.openingBalance : r.memo}</td>
                <td className="px-2 py-1.5 text-end tabular-nums">{m(r.debit)}</td>
                <td className="px-2 py-1.5 text-end tabular-nums">{m(r.credit)}</td>
                <td className="px-2 py-1.5 text-end font-semibold tabular-nums">{m(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-end text-[14px] font-bold text-[#173d32]">
          {dict.erp.print.closingBalance}: {fmtMoney(closing, locale)}
        </p>
        <p className="mt-8 text-[10px] text-[#6b6a62]">{dict.erp.print.generated}: {fmtDate(new Date(), locale, "long")}</p>
      </article>
    </>
  );
}
