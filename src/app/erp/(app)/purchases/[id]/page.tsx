import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentsTable } from "@/components/erp/doc-tables";
import { DateText, Money, Num } from "@/components/erp/money";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { KeyValues, Section } from "@/components/erp/section";
import { StatusBadge } from "@/components/erp/status-badge";
import { requireSession } from "@/lib/auth";
import { loadPayments } from "@/lib/erp/loaders";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PurchaseActions } from "../purchase-actions";

export default async function PurchasePage(props: PageProps<"/erp/purchases/[id]">) {
  const session = await requireSession();
  if (!session.can("purchases.view")) return <NoAccess />;
  const { id } = await props.params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("purchases")
    .select("*, suppliers(id, name, name_ar), storages(name_en, name_ar), money_accounts(name_en, name_ar)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const [{ data: items }, { data: returns }, { data: allocs }] = await Promise.all([
    supabase
      .from("purchase_items")
      .select("id, qty, unit_price, line_total, landed_unit_cost, returned_qty, expiry_date, batch_id, products(name_en, name_ar, unit), storages(name_en, name_ar), stock_batches(batch_no)")
      .eq("purchase_id", id),
    supabase.from("purchase_returns").select("id, return_no, return_date, reason, total").eq("purchase_id", id).order("created_at"),
    supabase.from("payment_allocations").select("payment_id, amount").eq("doc_type", "purchase").eq("doc_id", id),
  ]);
  const paymentIds = (allocs ?? []).map((a) => a.payment_id);
  const payments = paymentIds.length ? (await loadPayments(supabase, locale, { partyType: "supplier", partyId: p.supplier_id })).filter((x) => paymentIds.includes(x.id)) : [];
  const nm = (r: { name_en?: string; name_ar?: string; name?: string } | null): string => (r ? (locale === "ar" ? r.name_ar || r.name : r.name_en || r.name) ?? "—" : "—");
  const due = Number(p.total) - Number(p.returned_total) - Number(p.paid_total) - Number(p.pending_total);
  const posted = p.status === "posted";
  type Item = { id: string; qty: number; unit_price: number; line_total: number; landed_unit_cost: number; returned_qty: number; expiry_date: string | null; batch_id: string; products: { name_en: string; name_ar: string; unit: string }; storages: { name_en: string; name_ar: string }; stock_batches: { batch_no: string } | null };
  const list = (items ?? []) as unknown as Item[];

  return (
    <>
      <PageHeader
        back={{ href: "/erp/purchases", label: t.purchases.title }}
        title={p.purchase_no}
        description={<Link href={`/erp/suppliers/${p.suppliers.id}`} className="hover:underline">{nm(p.suppliers)}</Link>}
        meta={
          <>
            <StatusBadge status={posted ? p.payment_status : "cancelled"} />
            <span className="text-sm text-muted-foreground"><DateText value={p.purchase_date} /></span>
          </>
        }
        actions={
          posted && (
            <PurchaseActions
              id={id}
              supplier={{ id: p.supplier_id, label: nm(p.suppliers) }}
              doc={due > 0.004 ? { doc_type: "purchase", doc_id: id, label: p.purchase_no, outstanding: Math.round(due * 100) / 100 } : null}
              lines={list.map((i) => ({ id: i.id, label: nm(i.products), available: Number(i.qty) - Number(i.returned_qty) }))}
              canPay={session.can("payments.create")}
              canReturn={session.can("purchases.create")}
              canCancel={session.can("purchases.cancel") && !(returns ?? []).length && !paymentIds.length}
            />
          )
        }
      />
      {!posted && (
        <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm">{dict.common.cancelledReason.replace("{reason}", p.cancel_reason ?? "")}</p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Section title={t.fields.lines} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">{t.fields.product}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t.fields.batch}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{dict.common.qty}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{dict.common.unitPrice}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t.fields.landedCost}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{dict.common.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{nm(i.products)}</p>
                        <p className="text-xs text-muted-foreground">{nm(i.storages)}{i.expiry_date ? ` · ${t.fields.expiry}: ${i.expiry_date}` : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        {i.stock_batches && <Link href={`/erp/batches/${i.batch_id}`} className="font-mono text-xs font-semibold hover:underline">{i.stock_batches.batch_no}</Link>}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Num value={i.qty} /> {t.units[i.products.unit as keyof typeof t.units]}
                        {Number(i.returned_qty) > 0 && <p className="text-xs text-destructive">−<Num value={i.returned_qty} /> {t.purchases.returned}</p>}
                      </td>
                      <td className="px-4 py-3 text-end"><Money value={i.unit_price} currency={false} /></td>
                      <td className="px-4 py-3 text-end text-muted-foreground"><Money value={i.landed_unit_cost} currency={false} /></td>
                      <td className="px-4 py-3 text-end font-semibold"><Money value={i.line_total} currency={false} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {(returns ?? []).length > 0 && (
            <Section title={t.purchases.returns}>
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
            <Section title={t.purchases.payments} bodyClassName="p-0 [&>div]:border-none">
              <PaymentsTable rows={payments} showParty={false} search={false} canVerify={session.can("payments.verify")} canCancel={session.can("payments.cancel")} />
            </Section>
          )}
        </div>
        <div className="space-y-6">
          <Section title={dict.common.total}>
            <dl className="space-y-2 text-sm">
              <Row label={dict.common.subtotal} value={p.subtotal} />
              <Row label={t.fields.transport} value={p.transport_cost} />
              <Row label={t.fields.loading} value={p.loading_cost} />
              <Row label={t.fields.otherCost} value={p.other_cost} />
              <Row label={dict.common.vat} value={p.vat_amount} />
              <Row label={dict.common.total} value={p.total} strong />
              {Number(p.returned_total) > 0 && <Row label={t.purchases.returned} value={-p.returned_total} />}
              <Row label={t.fields.paid} value={-p.paid_total} />
              {Number(p.pending_total) > 0 && <Row label={t.status.pending_verification} value={-p.pending_total} />}
              <Row label={t.fields.outstanding} value={posted ? due : 0} strong />
            </dl>
          </Section>
          <Section title={dict.common.details}>
            <KeyValues
              cols={1}
              items={[
                { label: t.fields.storage, value: nm(p.storages) },
                { label: t.fields.supplierInvoiceNo, value: p.supplier_invoice_no },
                { label: t.fields.extrasPaidFrom, value: p.money_accounts ? nm(p.money_accounts) : t.fields.extrasOnBill },
                { label: dict.common.notes, value: p.notes },
              ]}
            />
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
