import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { excelResponse } from "@/lib/erp/excel";
import { statementData } from "@/lib/erp/statement-data";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const sp = req.nextUrl.searchParams;
  const [type, id, from, to] = ["type", "id", "from", "to"].map((k) => sp.get(k) ?? "");
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const data = await statementData(type, id, from, to, locale);
  if (!data) return new Response("Not found", { status: 404 });
  return excelResponse(`statement-${data.party.code}-${from}-${to}`, {
    title: `${dict.erp.print.statement} — ${data.party.display} (${data.party.code})`,
    subtitle: `${from} → ${to}`,
    rtl: locale === "ar",
    columns: [
      { header: dict.common.date, key: "entry_date", width: 14 },
      { header: dict.erp.fields.documentNo, key: "entry_no", width: 18 },
      { header: dict.common.description, key: "memo", width: 44 },
      { header: dict.erp.reports.debit, key: "debit", money: true, width: 14 },
      { header: dict.erp.reports.credit, key: "credit", money: true, width: 14 },
      { header: dict.common.balance, key: "balance", money: true, width: 16 },
    ],
    rows: data.rows.map((r) => ({ ...r, memo: r.is_opening ? dict.erp.print.openingBalance : r.memo })),
  });
}
