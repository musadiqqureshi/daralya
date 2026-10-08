import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet, HandCoins, Pencil, Printer, ShoppingCart } from "lucide-react";
import { ActiveToggle } from "@/components/erp/active-toggle";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { PaymentsTable, PurchasesTable } from "@/components/erp/doc-tables";
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
import { loadPayments, loadPurchases, loadStatement } from "@/lib/erp/loaders";
import { readRange } from "@/lib/erp/range";
import { fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function SupplierPage(props: PageProps<"/erp/suppliers/[id]">) {
  const session = await requireSession();
  if (!session.can("suppliers.view")) return <NoAccess />;
  const { id } = await props.params;
  const { from, to } = readRange(await props.searchParams, "month");
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const { data: s } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: bal }, purchases, payments, statement] = await Promise.all([
    supabase.from("v_party_balances").select("balance").eq("party_type", "supplier").eq("party_id", id).eq("gl_code", "2100").maybeSingle(),
    session.can("purchases.view") ? loadPurchases(supabase, locale, { supplierId: id }) : Promise.resolve([]),
    session.canAny("payments.view", "accounts.view") ? loadPayments(supabase, locale, { partyType: "supplier", partyId: id }) : Promise.resolve([]),
    loadStatement(supabase, "supplier", id, from, to),
  ]);
  const owed = -Number(bal?.balance ?? 0);
  const posted = purchases.filter((p) => p.status === "posted");
  const total = posted.reduce((sum, r) => sum + r.total - r.returned_total, 0);
  const openDocs = posted
    .filter((p) => p.total - p.returned_total - p.paid_total > 0.004)
    .map((p) => ({ doc_type: "purchase" as const, doc_id: p.id, label: `${p.purchase_no} · ${p.purchase_date}`, outstanding: Math.round((p.total - p.returned_total - p.paid_total) * 100) / 100 }));
  const qs = new URLSearchParams({ type: "supplier", id, from, to }).toString();

  return (
    <>
      <PageHeader
        back={{ href: "/erp/suppliers", label: t.suppliers.title }}
        title={s.name}
        description={s.name_ar ?? undefined}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
            <StatusBadge status={s.is_active ? "active" : "inactive"} />
          </>
        }
        actions={
          <>
            {session.can("purchases.create") && s.is_active && (
              <Button asChild variant="outline">
                <Link href={`/erp/purchases/new?supplier=${id}`}>
                  <ShoppingCart />
                  {t.purchases.new}
                </Link>
              </Button>
            )}
            {session.can("payments.create") && (
              <PaymentDialog
                purposes={["supplier_payment", "supplier_refund"]}
                party={{ id, label: s.name }}
                docs={openDocs}
                defaultAmount={owed > 0 ? owed : undefined}
                title={t.suppliers.pay}
                trigger={
                  <Button>
                    <HandCoins />
                    {t.suppliers.pay}
                  </Button>
                }
              />
            )}
            {session.can("suppliers.manage") && (
              <PartyForm
                kind="supplier"
                initial={s}
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
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={dict.common.balance} value={fmtMoney(owed, locale)} hint={t.suppliers.balanceHint} tone={owed > 0 ? "brand" : "default"} />
        <StatCard label={t.suppliers.totalPurchased} value={fmtMoney(total, locale)} hint={`${posted.length} ${t.suppliers.purchases}`} />
        <StatCard label={t.fields.paid} value={fmtMoney(posted.reduce((sum, r) => sum + r.paid_total, 0), locale)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <UrlTabs
          tabs={[
            { value: "purchases", label: t.suppliers.purchases, count: posted.length, content: <PurchasesTable rows={purchases} showSupplier={false} /> },
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
              { label: dict.common.phone, value: s.phone ? <a href={`tel:${s.phone}`} dir="ltr">{s.phone}</a> : null },
              { label: dict.common.whatsapp, value: s.whatsapp },
              { label: dict.common.email, value: s.email },
              { label: dict.common.address, value: [s.address, s.city].filter(Boolean).join(", ") || null },
              { label: t.fields.vatNumber, value: s.vat_number },
              { label: dict.common.notes, value: s.notes },
              { label: t.fields.openingBalance, value: <Money value={s.opening_balance} /> },
            ]}
          />
          {session.can("suppliers.manage") && (
            <div className="mt-5 border-t pt-4">
              <ActiveToggle kind="supplier" id={id} active={s.is_active} />
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
