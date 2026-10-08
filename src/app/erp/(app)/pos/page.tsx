import Link from "next/link";
import { CheckCircle2, FileText, Printer, Receipt } from "lucide-react";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { tpl } from "@/lib/i18n/dictionaries/en";
import { fmtMoney, monthStart, todayRiyadh } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { saleEditorProps } from "../sales/editor-data";
import { SaleEditor } from "../sales/sale-editor";

/** The salesman's home: scanner first, then customer, then save. */
export default async function PosPage(props: PageProps<"/erp/pos">) {
  const session = await requireSession();
  if (!session.can("sales.create")) return <NoAccess />;
  const sp = await props.searchParams;
  const last = typeof sp.last === "string" ? sp.last : null;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.pos;
  const supabase = await createClient();
  const today = todayRiyadh();
  // "my" figures: RLS limits a salesman to his own invoices
  const mine = supabase.from("sales").select("total, returned_total, sale_date").eq("status", "posted").gte("sale_date", monthStart(today));
  const [editor, { data: month }, lastSale] = await Promise.all([
    saleEditorProps(session, locale, dict),
    session.can("sales.view_all") ? mine.eq("created_by", session.userId) : mine,
    last ? supabase.from("sales").select("id, invoice_no, total, currency").eq("id", last).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const rows = (month ?? []) as { total: number; returned_total: number; sale_date: string }[];
  const sum = (xs: typeof rows) => xs.reduce((s, r) => s + Number(r.total) - Number(r.returned_total), 0);
  const todays = rows.filter((r) => r.sale_date === today);
  const ls = lastSale.data;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <div className="flex gap-2 text-sm">
            <div className="rounded-xl border bg-card px-4 py-2">
              <p className="text-xs text-muted-foreground">{t.today}</p>
              <p className="font-semibold tabular-nums" dir="ltr">{fmtMoney(sum(todays), locale)} <span className="text-xs font-normal text-muted-foreground">· {todays.length}</span></p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-2">
              <p className="text-xs text-muted-foreground">{t.month}</p>
              <p className="font-semibold tabular-nums" dir="ltr">{fmtMoney(sum(rows), locale)} <span className="text-xs font-normal text-muted-foreground">· {rows.length}</span></p>
            </div>
          </div>
        }
      />
      {ls && (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-palm-700/25 bg-palm-50 p-4">
          <CheckCircle2 className="size-6 text-success" />
          <p className="me-auto font-semibold text-palm-900">
            {tpl(t.lastSaved, { no: ls.invoice_no })} · <span dir="ltr">{fmtMoney(ls.total, locale)}</span>
          </p>
          <Button asChild size="lg"><Link href={`/print/invoice/${ls.id}?format=receipt`} target="_blank"><Receipt />{dict.common.printReceipt}</Link></Button>
          <Button asChild variant="outline" size="lg"><Link href={`/print/invoice/${ls.id}`} target="_blank"><Printer />{dict.common.printA4}</Link></Button>
          <Button asChild variant="ghost" size="lg"><Link href={`/erp/sales/${ls.id}`}><FileText />{t.openInvoice}</Link></Button>
        </div>
      )}
      {/* key resets the form after each saved invoice */}
      <SaleEditor key={last ?? "new"} {...editor} simple />
    </>
  );
}
