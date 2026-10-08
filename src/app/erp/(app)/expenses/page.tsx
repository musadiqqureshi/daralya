import { RankBars } from "@/components/erp/charts";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { Section } from "@/components/erp/section";
import { StatCard } from "@/components/erp/stat-card";
import { requireSession } from "@/lib/auth";
import { getExpenseCategories, getMoneyAccounts, getPaymentMethods } from "@/lib/erp/lookups";
import { readRange } from "@/lib/erp/range";
import { fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ExpenseDialog, ExpensesTable, type ExpenseRow } from "./expenses-ui";

export default async function ExpensesPage(props: PageProps<"/erp/expenses">) {
  const session = await requireSession();
  if (!session.can("expenses.view")) return <NoAccess />;
  const sp = await props.searchParams;
  const { from, to } = readRange(sp);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.expenses;
  const supabase = await createClient();
  const [{ data }, categories, accounts, methods] = await Promise.all([
    supabase.from("expenses").select("id, expense_no, expense_date, amount, vat_amount, payee, description, status, receipt_path, expense_categories(name_en, name_ar), money_accounts(name_en, name_ar)").gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false }),
    getExpenseCategories(),
    getMoneyAccounts(),
    getPaymentMethods(),
  ]);
  const raw = (data ?? []) as unknown as Record<string, never>[];
  const paths = raw.map((r) => r.receipt_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("documents").createSignedUrls(paths, 1800);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const nm = (r: { name_en: string; name_ar: string } | null) => (r ? (locale === "ar" ? r.name_ar : r.name_en) : "—");
  const rows: ExpenseRow[] = raw.map((r) => ({
    id: r.id,
    expense_no: r.expense_no,
    expense_date: r.expense_date,
    category: nm(r.expense_categories),
    amount: Number(r.amount),
    vat_amount: Number(r.vat_amount),
    account: nm(r.money_accounts),
    payee: r.payee,
    description: r.description,
    status: r.status,
    receipt_url: r.receipt_path ? signed.get(r.receipt_path) ?? null : null,
  }));
  const posted = rows.filter((r) => r.status === "posted");
  const total = posted.reduce((s, r) => s + r.amount, 0);
  const byCat = Object.entries(posted.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.category]: (acc[r.category] ?? 0) + r.amount }), {})).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={session.can("expenses.create") && accounts.length > 0 && <ExpenseDialog categories={categories} accounts={accounts} methods={methods} defaultOpen={sp.new === "1"} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <ExpensesTable rows={rows} canCancel={session.can("finance.adjust")} toolbar={<DateRangeFilter from={from} to={to} />} />
        <div className="space-y-6">
          <StatCard label={dict.common.total} value={fmtMoney(total, locale)} hint={`${posted.length} ${dict.common.rows}`} tone="brand" />
          {byCat.length > 0 && (
            <Section title={t.byCategory}>
              <RankBars items={byCat.map(([label, value]) => ({ label, value }))} />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
