import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { qrSvg } from "@/lib/erp/qr";
import { zatcaQrPayload } from "@/lib/erp/zatca";
import { ar as AR } from "@/lib/i18n/dictionaries/ar";
import { en as EN } from "@/lib/i18n/dictionaries/en";
import { fmtDate, fmtMoney, fmtNumber, fmtTime } from "@/lib/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PrintToolbar } from "../../print-toolbar";

type Lang = "en" | "ar" | "both";

export default async function InvoicePrint(props: PageProps<"/print/invoice/[id]">) {
  const session = await getSession();
  if (!session) redirect("/erp/login");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const receipt = sp.format === "receipt";
  const supabase = await createClient();

  // Only customer-safe columns are read: no cost, profit, commission or investor data.
  const { data: s } = await supabase
    .from("sales")
    .select("id, invoice_no, sale_date, created_at, subtotal, discount_amount, taxable_amount, vat_rate, vat_amount, total, returned_total, paid_total, pending_total, payment_status, status, notes, customers(name, name_ar, phone, address, city, vat_number)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const [{ data: items }, { data: settings }, { data: qrs }, { data: allocs }] = await Promise.all([
    supabase.from("sale_items").select("line_no, qty, unit_price, discount_amount, line_total, products(name_en, name_ar, unit)").eq("sale_id", id).order("line_no"),
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("invoice_qr_codes").select("label_en, label_ar, url, position, size_px").eq("is_enabled", true).order("sort_order"),
    supabase.from("payment_allocations").select("payments(status, payment_methods(name_en, name_ar))").eq("doc_type", "sale").eq("doc_id", id),
  ]);
  const st = settings as Record<string, string | number | boolean | null>;
  const lang: Lang = sp.lang === "en" || sp.lang === "ar" || sp.lang === "both" ? sp.lang : ((st.invoice_language as Lang) ?? "both");
  const primary = lang === "ar" ? "ar" : "en";
  const L = (k: (d: typeof EN) => string) => (lang === "both" ? `${k(EN)} / ${k(AR as unknown as typeof EN)}` : k(lang === "ar" ? (AR as unknown as typeof EN) : EN));
  const money = (v: number | string) => fmtMoney(Number(v), primary, { currency: false });
  const c = s.customers as unknown as { name: string; name_ar: string | null; phone: string | null; address: string | null; city: string | null; vat_number: string | null };
  const vatOn = Number(s.vat_amount) > 0;
  const methods = [
    ...new Set(
      ((allocs ?? []) as unknown as { payments: { status: string; payment_methods: { name_en: string; name_ar: string } } }[])
        .filter((a) => a.payments.status !== "cancelled")
        .map((a) => (lang === "ar" ? a.payments.payment_methods.name_ar : lang === "both" ? `${a.payments.payment_methods.name_en} / ${a.payments.payment_methods.name_ar}` : a.payments.payment_methods.name_en)),
    ),
  ];

  const qrList = await Promise.all(
    ((qrs ?? []) as { label_en: string; label_ar: string; url: string; position: string; size_px: number }[]).map(async (q) => ({
      ...q,
      svg: await qrSvg(q.url, receipt ? 72 : q.size_px),
    })),
  );
  const zatca =
    vatOn && st.invoice_show_zatca_qr && st.vat_number
      ? await qrSvg(
          zatcaQrPayload({
            seller: String(st.company_name_ar || st.company_name_en),
            vatNumber: String(st.vat_number),
            timestamp: new Date(s.created_at).toISOString(),
            total: Number(s.total).toFixed(2),
            vat: Number(s.vat_amount).toFixed(2),
          }),
          receipt ? 110 : 120,
        )
      : null;
  const title = vatOn ? (c.vat_number ? L((d) => d.erp.print.taxInvoice) : L((d) => d.erp.print.simplifiedTaxInvoice)) : L((d) => d.erp.print.invoice);
  const statusText = s.status === "cancelled" ? L((d) => d.erp.status.cancelled) : L((d) => d.erp.status[s.payment_status as "paid"]);
  const due = Math.max(Number(s.total) - Number(s.returned_total) - Number(s.paid_total), 0);
  const itemName = (p: { name_en: string; name_ar: string }) => (lang === "ar" ? p.name_ar : lang === "en" ? p.name_en : null);

  return (
    <>
      <PrintToolbar />
      <style>{receipt ? "@page { size: 80mm auto; margin: 3mm; }" : "@page { size: A4; margin: 12mm; }"}</style>
      <article
        dir={lang === "ar" ? "rtl" : "ltr"}
        className={cn(
          "mx-auto bg-white text-[#1f2420] shadow-[0_10px_40px_-20px_rgba(0,0,0,.35)] print:shadow-none",
          receipt ? "w-[80mm] px-3 py-4 text-[11px] leading-snug print:w-auto print:p-0" : "w-[210mm] min-h-[297mm] px-[14mm] py-[12mm] text-[12.5px] print:w-auto print:min-h-0 print:p-0",
        )}
      >
        {/* Header */}
        <header className={cn("flex items-start justify-between gap-4 border-b-2 border-[#173d32] pb-4", receipt && "flex-col items-center text-center")}>
          <div className={cn("flex items-center gap-3", receipt && "flex-col gap-1")}>
            <span
              aria-hidden
              className={cn("inline-block bg-[#173d32]", receipt ? "h-9 w-[59px]" : "h-12 w-[79px]")}
              style={{ WebkitMask: "url(/brand/logo-mark.svg) center / contain no-repeat", mask: "url(/brand/logo-mark.svg) center / contain no-repeat" }}
            />
            <div>
              <p className={cn("font-bold text-[#173d32]", receipt ? "text-[13px]" : "text-[17px]")}>{String(st.company_name_en)}</p>
              <p className={cn("font-bold text-[#173d32]", receipt ? "text-[13px]" : "text-[17px]")} dir="rtl">{String(st.company_name_ar)}</p>
              <p className="mt-0.5 text-[#6b6a62]">{String(st.tagline_en ?? "")}</p>
            </div>
          </div>
          <div className={cn("text-[#3b3d38]", receipt ? "" : "text-end")}>
            {st.address_en && <p>{lang === "ar" ? String(st.address_ar ?? st.address_en) : String(st.address_en)}</p>}
            <p dir="ltr">{[st.phone, st.whatsapp && st.whatsapp !== st.phone ? `WhatsApp ${st.whatsapp}` : null].filter(Boolean).join(" · ")}</p>
            {st.email && <p>{String(st.email)}</p>}
            {st.vat_number && <p>{L((d) => d.erp.print.vatNo)}: <span dir="ltr">{String(st.vat_number)}</span></p>}
            {st.cr_number && <p>{L((d) => d.erp.print.crNo)}: <span dir="ltr">{String(st.cr_number)}</span></p>}
          </div>
        </header>

        {qrList.some((q) => q.position === "header") && !receipt && (
          <div className="mt-3 flex justify-end gap-4">
            {qrList.filter((q) => q.position === "header").map((q) => <QrBox key={q.url} q={q} lang={lang} />)}
          </div>
        )}

        {/* Title & meta */}
        <div className={cn("mt-5 flex justify-between gap-6", receipt && "mt-3 flex-col gap-2 text-center")}>
          <div>
            <h1 className={cn("font-bold tracking-wide text-[#173d32] uppercase", receipt ? "text-[14px]" : "text-[22px]")}>{title}</h1>
            <p className="mt-1">
              <span className="text-[#6b6a62]">{L((d) => d.erp.fields.invoiceNo)}: </span>
              <strong dir="ltr">{s.invoice_no}</strong>
            </p>
            <p>
              <span className="text-[#6b6a62]">{L((d) => d.common.date)}: </span>
              {fmtDate(s.sale_date, primary)} · {fmtTime(s.created_at, primary)}
            </p>
            <p>
              <span className="text-[#6b6a62]">{L((d) => d.erp.print.paymentStatus)}: </span>
              <strong>{statusText}</strong>
              {methods.length > 0 && <span className="text-[#6b6a62]"> · {methods.join(", ")}</span>}
            </p>
          </div>
          <div className={cn("rounded-md border border-[#e6dfd0] p-3", receipt ? "text-start" : "min-w-[42%]")}>
            <p className="text-[10px] font-semibold tracking-wider text-[#8f7036] uppercase">{L((d) => d.erp.print.billTo)}</p>
            <p className="mt-1 font-semibold">{lang === "ar" ? c.name_ar || c.name : c.name}{lang === "both" && c.name_ar ? ` · ${c.name_ar}` : ""}</p>
            {c.phone && <p dir="ltr" className="text-start">{c.phone}</p>}
            {(c.address || c.city) && <p>{[c.address, c.city].filter(Boolean).join(", ")}</p>}
            {c.vat_number && <p>{L((d) => d.erp.print.vatNo)}: {c.vat_number}</p>}
          </div>
        </div>

        {/* Lines */}
        <table className={cn("mt-5 w-full border-collapse", receipt && "mt-3")}>
          <thead>
            <tr className="bg-[#173d32] text-white">
              <th className="px-2 py-1.5 text-start font-semibold">{L((d) => d.erp.print.item)}</th>
              <th className="px-2 py-1.5 text-end font-semibold">{L((d) => d.common.qty)}</th>
              {!receipt && <th className="px-2 py-1.5 text-end font-semibold">{L((d) => d.common.unitPrice)}</th>}
              {!receipt && <th className="px-2 py-1.5 text-end font-semibold">{L((d) => d.common.discount)}</th>}
              <th className="px-2 py-1.5 text-end font-semibold">{L((d) => d.common.total)}</th>
            </tr>
          </thead>
          <tbody>
            {((items ?? []) as unknown as { line_no: number; qty: number; unit_price: number; discount_amount: number; line_total: number; products: { name_en: string; name_ar: string; unit: string } }[]).map((i) => (
              <tr key={i.line_no} className="border-b border-[#e6dfd0] align-top">
                <td className="px-2 py-1.5">
                  {itemName(i.products) ?? (
                    <>
                      <span className="block">{i.products.name_en}</span>
                      <span className="block text-[#6b6a62]" dir="rtl">{i.products.name_ar}</span>
                    </>
                  )}
                  {receipt && <span className="block text-[#6b6a62]">{fmtNumber(i.qty, primary, 3)} × {money(i.unit_price)}</span>}
                </td>
                <td className="px-2 py-1.5 text-end tabular-nums">
                  {fmtNumber(i.qty, primary, 3)} {lang === "ar" ? AR.erp.units[i.products.unit as "kg"] : EN.erp.units[i.products.unit as "kg"]}
                </td>
                {!receipt && <td className="px-2 py-1.5 text-end tabular-nums">{money(i.unit_price)}</td>}
                {!receipt && <td className="px-2 py-1.5 text-end tabular-nums">{Number(i.discount_amount) ? money(i.discount_amount) : "—"}</td>}
                <td className="px-2 py-1.5 text-end font-semibold tabular-nums">{money(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className={cn("mt-4 flex justify-end", receipt && "block")}>
          <dl className={cn("space-y-1", receipt ? "w-full" : "w-[46%]")}>
            <TotalRow label={L((d) => d.common.subtotal)} value={money(s.subtotal)} />
            {Number(s.discount_amount) > 0 && <TotalRow label={L((d) => d.common.discount)} value={`− ${money(s.discount_amount)}`} />}
            {vatOn && <TotalRow label={`${L((d) => d.common.vat)} ${Number(s.vat_rate)}%`} value={money(s.vat_amount)} />}
            <TotalRow label={`${L((d) => d.common.total)} (SAR)`} value={money(s.total)} strong />
            {Number(s.returned_total) > 0 && <TotalRow label={L((d) => d.erp.purchases.returned)} value={`− ${money(s.returned_total)}`} />}
            <TotalRow label={L((d) => d.erp.fields.paid)} value={money(s.paid_total)} />
            <TotalRow label={L((d) => d.erp.fields.outstanding)} value={money(s.status === "cancelled" ? 0 : due)} strong />
          </dl>
        </div>

        {s.notes && <p className="mt-4 rounded bg-[#f8f4eb] p-2">{s.notes}</p>}

        {/* QR codes & footer */}
        {(zatca || qrList.some((q) => q.position === "footer")) && (
          <div className={cn("mt-6 flex flex-wrap items-end gap-5 border-t border-[#e6dfd0] pt-4", receipt ? "justify-center" : "justify-between")}>
            {zatca && <QrBox q={{ label_en: "ZATCA", label_ar: "زاتكا", svg: zatca }} lang={lang} />}
            <div className="flex flex-wrap gap-5">
              {qrList.filter((q) => q.position === "footer" || receipt).map((q) => <QrBox key={q.url} q={q} lang={lang} />)}
            </div>
          </div>
        )}
        <footer className="mt-6 border-t border-[#e6dfd0] pt-3 text-center text-[#6b6a62]">
          {lang !== "ar" && st.invoice_footer_en && <p>{String(st.invoice_footer_en)}</p>}
          {lang !== "en" && st.invoice_footer_ar && <p dir="rtl">{String(st.invoice_footer_ar)}</p>}
        </footer>
      </article>
    </>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-[#173d32] pt-1 text-[1.1em] font-bold text-[#173d32]")}>
      <dt>{label}</dt>
      <dd className="tabular-nums" dir="ltr">{value}</dd>
    </div>
  );
}

function QrBox({ q, lang }: { q: { label_en: string; label_ar: string; svg: string }; lang: Lang }) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <span className="block" dangerouslySetInnerHTML={{ __html: q.svg }} />
      <figcaption className="text-[10px] text-[#6b6a62]">{lang === "ar" ? q.label_ar : lang === "en" ? q.label_en : `${q.label_en} · ${q.label_ar}`}</figcaption>
    </figure>
  );
}
