import { notFound } from "next/navigation";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { StatementTable, type StatementRow } from "@/components/erp/statement-table";
import { requireSession } from "@/lib/auth";
import { readRange } from "@/lib/erp/range";
import { fmtMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage(props: PageProps<"/erp/cash/accounts/[id]">) {
  const session = await requireSession();
  if (!session.can("accounts.view")) return <NoAccess />;
  const { id } = await props.params;
  const { from, to } = readRange(await props.searchParams);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const { data: a } = await supabase.from("v_money_balances").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const { data } = await supabase.rpc("money_statement", { p_account: id, p_start: from, p_end: to });
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, debit: r.debit === null ? null : Number(r.debit), credit: r.credit === null ? null : Number(r.credit), balance: Number(r.balance) })) as StatementRow[];
  const inflow = rows.reduce((s, r) => s + (r.debit ?? 0), 0);
  const outflow = rows.reduce((s, r) => s + (r.credit ?? 0), 0);
  return (
    <>
      <PageHeader back={{ href: "/erp/cash", label: dict.erp.cash.title }} title={locale === "ar" ? a.name_ar : a.name_en} description={dict.erp.cash.kinds[a.kind as "cash"]} actions={<DateRangeFilter from={from} to={to} />} />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={dict.common.balance} value={fmtMoney(a.balance, locale)} tone="brand" />
        <StatCard label={dict.erp.reports.debit} value={fmtMoney(inflow, locale)} />
        <StatCard label={dict.erp.reports.credit} value={fmtMoney(outflow, locale)} />
      </div>
      <StatementTable rows={rows} />
    </>
  );
}
