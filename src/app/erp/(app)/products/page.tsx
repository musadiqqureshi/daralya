import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ProductsTable, type ProductRow } from "./products-table";

export default async function ProductsPage(props: PageProps<"/erp/products">) {
  const session = await requireSession();
  if (!session.can("products.view")) return <NoAccess />;
  const sp = await props.searchParams;
  const dict = await getDictionary();
  const supabase = await createClient();
  const showCost = session.can("products.view_cost");
  const [{ data: products }, { data: stock }, costs, { data: images }] = await Promise.all([
    supabase.from("products").select("id, sku, name_en, name_ar, variety, grade, unit, selling_price, min_stock, is_active, is_published, is_featured").order("sort_order").order("name_en"),
    supabase.from("v_product_stock").select("product_id, qty"),
    showCost ? supabase.rpc("product_costs") : Promise.resolve({ data: [] }),
    supabase.from("product_images").select("product_id, src, sort_order").order("sort_order"),
  ]);
  const qty = new Map((stock ?? []).map((s) => [s.product_id as string, Number(s.qty)]));
  const cost = new Map(((costs.data ?? []) as { product_id: string; purchase_price: number }[]).map((c) => [c.product_id, Number(c.purchase_price)]));
  const img = new Map<string, string>();
  for (const i of images ?? []) if (!img.has(i.product_id)) img.set(i.product_id, i.src);
  const rows: ProductRow[] = (products ?? []).map((p) => ({
    ...p,
    selling_price: Number(p.selling_price),
    min_stock: Number(p.min_stock),
    stock: qty.get(p.id) ?? 0,
    cost: cost.get(p.id) ?? null,
    image: img.get(p.id) ?? null,
  }));
  return (
    <>
      <PageHeader title={dict.erp.products.title} description={dict.erp.products.subtitle} />
      <ProductsTable rows={rows} canManage={session.can("products.manage")} showCost={showCost} lowOnly={sp.low === "1"} />
    </>
  );
}
