import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet, HandCoins, Pencil, Printer, Receipt } from "lucide-react";
import { ActiveToggle } from "@/components/erp/active-toggle";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { PaymentsTable, SalesTable } from "@/components/erp/doc-tables";
import { Money } from "@/components/erp/money";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { PartyForm } from "@/components/erp/party-form";
import { PaymentDialog } from "@/components/erp/payment-dialog";
import { KeyValues, Section } from "@/components/erp/section";
import { StatCard } from "@/components/erp/stat-card";
import { StatementTable } from "@/components/erp/statement-table";
import { StatusBadge } from "@/components/erp/status-badge";
import { UrlTabs } from "@/components/erp/url-tabs";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { loadPayments, loadSales, loadStatement } from "@/lib/erp/loaders";
import { readRange } from "@/lib/erp/range";
import { fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerPage(props: PageProps<"/erp/customers/[id]">) {
  const session = await requireSession();
  if (!session.can("customers.view")) return <NoAccess />;
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { from, to } = readRange(sp, "month");
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();

  const { data: c } = await supabase.from("customers").select("*, drivers(id, name)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: bal }, sales, payments, statement, { data: drivers }] = await Promise.all([
    supabase.from("v_party_balances").select("balance").eq("party_type", "customer").eq("party_id", id).eq("gl_code", "1200").maybeSingle(),
    loadSales(supabase, locale, { customerId: id }),
    session.canAny("payments.view", "accounts.view") ? loadPayments(supabase, locale, { partyType: "customer", partyId: id }) : Promise.resolve([]),
    loadStatement(supabase, "customer", id, from, to),
    supabase.from("drivers").select("id, name, kind").eq("is_active", true),
  ]);
  const balance = Number(bal?.balance ?? 0);
  const posted = sales.filter((s) => s.status === "posted");
  const billed = posted.reduce((s, r) => s + r.total - r.returned_total, 0);
  const pending = posted.reduce((s, r) => s + r.pending_total, 0);
  const openDocs = posted
    .filter((s) => s.total - s.returned_total - s.paid_total - s.pending_total > 0.004)
    .map((s) => ({ doc_type: "sale" as const, doc_id: s.id, label: `${s.invoice_no} · ${s.sale_date}`, outstanding: Math.round((s.total - s.returned_total - s.paid_total - s.pending_total) * 100) / 100 }));
  const canCollect = session.canAny("payments.create", "sales.collect");
  const qs = new URLSearchParams({ type: "customer", id, from, to }).toString();

  return (
    <>
      <PageHeader
        back={{ href: "/erp/customers", label: t.customers.title }}
        title={c.name}
        description={c.name_ar ?? undefined}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
            <StatusBadge status={c.is_active ? "active" : "inactive"} />
          </>
        }
        actions={
          <>
            {session.can("sales.create") && c.is_active && (
              <Button asChild variant="outline">
                <Link href={`/erp/sales/new?customer=${id}`}>
                  <Receipt />
                  {t.sales.new}
                </Link>
              </Button>
            )}
            {canCollect && (
              <PaymentDialog
                purposes={session.can("payments.create") ? ["customer_receipt", "customer_refund"] : ["customer_receipt"]}
                party={{ id, label: c.name }}
                docs={openDocs}
                defaultAmount={balance > 0 ? balance : undefined}
                title={t.customers.receivePayment}
                trigger={
                  <Button>
                    <HandCoins />
                    {t.customers.receivePayment}
                  </Button>
                }
              />
            )}
            {session.can("customers.manage") && (
              <PartyForm
                kind="customer"
                initial={{ ...c, credit_limit: c.credit_limit ?? "" }}
                drivers={(drivers ?? []).map((d) => ({ value: d.id, label: d.name, sub: t.driverKinds[d.kind as "driver" | "agent"] }))}
                trigger={
                  <Button variant="outline" size="icon" aria-label={dict.common.edit}>
                    <Pencil />
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={dict.common.balance} value={fmtMoney(balance, locale)} hint={t.customers.balanceHint} tone={balance > 0 ? "brand" : "default"} />
        <StatCard label={t.customers.totalBilled} value={fmtMoney(billed, locale)} hint={`${posted.length} ${t.customers.invoices}`} />
        <StatCard label={t.status.pending_verification} value={fmtMoney(pending, locale)} />
        <StatCard label={t.fields.creditLimit} value={c.credit_limit ? fmtMoney(c.credit_limit, locale) : "—"} tone={c.credit_limit && balance > Number(c.credit_limit) ? "negative" : "default"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_20rem]">
        <UrlTabs
          tabs={[
            { value: "invoices", label: t.customers.invoices, count: posted.length, content: <SalesTable rows={sales} showCustomer={false} /> },
            ...(session.canAny("payments.view", "accounts.view")
              ? [{ value: "payments", label: t.customers.payments, content: <PaymentsTable rows={payments} showParty={false} canVerify={session.can("payments.verify")} canCancel={session.can("payments.cancel")} /> }]
              : []),
            {
              value: "statement",
              label: t.customers.statement,
              content: (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <DateRangeFilter from={from} to={to} />
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/print/statement?${qs}`} target="_blank">
                          <Printer />
                          {dict.common.print}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/export/statement?${qs}`}>
                          <FileSpreadsheet />
                          {dict.common.exportExcel}
                        </a>
                      </Button>
                    </div>
                  </div>
                  <StatementTable rows={statement} />
                </div>
              ),
            },
          ]}
        />
        <Section title={dict.common.details}>
          <KeyValues
            cols={1}
            items={[
              { label: dict.common.phone, value: c.phone ? <a href={`tel:${c.phone}`} dir="ltr" className="hover:underline">{c.phone}</a> : null },
              { label: dict.common.whatsapp, value: c.whatsapp ? <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="hover:underline">{c.whatsapp}</a> : null },
              { label: dict.common.email, value: c.email },
              { label: dict.common.address, value: [c.address, c.city].filter(Boolean).join(", ") || null },
              { label: t.fields.vatNumber, value: c.vat_number },
              { label: t.customers.referredBy, value: c.drivers ? <Link href={`/erp/drivers/${c.drivers.id}`} className="hover:underline">{c.drivers.name}</Link> : null },
              { label: dict.common.notes, value: c.notes },
              { label: t.fields.openingBalance, value: <Money value={c.opening_balance} /> },
            ]}
          />
          {session.can("customers.manage") && (
            <div className="mt-5 border-t pt-4">
              <ActiveToggle kind="customer" id={id} active={c.is_active} />
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
