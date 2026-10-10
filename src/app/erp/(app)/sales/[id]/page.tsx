import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Truck } from "lucide-react";
import { PaymentsTable } from "@/components/erp/doc-tables";
import { DateText, Money, Num } from "@/components/erp/money";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { KeyValues, Section } from "@/components/erp/section";
import { StatusBadge } from "@/components/erp/status-badge";
import { requireSession } from "@/lib/auth";
import { loadPayments } from "@/lib/erp/loaders";
import { fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { SaleActions } from "../sale-actions";

const SALE_COLS =
  "id, invoice_no, sale_date, created_at, currency, fx_rate, customer_id, storage_id, driver_id, subtotal, discount_amount, taxable_amount, vat_rate, vat_amount, total, total_kg, returned_total, paid_total, pending_total, payment_status, status, notes, cancel_reason, customers(id, name, name_ar, phone, whatsapp, email), storages(name_en, name_ar), drivers(id, name, name_ar)";

export default async function SalePage(props: PageProps<"/erp/sales/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const { data: s } = await supabase.from("sales").select(SALE_COLS).eq("id", id).maybeSingle();
  if (!s) return session.can("sales.view") ? notFound() : <NoAccess />;
  type Item = { id: string; line_no: number; qty: number; unit_price: number; unit_price_fc: number | null; discount_amount: number; line_total: number; weight_kg: number; returned_qty: number; products: { name_en: string; name_ar: string; unit: string; sku: string } };
  const [{ data: items }, { data: returns }, { data: allocs }, internal, { data: deliveries }] = await Promise.all([
    supabase.from("sale_items").select("id, line_no, qty, unit_price, unit_price_fc, discount_amount, line_total, weight_kg, returned_qty, products(name_en, name_ar, unit, sku)").eq("sale_id", id).order("line_no"),
    supabase.from("sale_returns").select("id, return_no, return_date, reason, total").eq("sale_id", id).order("created_at"),
    supabase.from("payment_allocations").select("payment_id").eq("doc_type", "sale").eq("doc_id", id),
    session.canAny("products.view_cost", "reports.financial", "commissions.view") ? supabase.rpc("sale_internal", { p_sale: id }) : Promise.resolve({ data: null }),
    supabase.from("deliveries").select("id, delivery_no, status, scheduled_date").eq("sale_id", id),
  ]);
  const paymentIds = (allocs ?? []).map((a) => a.payment_id);
  const payments =
    paymentIds.length && session.canAny("payments.view", "accounts.view")
      ? (await loadPayments(supabase, locale, { partyType: "customer", partyId: s.customer_id })).filter((x) => paymentIds.includes(x.id))
      : [];
  const c = s.customers as unknown as { id: string; name: string; name_ar: string | null; phone: string | null; whatsapp: string | null; email: string | null };
  const nm = (r: { name_en?: string; name_ar?: string | null; name?: string } | null): string => (r ? ((locale === "ar" ? r.name_ar || r.name : r.name_en || r.name) ?? "—") : "—");
  const list = (items ?? []) as unknown as Item[];
  const due = Number(s.total) - Number(s.returned_total) - Number(s.paid_total) - Number(s.pending_total);
  const posted = s.status === "posted";
  const inside = internal.data as { cogs: number | null; gross_profit: number | null; commission: number | null } | null;
  const shareText =
    locale === "ar"
      ? `${dict.common.brand}\nفاتورة ${s.invoice_no}\nالتاريخ: ${s.sale_date}\nالإجمالي: ${fmtMoney(Number(s.total) - Number(s.returned_total), locale)}\nالمتبقي: ${fmtMoney(Math.max(due, 0), locale)}`
      : `${dict.common.brand}\nInvoice ${s.invoice_no}\nDate: ${s.sale_date}\nTotal: ${fmtMoney(Number(s.total) - Number(s.returned_total), locale)}\nBalance due: ${fmtMoney(Math.max(due, 0), locale)}`;

  return (
    <>
      <PageHeader
        back={{ href: "/erp/sales", label: t.sales.title }}
        title={s.invoice_no}
        description={<Link href={`/erp/customers/${c.id}`} className="hover:underline">{nm(c)}</Link>}
        meta={
          <>
            <StatusBadge status={posted ? s.payment_status : "cancelled"} />
            <span className="text-sm text-muted-foreground"><DateText value={s.created_at} withTime /></span>
          </>
        }
        actions={
          <SaleActions
            id={id}
            customer={{ id: c.id, label: nm(c) }}
            doc={posted && due > 0.004 ? { doc_type: "sale", doc_id: id, label: s.invoice_no, outstanding: Math.round(due * 100) / 100 } : null}
            lines={list.map((i) => ({ id: i.id, label: nm(i.products), available: Number(i.qty) - Number(i.returned_qty) }))}
            whatsapp={c.whatsapp || c.phone}
            canCollect={posted && session.canAny("payments.create", "sales.collect")}
            canRefund={posted && session.can("payments.create")}
            canReturn={posted && session.can("sales.create")}
            canCancel={posted && session.can("sales.cancel") && !(returns ?? []).length && !paymentIds.length}
            shareText={shareText}
            customerEmail={c.email}
          />
        }
      />
      {!posted && <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm">{dict.common.cancelledReason.replace("{reason}", s.cancel_reason ?? "")}</p>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Section title={t.fields.lines} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">{t.fields.product}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{dict.common.qty}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{dict.common.unitPrice}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{dict.common.discount}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{dict.common.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{nm(i.products)}</p>
                        <p className="text-xs text-muted-foreground">{i.products.sku} · <Num value={i.weight_kg} digits={2} /> {dict.common.kg}</p>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Num value={i.qty} /> {t.units[i.products.unit as keyof typeof t.units]}
                        {Number(i.returned_qty) > 0 && <p className="text-xs text-destructive">−<Num value={i.returned_qty} /></p>}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Money value={i.unit_price} currency={false} />
                        {s.currency !== "SAR" && i.unit_price_fc !== null && <span className="block text-xs text-muted-foreground" dir="ltr">{s.currency} {Number(i.unit_price_fc).toFixed(2)}</span>}
                      </td>
                      <td className="px-4 py-3 text-end text-muted-foreground">{Number(i.discount_amount) ? <Money value={i.discount_amount} currency={false} /> : "—"}</td>
                      <td className="px-4 py-3 text-end font-semibold"><Money value={i.line_total} currency={false} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {(returns ?? []).length > 0 && (
            <Section title={t.sales.returns}>
              <ul className="divide-y text-sm">
                {(returns ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <span><span className="font-mono text-xs font-semibold">{r.return_no}</span> · <DateText value={r.return_date} /> · {r.reason}</span>
                    <Money value={r.total} className="font-semibold" />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {session.canAny("payments.view", "accounts.view") && (
            <Section title={t.sales.payments} bodyClassName="p-0 [&>div]:border-none">
              <PaymentsTable rows={payments} showParty={false} search={false} canVerify={session.can("payments.verify")} canCancel={session.can("payments.cancel")} />
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title={dict.common.total}>
            <dl className="space-y-2 text-sm">
              <Row label={dict.common.subtotal} value={s.subtotal} />
              {Number(s.discount_amount) > 0 && <Row label={t.sales.invoiceDiscount} value={-s.discount_amount} />}
              {Number(s.vat_amount) > 0 && <Row label={`${dict.common.vat} (${Number(s.vat_rate)}%)`} value={s.vat_amount} />}
              <Row label={dict.common.total} value={s.total} strong />
              {Number(s.returned_total) > 0 && <Row label={t.purchases.returned} value={-s.returned_total} />}
              <Row label={t.fields.paid} value={-s.paid_total} />
              {Number(s.pending_total) > 0 && <Row label={t.status.pending_verification} value={-s.pending_total} />}
              <Row label={t.fields.outstanding} value={posted ? due : 0} strong />
            </dl>
          </Section>
          {inside && (inside.cogs !== null || inside.gross_profit !== null || inside.commission !== null) && (
            <Section title={<span className="inline-flex items-center gap-1.5"><Lock className="size-3.5 text-gold-700" />{t.sales.internal}</span>} className="border-gold-500/40 bg-gold-100/30">
              <dl className="space-y-2 text-sm">
                {inside.cogs !== null && <Row label={t.sales.cogs} value={inside.cogs} />}
                {inside.gross_profit !== null && <Row label={t.sales.margin} value={inside.gross_profit} strong />}
                {inside.commission !== null && <Row label={t.sales.commission} value={inside.commission} />}
              </dl>
            </Section>
          )}
          <Section title={dict.common.details}>
            <KeyValues
              cols={1}
              items={[
                { label: t.fields.storage, value: nm(s.storages as unknown as { name_en: string; name_ar: string }) },
                { label: t.fields.driver, value: s.drivers ? <Link href={`/erp/drivers/${(s.drivers as unknown as { id: string }).id}`} className="hover:underline">{nm(s.drivers as unknown as { name: string; name_ar: string | null })}</Link> : null },
                ...(s.currency !== "SAR" ? [{ label: t.sales.currency, value: <span dir="ltr">{s.currency} · 1 {s.currency} = {Number(s.fx_rate).toFixed(4)} SAR</span> }] : []),
                { label: t.fields.kgTotal, value: <><Num value={s.total_kg} digits={2} /> {dict.common.kg}</> },
                { label: dict.common.notes, value: s.notes },
              ]}
            />
            {(deliveries ?? []).map((d) => (
              <Link key={d.id} href={`/erp/deliveries?open=${d.id}`} className="mt-4 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:border-gold-500/50">
                <span className="inline-flex items-center gap-2"><Truck className="size-4 text-palm-700" /> {d.delivery_no}</span>
                <StatusBadge status={d.status} />
              </Link>
            ))}
          </Section>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t pt-2 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd><Money value={value} /></dd>
    </div>
  );
}
