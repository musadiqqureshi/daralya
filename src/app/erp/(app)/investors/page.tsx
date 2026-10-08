import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { requireSession } from "@/lib/auth";
import { fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { InvestorsTable, type InvestorRow } from "./investors-table";
import { NewInvestorButton } from "./investors-ui";

export default async function InvestorsPage() {
  const session = await requireSession();
  if (!session.can("investors.view")) return <NoAccess />;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.investors;
  const supabase = await createClient();
  const [{ data: investors }, { data: summary }] = await Promise.all([
    supabase.from("investors").select("id, investor_no, name, name_ar, phone, is_active").order("investor_no"),
    supabase.from("v_investment_summary").select("investor_id, capital_balance, profit_earned, profit_paid, profit_outstanding"),
  ]);
  const agg = new Map<string, { capital: number; earned: number; owed: number; count: number }>();
  for (const s of summary ?? []) {
    const a = agg.get(s.investor_id) ?? { capital: 0, earned: 0, owed: 0, count: 0 };
    a.capital += Number(s.capital_balance);
    a.earned += Number(s.profit_earned);
    a.owed += Number(s.profit_outstanding);
    a.count += 1;
    agg.set(s.investor_id, a);
  }
  const rows: InvestorRow[] = (investors ?? []).map((i) => ({
    id: i.id,
    investor_no: i.investor_no,
    name: (locale === "ar" ? i.name_ar || i.name : i.name) as string,
    phone: i.phone,
    investments: agg.get(i.id)?.count ?? 0,
    capital: agg.get(i.id)?.capital ?? 0,
    earned: agg.get(i.id)?.earned ?? 0,
    owed: agg.get(i.id)?.owed ?? 0,
  }));
  const tot = rows.reduce((s, r) => ({ capital: s.capital + r.capital, owed: s.owed + r.owed }), { capital: 0, owed: 0 });
  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} actions={session.can("investors.manage") && <NewInvestorButton />} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <StatCard label={t.capitalBalance} value={fmtMoney(tot.capital, locale)} tone="brand" />
        <StatCard label={t.profitOutstanding} value={fmtMoney(tot.owed, locale)} />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t.adviser}</p>
      <InvestorsTable rows={rows} />
    </>
  );
}
