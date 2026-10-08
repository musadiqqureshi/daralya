import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { AdjustmentDialog, AdjustmentsTable, MovementsTable, OpeningStockForm, StockLevelsTable, type AdjRow, type LevelRow, type MovementRow } from "@/components/erp/stock-ui";
import { UrlTabs } from "@/components/erp/url-tabs";
import { requireSession } from "@/lib/auth";
import { getProducts, getStaffNames, getStorages } from "@/lib/erp/lookups";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage(props: PageProps<"/erp/inventory">) {
  const session = await requireSession();
  if (!session.can("inventory.view")) return <NoAccess />;
  const sp = await props.searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.inventory;
  const supabase = await createClient();
  const [{ data: levels }, { data: movements }, { data: adjustments }, storages, products, names] = await Promise.all([
    supabase.rpc("report_inventory", { p_storage: null }),
    supabase
      .from("stock_movements")
      .select("id, movement_date, created_at, movement_type, qty, source_type, source_id, batch_id, products(name_en, name_ar), storages(name_en, name_ar), stock_batches(batch_no)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(500),
    supabase
      .from("stock_adjustments")
      .select("id, adj_no, adj_date, adj_type, reason, status, total_cost, requested_by, review_note, storages(name_en, name_ar), stock_adjustment_items(qty, products(name_en, name_ar))")
      .order("requested_at", { ascending: false })
      .limit(200),
    getStorages(),
    getProducts(),
    getStaffNames(),
  ]);
  const totals = new Map<string, number>();
  for (const l of (levels ?? []) as { product_id: string; qty: number }[]) totals.set(l.product_id, (totals.get(l.product_id) ?? 0) + Number(l.qty));
  let levelRows: LevelRow[] = ((levels ?? []) as Record<string, unknown>[]).map((l) => ({
    product_id: l.product_id as string,
    sku: l.sku as string,
    name_en: l.name_en as string,
    name_ar: l.name_ar as string,
    variety: l.variety as string,
    unit: l.unit as string,
    storage_en: l.storage_en as string,
    storage_ar: l.storage_ar as string,
    qty: Number(l.qty),
    kg: Number(l.kg),
    value: l.value === null ? null : Number(l.value),
    min_stock: Number(l.min_stock),
    total_qty: totals.get(l.product_id as string) ?? 0,
  }));
  if (sp.low === "1") levelRows = levelRows.filter((r) => r.total_qty <= r.min_stock);
  const moveRows: MovementRow[] = ((movements ?? []) as unknown as Record<string, never>[]).map((m) => ({
    id: m.id,
    movement_date: m.movement_date,
    created_at: m.created_at,
    type: m.movement_type,
    product: m.products,
    storage: m.storages,
    batch_no: (m.stock_batches as { batch_no: string } | null)?.batch_no ?? "",
    batch_id: m.batch_id,
    qty: Number(m.qty),
    source_type: m.source_type,
    source_id: m.source_id,
  }));
  const adjRows: AdjRow[] = ((adjustments ?? []) as unknown as Record<string, never>[]).map((a) => ({
    id: a.id,
    adj_no: a.adj_no,
    adj_date: a.adj_date,
    adj_type: a.adj_type,
    reason: a.reason,
    status: a.status,
    total_cost: a.total_cost,
    review_note: a.review_note,
    storage: a.storages,
    requested_by: names[a.requested_by] ?? "—",
    items: ((a.stock_adjustment_items ?? []) as { qty: number; products: { name_en: string; name_ar: string } }[]).map((i) => ({ product: i.products, qty: Number(i.qty) })),
  }));
  const prodOpts = products.map((p) => ({ value: p.id, label: locale === "ar" ? p.name_ar : p.name_en, sub: p.sku, keywords: [p.barcode ?? ""], unit: p.unit }));
  const pending = adjRows.filter((a) => a.status === "pending").length;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={session.can("inventory.adjust_request") && <AdjustmentDialog storages={storages} products={prodOpts} canApprove={session.can("inventory.adjust_approve")} />}
      />
      <UrlTabs
        tabs={[
          { value: "levels", label: t.levels, content: <StockLevelsTable rows={levelRows} showValue={session.can("products.view_cost")} /> },
          { value: "movements", label: t.movements, content: <MovementsTable rows={moveRows} /> },
          { value: "adjustments", label: t.adjustments, count: pending, content: <AdjustmentsTable rows={adjRows} canApprove={session.can("inventory.adjust_approve")} showCost={session.can("products.view_cost")} /> },
          ...(session.can("settings.manage") ? [{ value: "opening", label: t.opening, content: <OpeningStockForm storages={storages} products={prodOpts} /> }] : []),
        ]}
      />
    </>
  );
}
