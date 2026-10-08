import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { excelResponse } from "@/lib/erp/excel";
import { readRange } from "@/lib/erp/range";
import { buildReport, REPORTS, type ReportName } from "@/lib/erp/reports";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const name = sp.name as ReportName;
  if (!REPORTS.includes(name)) return new Response("Unknown report", { status: 400 });
  const { from, to } = readRange(sp);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const report = await buildReport(name, { from, to, group: sp.group }, session, locale, dict);
  if (!report) return new Response("Forbidden", { status: 403 });
  return excelResponse(`${name}-${from}-${to}`, {
    title: `${dict.common.brand} — ${report.title}`,
    subtitle: `${from} → ${to}${report.note ? ` · ${report.note}` : ""}`,
    rtl: locale === "ar",
    columns: report.columns.map((c) => ({ header: c.header, key: c.key, money: c.kind === "money", number: c.kind === "number", width: c.kind === "money" ? 16 : c.key === "name" || c.key === "label" || c.key === "product" ? 32 : 14 })),
    rows: report.rows,
    totals: report.totals,
  });
}
