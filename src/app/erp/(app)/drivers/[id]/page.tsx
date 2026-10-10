import Link from "next/link";
import { notFound } from "next/navigation";
import { HandCoins, Pencil, Printer } from "lucide-react";
import { ActiveToggle } from "@/components/erp/active-toggle";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { PaymentsTable, SalesTable } from "@/components/erp/doc-tables";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
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
import { CommissionsTable, DriverForm, type CommissionRow } from "../drivers-ui";

export default async function DriverPage(props: PageProps<"/erp/drivers/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;
  const own = session.profile.driver_id === id;
  if (!session.can("drivers.view") && !own) return <NoAccess />;
  const { from, to } = readRange(await props.searchParams, "month");
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const { data: d } = await supabase.from("drivers").select("*").eq("id", id).maybeSingle();
  if (!d) notFound();
  const [{ data: comms }, { data: bal }, sales, payments, statement, { data: customers }] = await Promise.all([
    supabase.from("commissions").select("id, created_at, rule, basis, amount, note, sale_id, sales(invoice_no)").eq("driver_id", id).order("created_at", { ascending: false }).limit(500),
    supabase.from("v_party_balances").select("balance").eq("party_type", "driver").eq("party_id", id).eq("gl_code", "2300").maybeSingle(),
    loadSales(supabase, locale, { driverId: id }),
    loadPayments(supabase, locale, { partyType: "driver", partyId: id }),
    loadStatement(supabase, "driver", id, from, to),
    supabase.from("customers").select("id, name, name_ar, phone").eq("driver_id", id),
  ]);
  const owed = -Number(bal?.balance ?? 0);
  const commRows: CommissionRow[] = ((comms ?? []) as unknown as Record<string, never>[]).map((c) => ({
    id: c.id,
    created_at: c.created_at,
    rule: c.rule,
    basis: Number(c.basis),
    amount: Number(c.amount),
    note: c.note,
    sale_id: c.sale_id,
    invoice_no: (c.sales as { invoice_no: string } | null)?.invoice_no ?? "",
  }));
  const earned = commRows.reduce((s, c) => s + c.amount, 0);
  const qs = new URLSearchParams({ type: "driver", id, from, to }).toString();
  const name = locale === "ar" ? d.name_ar || d.name : d.name;

  return (
    <>
      <PageHeader
        back={session.can("drivers.view") ? { href: "/erp/drivers", label: t.drivers.title } : undefined}
        title={name}
        description={`${d.code} · ${t.driverKinds[d.kind as "driver"]}`}
        meta={<StatusBadge status={d.is_active ? "active" : "inactive"} />}
        actions={
          <>
            {session.can("payments.create") && session.can("commissions.view") && (
              <PaymentDialog
                purposes={["driver_commission"]}
                party={{ id, label: name }}
                defaultAmount={owed > 0 ? owed : undefined}
                title={t.drivers.payCommission}
                trigger={<Button><HandCoins />{t.drivers.payCommission}</Button>}
              />
            )}
            {session.can("drivers.manage") && (
              <DriverForm
                initial={{ id, kind: d.kind, name: d.name, name_ar: d.name_ar, phone: d.phone, vehicle_type: d.vehicle_type, vehicle_no: d.vehicle_no, commission_type: d.commission_type, commission_value: Number(d.commission_value), notes: d.notes }}
                trigger={<Button variant="outline" size="icon" aria-label={dict.common.edit}><Pencil /></Button>}
              />
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t.drivers.earned} value={fmtMoney(earned, locale)} />
        <StatCard label={t.drivers.paidOut} value={fmtMoney(payments.filter((p) => p.status === "verified").reduce((s, p) => s + p.amount, 0), locale)} />
        <StatCard label={t.drivers.owed} value={fmtMoney(owed, locale)} tone={owed > 0 ? "brand" : "default"} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_20rem]">
        <UrlTabs
          tabs={[
            { value: "commissions", label: t.drivers.commissionHistory, content: <CommissionsTable rows={commRows} /> },
            { value: "sales", label: t.customers.invoices, content: <SalesTable rows={sales} /> },
            { value: "payments", label: t.customers.payments, content: <PaymentsTable rows={payments} showParty={false} canCancel={session.can("payments.cancel")} /> },
            {
              value: "statement",
              label: t.customers.statement,
              content: (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <DateRangeFilter from={from} to={to} />
                    <Button asChild variant="outline" size="sm"><Link href={`/print/statement?${qs}`} target="_blank"><Printer />{dict.common.print}</Link></Button>
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
              { label: dict.common.phone, value: d.phone ? <a href={`tel:${d.phone}`} dir="ltr">{d.phone}</a> : null },
              { label: t.fields.vehicle, value: [d.vehicle_type, d.vehicle_no].filter(Boolean).join(" · ") || null },
              { label: t.fields.commissionRule, value: `${t.commissionTypes[d.commission_type as keyof typeof t.commissionTypes]}${d.commission_type !== "none" ? ` · ${Number(d.commission_value)}${d.commission_type === "percent" ? "%" : ""}` : ""}` },
              { label: t.nav.customers, value: (customers ?? []).length ? <ul className="space-y-1">{(customers ?? []).map((c) => <li key={c.id}><Link href={`/erp/customers/${c.id}`} className="hover:underline">{locale === "ar" ? c.name_ar || c.name : c.name}</Link></li>)}</ul> : null },
              { label: dict.common.notes, value: d.notes },
            ]}
          />
          {session.can("drivers.manage") && <div className="mt-5 border-t pt-4"><ActiveToggle kind="driver" id={id} active={d.is_active} /></div>}
        </Section>
      </div>
    </>
  );
}
