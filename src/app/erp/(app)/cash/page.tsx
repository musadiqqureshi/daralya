import { HandCoins } from "lucide-react";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { PaymentsTable } from "@/components/erp/doc-tables";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { PaymentDialog } from "@/components/erp/payment-dialog";
import { UrlTabs } from "@/components/erp/url-tabs";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { loadPayments } from "@/lib/erp/loaders";
import { partyOptions } from "@/lib/erp/party-options";
import { readRange } from "@/lib/erp/range";
import type { PURPOSES } from "@/lib/erp/schemas";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AccountCards, CashClosingDialog, TransferMoneyDialog, type AccountRow } from "./cash-ui";
import { ClosingsTable, TransfersTable } from "./cash-tables";

export default async function CashPage(props: PageProps<"/erp/cash">) {
  const session = await requireSession();
  if (!session.canAny("accounts.view", "payments.view")) return <NoAccess />;
  const sp = await props.searchParams;
  const { from, to } = readRange(sp);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.cash;
  const supabase = await createClient();
  const canAccounts = session.can("accounts.view");
  const [{ data: accounts }, { data: pend }, payments, pendingList, { data: closings }, { data: transfers }, parties] = await Promise.all([
    canAccounts ? supabase.from("v_money_balances").select("*").order("kind").order("name_en") : Promise.resolve({ data: [] }),
    supabase.from("payments").select("money_account_id, amount, direction").eq("status", "pending_verification"),
    loadPayments(supabase, locale, { from, to }),
    loadPayments(supabase, locale, { status: "pending_verification" }),
    canAccounts ? supabase.from("cash_closings").select("id, closing_date, expected_balance, counted_amount, difference, notes, closed_by, money_accounts(name_en, name_ar)").order("closing_date", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    canAccounts ? supabase.from("money_transfers").select("id, transfer_no, transfer_date, amount, reference, from:money_accounts!money_transfers_from_account_id_fkey(name_en, name_ar), to:money_accounts!money_transfers_to_account_id_fkey(name_en, name_ar)").order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    session.can("payments.create") ? partyOptions(session, locale) : Promise.resolve(null),
  ]);
  const pendingBy = new Map<string, number>();
  for (const p of pend ?? []) if (p.direction === "in") pendingBy.set(p.money_account_id, (pendingBy.get(p.money_account_id) ?? 0) + Number(p.amount));
  const rows: AccountRow[] = ((accounts ?? []) as AccountRow[]).map((a) => ({ ...a, balance: Number(a.balance), pending: pendingBy.get(a.id) ?? 0 }));
  const active = rows.filter((a) => a.is_active);
  const nm = (r: { name_en: string; name_ar: string } | null) => (r ? (locale === "ar" ? r.name_ar : r.name_en) : "—");
  const purposes = ([
    "customer_receipt", "customer_refund", "supplier_payment", "supplier_refund", "driver_commission", "salary", "salary_advance", "investor_capital_in", "investor_capital_return", "investor_profit",
  ] as (typeof PURPOSES)[number][]).filter((p) => {
    const type = p.startsWith("customer") ? "customer" : p.startsWith("supplier") ? "supplier" : p === "driver_commission" ? "driver" : p.startsWith("salary") ? "employee" : "investor";
    return Boolean(parties?.map[type]);
  });

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <>
            {session.can("accounts.close") && <CashClosingDialog accounts={active} />}
            {session.can("accounts.transfer") && <TransferMoneyDialog accounts={active} />}
            {parties && purposes.length > 0 && (
              <PaymentDialog purposes={purposes} partyMap={parties.map} investmentMap={parties.investmentMap} trigger={<Button><HandCoins />{t.recordPayment}</Button>} />
            )}
          </>
        }
      />
      <p className="mb-5 rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground">{t.noGateway}</p>
      {canAccounts && (
        <div className="mb-8">
          <AccountCards rows={rows} canManage={session.can("accounts.manage")} />
        </div>
      )}
      <UrlTabs
        defaultTab={sp.tab === "verify" ? "verify" : "payments"}
        tabs={[
          {
            value: "payments",
            label: t.payments,
            content: <PaymentsTable rows={payments} canVerify={session.can("payments.verify")} canCancel={session.can("payments.cancel")} toolbar={<DateRangeFilter from={from} to={to} />} />,
          },
          { value: "verify", label: t.verifyQueue, count: pendingList.length, content: <PaymentsTable rows={pendingList} canVerify={session.can("payments.verify")} canCancel={session.can("payments.cancel")} /> },
          ...(canAccounts
            ? [
                {
                  value: "transfers",
                  label: t.transfer,
                  content: <TransfersTable rows={((transfers ?? []) as unknown as Record<string, never>[]).map((r) => ({ id: r.id, no: r.transfer_no, date: r.transfer_date, amount: Number(r.amount), reference: r.reference, from: nm(r.from), to: nm(r.to) }))} />,
                },
                {
                  value: "closings",
                  label: t.closing,
                  content: <ClosingsTable rows={((closings ?? []) as unknown as Record<string, never>[]).map((r) => ({ id: r.id, date: r.closing_date, account: nm(r.money_accounts), expected: Number(r.expected_balance), counted: Number(r.counted_amount), difference: Number(r.difference), notes: r.notes }))} />,
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
