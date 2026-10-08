import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { BatchesTable, type BatchRow } from "./batches-table";

export default async function BatchesPage() {
  const session = await requireSession();
  if (!session.can("inventory.view")) return <NoAccess />;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const [{ data: batches }, { data: levels }] = await Promise.all([
    supabase.from("stock_batches").select("id, batch_no, source, received_date, initial_qty, expiry_date, purchase_id, products(name_en, name_ar, unit), suppliers(name, name_ar)").order("received_date", { ascending: false }).limit(1000),
    supabase.from("v_stock_levels").select("batch_id, qty"),
  ]);
  const remaining = new Map<string, number>();
  for (const l of levels ?? []) remaining.set(l.batch_id, (remaining.get(l.batch_id) ?? 0) + Number(l.qty));
  const rows: BatchRow[] = ((batches ?? []) as unknown as Record<string, never>[]).map((b) => ({
    id: b.id,
    batch_no: b.batch_no,
    source: b.source,
    received_date: b.received_date,
    expiry_date: b.expiry_date,
    product: locale === "ar" ? (b.products as { name_ar: string }).name_ar : (b.products as { name_en: string }).name_en,
    unit: (b.products as { unit: string }).unit,
    supplier: b.suppliers ? (locale === "ar" ? (b.suppliers as { name_ar: string | null; name: string }).name_ar || (b.suppliers as { name: string }).name : (b.suppliers as { name: string }).name) : null,
    initial: Number(b.initial_qty),
    remaining: remaining.get(b.id) ?? 0,
  }));
  return (
    <>
      <PageHeader title={dict.erp.batches.title} description={dict.erp.batches.subtitle} />
      <BatchesTable rows={rows} />
    </>
  );
}
