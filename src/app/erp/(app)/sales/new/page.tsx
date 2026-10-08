import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getCustomers, getDrivers, getMoneyAccounts, getPaymentMethods, getProducts, getSettings, getStorages } from "@/lib/erp/lookups";
import { getRates } from "@/lib/erp/fx";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { SaleEditor } from "../sale-editor";

export default async function NewSalePage(props: PageProps<"/erp/sales/new">) {
  const session = await requireSession();
  if (!session.can("sales.create")) return <NoAccess />;
  const sp = await props.searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const [customers, products, storages, drivers, accounts, methods, settings, { data: levels }, { data: balances }, fx] = await Promise.all([
    getCustomers(),
    getProducts(),
    getStorages(),
    getDrivers(),
    getMoneyAccounts(),
    getPaymentMethods(),
    getSettings(),
    supabase.from("v_stock_levels").select("product_id, storage_id, qty"),
    supabase.from("v_party_balances").select("party_id, balance").eq("party_type", "customer").eq("gl_code", "1200"),
    getRates(),
  ]);
  const stock: Record<string, Record<string, number>> = {};
  for (const l of levels ?? []) {
    stock[l.product_id] ??= {};
    stock[l.product_id][l.storage_id] = (stock[l.product_id][l.storage_id] ?? 0) + Number(l.qty);
  }
  const bal = new Map((balances ?? []).map((b) => [b.party_id, Number(b.balance)]));
  const walkIn = customers.find((c) => /walk-in/i.test(c.name));
  const ar = locale === "ar";
  return (
    <>
      <PageHeader back={{ href: "/erp/sales", label: t.sales.title }} title={t.sales.new} />
      <SaleEditor
        customers={customers.map((c) => ({
          value: c.id,
          label: ar ? c.name_ar || c.name : c.name,
          sub: c.phone ?? c.code,
          keywords: [c.code, c.phone ?? "", c.name, c.name_ar ?? ""],
          driver_id: c.driver_id,
          address: c.address,
          balance: bal.get(c.id) ?? 0,
          credit_limit: c.credit_limit === null ? null : Number(c.credit_limit),
          email: c.email,
        }))}
        products={products.map((p) => ({
          value: p.id,
          label: ar ? p.name_ar : p.name_en,
          sub: p.sku,
          keywords: [p.barcode ?? "", p.variety, p.name_en, p.name_ar],
          barcode: p.barcode,
          sku: p.sku,
          unit: p.unit,
          weight_kg: Number(p.weight_kg),
          price: Number(p.selling_price),
        }))}
        storages={storages}
        drivers={drivers.map((d) => ({ value: d.id, label: ar ? d.name_ar || d.name : d.name, sub: t.commissionTypes[d.commission_type as keyof typeof t.commissionTypes], commission: d.commission_type }))}
        accounts={accounts}
        methods={methods}
        stock={stock}
        vat={{ enabled: Boolean(settings?.vat_enabled), rate: Number(settings?.vat_rate ?? 15) }}
        rates={fx.rates}
        ratesAt={fx.fetchedAt}
        defaultCustomer={typeof sp.customer === "string" ? sp.customer : walkIn?.id}
        canCollect={session.canAny("payments.create", "sales.collect") && accounts.length > 0}
        canOverridePrice={session.can("sales.price_override")}
        canDeliver={session.can("deliveries.manage") || session.can("sales.create")}
      />
    </>
  );
}
