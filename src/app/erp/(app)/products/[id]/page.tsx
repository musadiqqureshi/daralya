import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Barcode } from "@/components/erp/barcode";
import { DateText, Num } from "@/components/erp/money";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { Section } from "@/components/erp/section";
import { StatusBadge } from "@/components/erp/status-badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";
import { ProductImages } from "../product-images";
import { SetStockDialog } from "../../stock/set-stock-dialog";

export default async function ProductPage(props: PageProps<"/erp/products/[id]">) {
  const session = await requireSession();
  if (!session.can("products.view")) return <NoAccess />;
  const { id } = await props.params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("products")
    .select("id, sku, barcode, slug, name_en, name_ar, name_ur, variety, grade, unit, weight_kg, selling_price, wholesale_price, min_stock, is_active, is_published, is_featured, public_availability, packaging_en, packaging_ar, description_en, description_ar, specs, sort_order")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const canCost = session.can("products.view_cost");
  const [{ data: images }, { data: avail }, { data: storages }, costs, { data: all }] = await Promise.all([
    supabase.from("product_images").select("id, src").eq("product_id", id).order("sort_order").order("created_at"),
    session.canAny("inventory.view", "sales.create", "purchases.create") ? supabase.rpc("stock_available", { p_product: id }) : Promise.resolve({ data: [] }),
    supabase.from("storages").select("id, name_en, name_ar, is_active"),
    canCost ? supabase.rpc("product_costs") : Promise.resolve({ data: [] }),
    supabase.from("products").select("variety"),
  ]);
  const purchase_price = ((costs.data ?? []) as { product_id: string; purchase_price: number }[]).find((c) => c.product_id === id)?.purchase_price;
  const storageName = new Map((storages ?? []).map((s) => [s.id, locale === "ar" ? s.name_ar : s.name_en]));
  const batches = (avail ?? []) as { storage_id: string; batch_id: string; batch_no: string; received_date: string; expiry_date: string | null; qty: number }[];
  const byStorage = new Map<string, number>();
  for (const b of batches) byStorage.set(b.storage_id, (byStorage.get(b.storage_id) ?? 0) + Number(b.qty));
  const total = [...byStorage.values()].reduce((a, b) => a + b, 0);
  const name = locale === "ar" ? p.name_ar : p.name_en;

  return (
    <>
      <PageHeader
        back={{ href: "/erp/products", label: t.products.title }}
        title={name}
        description={`${p.sku} · ${p.variety}${p.grade ? ` · ${p.grade}` : ""}`}
        meta={
          <>
            <StatusBadge status={p.is_active ? "active" : "inactive"} />
            {p.is_published && <StatusBadge status="posted" label={t.products.published} />}
          </>
        }
        actions={
          p.is_published && (
            <Button asChild variant="outline">
              <Link href={`/portfolio/${p.slug}`} target="_blank">
                <ExternalLink />
                {t.website.preview}
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Section
          title={t.products.stockByStorage}
          className="lg:col-span-2"
          actions={
            session.can("inventory.adjust_approve") && (
              <SetStockDialog
                product={{ id, name }}
                storages={(storages ?? []).filter((s) => s.is_active).map((s) => ({ id: s.id, name: (locale === "ar" ? s.name_ar : s.name_en) as string }))}
                byStorage={Object.fromEntries(byStorage)}
                unit={t.units[p.unit as keyof typeof t.units]}
                cost={purchase_price ? Number(purchase_price) : null}
              />
            )
          }
        >
          {byStorage.size ? (
            <div className="space-y-4">
              <ul className="grid gap-3 sm:grid-cols-3">
                {[...byStorage.entries()].map(([sid, q]) => (
                  <li key={sid} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{storageName.get(sid)}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums"><Num value={q} /> <span className="text-sm font-normal text-muted-foreground">{t.units[p.unit as keyof typeof t.units]}</span></p>
                  </li>
                ))}
              </ul>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{t.products.batches}</p>
                <ul className="divide-y rounded-lg border text-sm">
                  {batches.map((b) => (
                    <li key={b.batch_id + b.storage_id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Link href={`/erp/batches/${b.batch_id}`} className="font-mono text-xs font-semibold hover:underline">{b.batch_no}</Link>
                      <span className="text-xs text-muted-foreground">{storageName.get(b.storage_id)} · <DateText value={b.received_date} /></span>
                      <span className="font-semibold tabular-nums"><Num value={b.qty} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.inventory.empty}</p>
          )}
          <p className="mt-4 text-sm">
            {dict.common.total}: <strong className="tabular-nums"><Num value={total} /></strong> · {t.fields.minStock}: <Num value={p.min_stock} />
          </p>
        </Section>
        <Section title={t.fields.barcode}>
          {p.barcode || p.sku ? <Barcode value={p.barcode || p.sku} className="w-full" /> : null}
          <p className="mt-2 text-xs text-muted-foreground">{p.barcode ? t.fields.barcode : t.fields.sku}</p>
        </Section>
      </div>
      {session.can("products.manage") ? (
        <div className="space-y-6">
          <ProductImages productId={id} images={images ?? []} name={{ en: p.name_en, ar: p.name_ar }} />
          <ProductForm
            initial={{ ...p, purchase_price, weight_kg: Number(p.weight_kg), selling_price: Number(p.selling_price), wholesale_price: p.wholesale_price === null ? null : Number(p.wholesale_price), min_stock: Number(p.min_stock) }}
            canSeeCost={canCost}
            varieties={[...new Set((all ?? []).map((x) => x.variety as string))].sort()}
          />
        </div>
      ) : null}
    </>
  );
}
