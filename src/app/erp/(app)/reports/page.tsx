import Link from "next/link";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { readRange } from "@/lib/erp/range";
import { buildReport, REPORT_PERMS, REPORTS, type ReportName } from "@/lib/erp/reports";
import { fmtDate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { GroupPicker, ReportView } from "./report-view";

const DATED: ReportName[] = ["sales", "purchases", "pl", "commissions", "attendance", "payroll", "expenses", "cashbank"];

export default async function ReportsPage(props: PageProps<"/erp/reports">) {
  const session = await requireSession();
  if (!session.canAny("reports.view", "reports.financial")) return <NoAccess />;
  const sp = await props.searchParams;
  const { from, to } = readRange(sp);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.reports;
  const available = REPORTS.filter((r) => REPORT_PERMS[r].some((p) => session.can(p)));
  if (!available.length) return <NoAccess />;
  const current = (available.includes(sp.tab as ReportName) ? sp.tab : available[0]) as ReportName;
  const group = typeof sp.group === "string" ? sp.group : current === "purchases" ? "supplier" : "day";
  const report = await buildReport(current, { from, to, group }, session, locale, dict);
  const qs = new URLSearchParams({ name: current, from, to, group }).toString();
  const groups = current === "sales" ? (["day", "product", "customer", "driver"] as const) : current === "purchases" ? (["day", "product", "supplier"] as const) : null;

  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} />
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label={t.title} className="print:hidden">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {available.map((r) => (
              <li key={r} className="shrink-0">
                <Link
                  href={`/erp/reports?${new URLSearchParams({ tab: r, from, to }).toString()}`}
                  aria-current={r === current ? "page" : undefined}
                  className={cn("block rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors", r === current ? "bg-palm-800 text-cream" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  {t[r]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            {DATED.includes(current) ? <DateRangeFilter from={from} to={to} /> : <span />}
            {groups && <GroupPicker value={group} options={groups.map((g) => ({ value: g, label: t.groups[g] }))} />}
          </div>
          <p className="hidden text-sm print:block">{dict.common.brand} · {DATED.includes(current) ? `${fmtDate(from, locale)} – ${fmtDate(to, locale)}` : fmtDate(new Date(), locale)}</p>
          {report ? <ReportView report={report} exportHref={`/api/export/report?${qs}`} /> : <NoAccess />}
        </div>
      </div>
    </>
  );
}
