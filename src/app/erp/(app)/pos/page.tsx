import { NoAccess } from "@/components/erp/no-access";
import { requireSession } from "@/lib/auth";
import { getRates } from "@/lib/erp/fx";
import { getCustomers, getMoneyAccounts, getPaymentMethods, getSettings, getStorages } from "@/lib/erp/lookups";
import { monthStart, todayRiyadh } from "@/lib/i18n/format";
import { getLocale } from "@/lib/i18n/server";
import { publicStorageUrl } from "@/lib/supabase/urls";
import { createClient } from "@/lib/supabase/server";
import { PosScreen, type PosProduct } from "./pos-screen";

type OverviewRow = {
  product_id: string; sku: string; barcode: string | null; name_en: string; name_ar: string; variety: string; grade: string | null;
  unit: string; weight_kg: number; selling_price: number; wholesale_price: number | null; by_storage: Record<string, number> | null; image: string | null;
};

/** The salesman's counter: tap or scan products, check out, slip prints itself. */
export default async function PosPage() {
  const session = await requireSession();
  if (!session.can("sales.create")) return <NoAccess />;
  const locale = await getLocale();
  const ar = locale === "ar";
  const supabase = await createClient();
  const today = todayRiyadh();
  // "my" figures: RLS limits a salesman to his own invoices
  const mine = supabase.from("sales").select("total, returned_total, sale_date").eq("status", "posted").gte("sale_date", monthStart(today));
  const [{ data: overview }, customers, storages, accounts, methods, settings, fx, { data: month }] = await Promise.all([
    supabase.rpc("stock_overview"),
    getCustomers(),
    getStorages(),
    getMoneyAccounts(),
    getPaymentMethods(),
    getSettings(),
    getRates(),
    session.can("sales.view_all") ? mine.eq("created_by", session.userId) : mine,
  ]);
  const rows = (month ?? []) as { total: number; returned_total: number; sale_date: string }[];
  const net = (r: (typeof rows)[number]) => Number(r.total) - Number(r.returned_total);
  const todays = rows.filter((r) => r.sale_date === today);

  const products: PosProduct[] = ((overview ?? []) as OverviewRow[]).map((p) => ({
    id: p.product_id,
    sku: p.sku,
    barcode: p.barcode,
    name: ar ? p.name_ar : p.name_en,
    other: ar ? p.name_en : p.name_ar,
    variety: p.variety,
    grade: p.grade,
    unit: p.unit,
    weight_kg: Number(p.weight_kg) || 1,
    retail: Number(p.selling_price),
    wholesale: p.wholesale_price === null ? null : Number(p.wholesale_price),
    stock: p.by_storage ?? {},
    image: publicStorageUrl("products", p.image),
  }));
  const walkIn = customers.find((c) => /walk-in/i.test(c.name));

  return (
    <PosScreen
      products={products}
      customers={customers.map((c) => ({
        value: c.id,
        label: (ar ? c.name_ar || c.name : c.name) ?? "",
        sub: c.phone ?? c.code,
        keywords: [c.code, c.phone ?? "", c.name, c.name_ar ?? ""],
        email: c.email,
      }))}
      defaultCustomer={walkIn?.id ?? null}
      storages={storages}
      accounts={accounts}
      methods={methods}
      vat={{ enabled: Boolean(settings?.vat_enabled), rate: Number(settings?.vat_rate ?? 15) }}
      rates={fx.rates}
      totals={{ today: todays.reduce((s, r) => s + net(r), 0), todayCount: todays.length, month: rows.reduce((s, r) => s + net(r), 0), monthCount: rows.length }}
      canCollect={session.canAny("payments.create", "sales.collect") && accounts.length > 0}
      canOverridePrice={session.can("sales.price_override")}
      canAddCustomer={session.can("customers.manage")}
    />
  );
}
