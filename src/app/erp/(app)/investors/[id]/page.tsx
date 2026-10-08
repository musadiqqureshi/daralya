import Link from "next/link";
import { notFound } from "next/navigation";
import { HandCoins, Pencil, Plus, Printer } from "lucide-react";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { PaymentsTable } from "@/components/erp/doc-tables";
import { Money } from "@/components/erp/money";
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
import { loadPayments, loadStatement } from "@/lib/erp/loaders";
import { readRange } from "@/lib/erp/range";
import { fmtDate, fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AgreementLink, AllocationDialog, AllocationsTable, EditInvestorButton, InvestmentDialog, type AllocRow } from "../investors-ui";

export default async function InvestorPage(props: PageProps<"/erp/investors/[id]">) {
  const session = await requireSession();
  if (!session.can("investors.view")) return <NoAccess />;
  const { id } = await props.params;
  const { from, to } = readRange(await props.searchParams, "month");
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const { data: inv } = await supabase.from("investors").select("*").eq("id", id).maybeSingle();
  if (!inv) notFound();
  const [{ data: investments }, { data: summary }, { data: allocs }, payments, statement] = await Promise.all([
    supabase.from("investments").select("*").eq("investor_id", id).order("start_date"),
    supabase.from("v_investment_summary").select("*").eq("investor_id", id),
    supabase.from("profit_allocations").select("id, allocation_no, investment_id, kind, period_label, basis_net_profit, share_pct, amount, status, approved_at, reason").eq("investor_id", id).order("created_at", { ascending: false }),
    loadPayments(supabase, locale, { partyType: "investor", partyId: id }),
    loadStatement(supabase, "investor", id, from, to),
  ]);
  const paths = (investments ?? []).map((i) => i.agreement_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("documents").createSignedUrls(paths, 1800);
    for (const u of data ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const sum = new Map((summary ?? []).map((s) => [s.investment_id, s]));
  const totals = (summary ?? []).reduce((a, s) => ({ cin: a.cin + Number(s.capital_in), cret: a.cret + Number(s.capital_returned), cap: a.cap + Number(s.capital_balance), earned: a.earned + Number(s.profit_earned), paid: a.paid + Number(s.profit_paid), owed: a.owed + Number(s.profit_outstanding) }), { cin: 0, cret: 0, cap: 0, earned: 0, paid: 0, owed: 0 });
  const invLabel = (i: { investment_no: string; project_name: string | null }) => `${i.investment_no}${i.project_name ? ` · ${i.project_name}` : ""}`;
  const invOpts = (investments ?? []).filter((i) => i.status === "active").map((i) => ({ value: i.id, label: invLabel(i), sub: t.models[i.model as keyof typeof t.models] }));
  const name = (locale === "ar" ? inv.name_ar || inv.name : inv.name) as string;
  const allocRows: AllocRow[] = (allocs ?? []).map((a) => ({
    id: a.id,
    allocation_no: a.allocation_no,
    investment: invLabel((investments ?? []).find((i) => i.id === a.investment_id) ?? { investment_no: "", project_name: null }),
    kind: a.kind,
    period_label: a.period_label,
    basis: a.basis_net_profit === null ? null : Number(a.basis_net_profit),
    share_pct: a.share_pct === null ? null : Number(a.share_pct),
    amount: Number(a.amount),
    status: a.status,
    approved_at: a.approved_at,
    reason: a.reason,
  }));
  const canPay = session.can("payments.create") && session.can("investors.manage");
  const qs = new URLSearchParams({ type: "investor", id, from, to }).toString();

  return (
    <>
      <PageHeader
        back={{ href: "/erp/investors", label: t.investors.title }}
        title={name}
        description={inv.investor_no}
        actions={
          <>
            {canPay && invOpts.length > 0 && (
              <>
                <PaymentDialog purposes={["investor_capital_in"]} party={{ id, label: name }} investments={invOpts} title={t.investors.receiveCapital} trigger={<Button variant="outline"><Plus />{t.investors.receiveCapital}</Button>} />
                <PaymentDialog purposes={["investor_profit"]} party={{ id, label: name }} investments={invOpts} defaultAmount={totals.owed > 0 ? Math.round(totals.owed * 100) / 100 : undefined} title={t.investors.payProfit} trigger={<Button><HandCoins />{t.investors.payProfit}</Button>} />
                <PaymentDialog purposes={["investor_capital_return"]} party={{ id, label: name }} investments={invOpts} title={t.investors.returnCapital} trigger={<Button variant="outline">{t.investors.returnCapital}</Button>} />
              </>
            )}
            {session.can("investors.manage") && <EditInvestorButton initial={{ id, name: inv.name, name_ar: inv.name_ar, phone: inv.phone, email: inv.email, id_number: inv.id_number, address: inv.address, notes: inv.notes }} />}
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.investors.capitalBalance} value={fmtMoney(totals.cap, locale)} hint={`${t.investors.capitalIn}: ${fmtMoney(totals.cin, locale)} · ${t.investors.capitalReturned}: ${fmtMoney(totals.cret, locale)}`} tone="brand" />
        <StatCard label={t.investors.profitEarned} value={fmtMoney(totals.earned, locale)} />
        <StatCard label={t.investors.profitPaid} value={fmtMoney(totals.paid, locale)} />
        <StatCard label={t.investors.profitOutstanding} value={fmtMoney(totals.owed, locale)} tone={totals.owed > 0 ? "warning" : "default"} />
      </div>

      <Section title={t.fields.investment} className="mb-6" actions={session.can("investors.manage") && <InvestmentDialog investorId={id} trigger={<Button size="sm"><Plus />{t.investors.newInvestment}</Button>} />} bodyClassName="p-0">
        {(investments ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t.investors.empty}</p>
        ) : (
          <ul className="divide-y">
            {(investments ?? []).map((i) => {
              const s = sum.get(i.id);
              return (
                <li key={i.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-palm-900">{invLabel(i)}</p>
                      <StatusBadge status={i.status} />
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{t.models[i.model as keyof typeof t.models]}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.fields.committed}: <Money value={i.committed_amount} /> · {fmtDate(i.start_date, locale)}{i.end_date ? ` – ${fmtDate(i.end_date, locale)}` : ""}
                      {i.profit_share_pct !== null ? ` · ${Number(i.profit_share_pct)}%` : ""} · {t.frequencies[i.profit_frequency as keyof typeof t.frequencies]}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                      <div><dt className="text-xs text-muted-foreground">{t.investors.capitalBalance}</dt><dd className="font-semibold"><Money value={s?.capital_balance} /></dd></div>
                      <div><dt className="text-xs text-muted-foreground">{t.investors.profitEarned}</dt><dd><Money value={s?.profit_earned} /></dd></div>
                      <div><dt className="text-xs text-muted-foreground">{t.investors.profitPaid}</dt><dd><Money value={s?.profit_paid} /></dd></div>
                      <div><dt className="text-xs text-muted-foreground">{t.investors.profitOutstanding}</dt><dd className="font-semibold"><Money value={s?.profit_outstanding} /></dd></div>
                    </dl>
                    {i.terms && <p className="mt-2 text-xs whitespace-pre-line text-muted-foreground">{i.terms}</p>}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <AgreementLink url={i.agreement_path ? signed.get(i.agreement_path) ?? null : null} />
                    {session.can("investors.manage") && i.status === "active" && (
                      <AllocationDialog
                        investment={{ id: i.id, label: invLabel(i), share: i.profit_share_pct === null ? (i.equity_pct === null ? null : Number(i.equity_pct)) : Number(i.profit_share_pct), model: i.model }}
                        approved={allocRows.filter((a) => a.status === "approved" && (allocs ?? []).find((x) => x.id === a.id)?.investment_id === i.id).map((a) => ({ id: a.id, label: `${a.allocation_no} · ${a.period_label}` }))}
                        canSeeBooks={session.can("reports.financial")}
                      />
                    )}
                    {session.can("investors.manage") && (
                      <InvestmentDialog
                        investorId={id}
                        initial={{ ...i, committed_amount: Number(i.committed_amount), profit_share_pct: i.profit_share_pct ?? "", equity_pct: i.equity_pct ?? "" }}
                        trigger={<Button size="icon-sm" variant="ghost" aria-label={dict.common.edit}><Pencil /></Button>}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <UrlTabs
          tabs={[
            { value: "allocations", label: t.investors.allocations, count: allocRows.filter((a) => a.status === "draft").length, content: <AllocationsTable rows={allocRows} canApprove={session.can("investors.approve_profit")} canManage={session.can("investors.manage")} /> },
            { value: "payments", label: t.customers.payments, content: <PaymentsTable rows={payments} showParty={false} canVerify={session.can("payments.verify")} canCancel={session.can("payments.cancel")} /> },
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
          <KeyValues cols={1} items={[{ label: dict.common.phone, value: inv.phone }, { label: dict.common.email, value: inv.email }, { label: t.staff.idNumber, value: inv.id_number }, { label: dict.common.address, value: inv.address }, { label: dict.common.notes, value: inv.notes }]} />
          <p className="mt-4 text-xs text-muted-foreground">{t.investors.privacy}</p>
        </Section>
      </div>
    </>
  );
}
