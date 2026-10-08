import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { fmtNumber } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { StockTable, type StockRow } from "./stock-table";

export default async function StockPage() {
  const session = await requireSession();
  if (!session.canAny("sales.create", "inventory.view")) return <NoAccess />;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const [{ data }, { data: storages }] = await Promise.all([supabase.rpc("stock_overview"), supabase.from("storages").select("id, name_en, name_ar")]);
  const sname = new Map((storages ?? []).map((s) => [s.id, locale === "ar" ? s.name_ar : s.name_en]));
  const rows: StockRow[] = ((data ?? []) as Record<string, never>[]).map((r) => {
    const w = Number(r.weight_kg) || 1;
    const by = (r.by_storage ?? {}) as Record<string, number>;
    return {
      product_id: r.product_id,
      sku: r.sku,
      name: locale === "ar" ? r.name_ar : r.name_en,
      other: locale === "ar" ? r.name_en : r.name_ar,
      variety: r.variety,
      unit: r.unit,
      weight_kg: w,
      qty: Number(r.qty),
      kg: Number(r.qty) * w,
      cost_per_kg: r.cost_per_kg === null ? null : Number(r.cost_per_kg),
      sell_per_kg: Number(r.selling_price) / w,
      selling_price: Number(r.selling_price),
      min_stock: Number(r.min_stock),
      storages: Object.keys(by).length > 1 ? Object.entries(by).map(([id, q]) => `${sname.get(id)}: ${fmtNumber(q, locale, 1)}`).join(" · ") : "",
    };
  });
  // in-stock first, then by name
  rows.sort((a, b) => Number(b.qty > 0) - Number(a.qty > 0) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title={dict.erp.pos.stockTitle} description={dict.erp.pos.stockSubtitle} />
      <StockTable rows={rows} />
    </>
  );
}
