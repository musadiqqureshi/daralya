import {
  AlertTriangle,
  Banknote,
  Boxes,
  Building2,
  HandCoins,
  Landmark,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserCheck,
  UserX,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { CapacityBars, RankBars, SeriesChart } from "@/components/erp/charts";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { EmptyState } from "@/components/erp/empty-state";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { Section } from "@/components/erp/section";
import { StatCard } from "@/components/erp/stat-card";
import { requireSession } from "@/lib/auth";
import { CURRENCIES, CURRENCY_INFO, fmtCurrency } from "@/lib/erp/currency";
import { getRates } from "@/lib/erp/fx";
import { readRange } from "@/lib/erp/range";
import { tpl } from "@/lib/i18n/dictionaries/en";
import { fmtMoney, fmtNumber } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type Summary = {
  financials: boolean;
  sales_count?: number;
  total_sales?: number;
  today_revenue?: number;
  today_invoices?: number;
  total_purchases?: number;
  sales_series?: { date: string; sales: number; purchases: number | null; profit: number | null }[];
  revenue_by_product?: { name_en: string; name_ar: string; amount: number; kg: number }[];
  stock_kg?: number;
  low_stock?: { product_id: string; name_en: string; name_ar: string; qty: number; min_stock: number; unit: string }[];
  low_stock_count?: number;
  inventory_by_storage?: { name_en: string; name_ar: string; capacity_kg: number | null; kg: number }[];
  pending_deliveries?: number;
  staff_total?: number;
  staff_present?: number;
  staff_late?: number;
  staff_absent?: number;
  staff_on_leave?: number;
  attendance_series?: { date: string; present: number; late: number; absent: number }[];
  pending_verifications?: number;
  revenue?: number;
  gross_profit?: number;
  expenses?: number;
  net_profit?: number;
  cash_balance?: number;
  bank_balance?: number;
  receivables?: number;
  payables?: number;
  inventory_value?: number;
  outstanding_commissions?: number;
  investor_liabilities?: number;
  expenses_by_month?: { month: string; name_en: string; name_ar: string; amount: number }[];
};

export default async function DashboardPage(props: PageProps<"/erp">) {
  const session = await requireSession();
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.dashboard;
  if (!session.can("dashboard.view")) return <NoAccess />;

  const { from, to } = readRange(await props.searchParams);
  const supabase = await createClient();
  const [{ data, error }, { data: fxSales }, fx] = await Promise.all([
    supabase.rpc("dashboard_summary", { p_start: from, p_end: to }),
    session.can("sales.view") ? supabase.from("sales").select("currency, fx_rate, total, returned_total").eq("status", "posted").gte("sale_date", from).lte("sale_date", to) : Promise.resolve({ data: [] }),
    getRates(),
  ]);
  const byCurrency = new Map<string, { invoices: number; fc: number; sar: number }>();
  for (const x of (fxSales ?? []) as { currency: string; fx_rate: number; total: number; returned_total: number }[]) {
    const sar = Number(x.total) - Number(x.returned_total);
    const c = byCurrency.get(x.currency) ?? { invoices: 0, fc: 0, sar: 0 };
    c.invoices += 1;
    c.sar += sar;
    c.fc += sar / Number(x.fx_rate);
    byCurrency.set(x.currency, c);
  }
  const s = (data ?? { financials: false }) as Summary;
  const m = (v: number | undefined) => fmtMoney(v ?? 0, locale);
  const n = (v: number | undefined, d = 0) => fmtNumber(v ?? 0, locale, d);
  const pick = (r: { name_en: string; name_ar: string }) => (locale === "ar" ? r.name_ar : r.name_en);

  // pivot monthly expenses into chart rows
  const cats = Array.from(new Set((s.expenses_by_month ?? []).map((e) => pick(e))));
  const expenseRows = Object.values(
    (s.expenses_by_month ?? []).reduce<Record<string, Record<string, number | string>>>((acc, e) => {
      acc[e.month] ??= { date: e.month };
      acc[e.month][pick(e)] = Number(e.amount);
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={tpl(t.greeting, { name: session.profile.full_name.split(" ")[0] })}
        description={t.subtitle}
        actions={<DateRangeFilter from={from} to={to} />}
      />
      {error && <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.message}</p>}

      {/* Headline numbers */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {s.total_sales !== undefined && (
          <StatCard tone="brand" icon={Receipt} label={t.totalSales} value={m(s.total_sales)} hint={tpl(t.invoices, { n: s.sales_count ?? 0 })} href="/erp/sales" />
        )}
        {s.today_revenue !== undefined && <StatCard icon={TrendingUp} label={t.todayRevenue} value={m(s.today_revenue)} hint={tpl(t.invoices, { n: s.today_invoices ?? 0 })} />}
        {s.total_purchases !== undefined && <StatCard icon={ShoppingCart} label={t.totalPurchases} value={m(s.total_purchases)} href="/erp/purchases" />}
        {s.financials && <StatCard icon={Banknote} label={t.grossProfit} value={m(s.gross_profit)} tone={(s.gross_profit ?? 0) < 0 ? "negative" : "default"} />}
        {s.financials && <StatCard icon={TrendingUp} label={t.netProfit} value={m(s.net_profit)} tone={(s.net_profit ?? 0) < 0 ? "negative" : "positive"} href="/erp/reports?tab=pl" />}
        {s.financials && <StatCard icon={Receipt} label={t.expenses} value={m(s.expenses)} href="/erp/expenses" />}
        {s.financials && <StatCard icon={Wallet} label={t.cash} value={m(s.cash_balance)} href="/erp/cash" />}
        {s.financials && <StatCard icon={Landmark} label={t.bank} value={m(s.bank_balance)} href="/erp/cash" />}
        {s.financials && <StatCard icon={Building2} label={t.receivables} value={m(s.receivables)} href="/erp/reports?tab=receivables" />}
        {s.financials && <StatCard icon={Building2} label={t.payables} value={m(s.payables)} href="/erp/reports?tab=payables" />}
        {s.stock_kg !== undefined && (
          <StatCard icon={Boxes} label={t.inventory} value={`${n(s.stock_kg)} ${dict.common.kg}`} hint={s.financials ? `${t.inventoryValue}: ${m(s.inventory_value)}` : undefined} href="/erp/inventory" />
        )}
        {s.low_stock_count !== undefined && (
          <StatCard icon={AlertTriangle} label={t.lowStock} value={n(s.low_stock_count)} tone={s.low_stock_count ? "warning" : "default"} href="/erp/inventory?low=1" />
        )}
        {s.pending_deliveries !== undefined && <StatCard icon={Truck} label={t.pendingDeliveries} value={n(s.pending_deliveries)} href="/erp/deliveries" />}
        {s.financials && <StatCard icon={HandCoins} label={t.commissions} value={m(s.outstanding_commissions)} href="/erp/drivers" />}
        {s.staff_present !== undefined && (
          <StatCard icon={UserCheck} label={t.staffPresent} value={`${n(s.staff_present)} / ${n(s.staff_total)}`} hint={s.staff_late ? `${dict.erp.status.late}: ${n(s.staff_late)}` : undefined} href="/erp/attendance" />
        )}
        {s.staff_absent !== undefined && <StatCard icon={UserX} label={t.staffAbsent} value={n(s.staff_absent)} tone={s.staff_absent ? "warning" : "default"} href="/erp/attendance" />}
        {s.financials && <StatCard icon={HandCoins} label={t.investorLiabilities} value={m(s.investor_liabilities)} href="/erp/investors" />}
      </div>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-3">
        {s.sales_series && (
          <Section title={s.financials || s.sales_series.some((r) => r.purchases !== null) ? t.purchasesVsSales : t.salesPerformance} className="xl:col-span-2">
            {s.sales_series.some((r) => r.sales || r.purchases) ? (
              <SeriesChart
                data={s.sales_series}
                series={[
                  { key: "sales", label: t.sales },
                  ...(s.sales_series.some((r) => r.purchases !== null) ? [{ key: "purchases", label: t.purchases }] : []),
                ]}
              />
            ) : (
              <EmptyState title={t.noData} className="border-none py-16" />
            )}
          </Section>
        )}
        {s.revenue_by_product && (
          <Section title={t.revenueByProduct}>
            {s.revenue_by_product.length ? (
              <RankBars items={s.revenue_by_product.map((r) => ({ label: pick(r), value: Number(r.amount), sub: `${n(r.kg, 1)} ${dict.common.kg}` }))} />
            ) : (
              <EmptyState title={t.noData} className="border-none py-16" />
            )}
          </Section>
        )}
        {s.financials && s.sales_series && (
          <Section title={t.profitTrend} className="xl:col-span-2">
            <SeriesChart kind="bar" data={s.sales_series} series={[{ key: "profit", label: t.profit, color: "#c8a45d" }]} />
          </Section>
        )}
        {s.inventory_by_storage && (
          <Section title={t.inventoryDistribution}>
            {s.inventory_by_storage.length ? (
              <CapacityBars
                items={s.inventory_by_storage.map((r) => ({ label: pick(r), kg: Number(r.kg), capacity: r.capacity_kg ? Number(r.capacity_kg) : null }))}
                unitLabel={dict.common.kg}
                capLabel={(cap) => tpl(t.capacity, { cap })}
              />
            ) : (
              <EmptyState title={t.noData} className="border-none py-12" />
            )}
          </Section>
        )}
        {s.financials && (
          <Section title={t.monthlyExpenses} className="xl:col-span-2">
            {expenseRows.length ? (
              <SeriesChart kind="bar" stacked xKey="date" data={expenseRows} series={cats.map((c) => ({ key: c, label: c }))} />
            ) : (
              <EmptyState title={t.noData} className="border-none py-16" />
            )}
          </Section>
        )}
        {s.attendance_series && (
          <Section title={t.attendanceSummary} className={s.financials ? "" : "xl:col-span-2"}>
            <SeriesChart
              kind="bar"
              stacked
              money={false}
              height={220}
              data={s.attendance_series}
              series={[
                { key: "present", label: dict.erp.status.present, color: "#173d32" },
                { key: "late", label: dict.erp.status.late, color: "#c8a45d" },
                { key: "absent", label: dict.erp.status.absent, color: "#b5654a" },
              ]}
            />
          </Section>
        )}
        {byCurrency.size > 0 && (
          <Section title={t.salesByCurrency}>
            <ul className="divide-y text-sm">
              {[...byCurrency.entries()].sort((a, b) => b[1].sar - a[1].sar).map(([cur, v]) => (
                <li key={cur} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="font-semibold">{cur}</span>
                    <span className="ms-2 text-xs text-muted-foreground">{tpl(t.invoices, { n: v.invoices })}</span>
                    {cur !== "SAR" && <span className="block text-xs text-muted-foreground" dir="ltr">{fmtCurrency(v.fc, cur, locale)}</span>}
                  </span>
                  <span className="font-semibold tabular-nums" dir="ltr">{m(v.sar)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title={t.liveRates} description={fx.fetchedAt ? `${dict.common.updated}: ${new Date(fx.fetchedAt).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" })}` : undefined}>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {CURRENCIES.filter((c) => c !== "SAR").map((c) => (
              <li key={c} className="rounded-lg border px-3 py-2">
                <p className="text-xs text-muted-foreground">1 {c} · {CURRENCY_INFO[c][locale]}</p>
                <p className="font-semibold tabular-nums" dir="ltr">{fx.rates[c] ? `${fx.rates[c]!.toFixed(4)} SAR` : "—"}</p>
              </li>
            ))}
          </ul>
        </Section>
        {s.low_stock && s.low_stock.length > 0 && (
          <Section title={t.lowStock} actions={<Link href="/erp/inventory?low=1" className="text-xs font-semibold text-palm-700 hover:underline">{dict.common.seeAll}</Link>}>
            <ul className="divide-y">
              {s.low_stock.map((p) => (
                <li key={p.product_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/erp/products/${p.product_id}`} className="font-medium hover:underline">
                    {pick(p)}
                  </Link>
                  <span className="tabular-nums">
                    <span className={Number(p.qty) <= 0 ? "font-semibold text-destructive" : "font-semibold text-warning"}>{n(p.qty, 2)}</span>
                    <span className="text-muted-foreground"> / {n(p.min_stock, 2)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}
