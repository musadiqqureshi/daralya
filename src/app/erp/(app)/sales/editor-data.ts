import "server-only";
import type { Session } from "@/lib/auth";
import { getRates } from "@/lib/erp/fx";
import { getCustomers, getDrivers, getMoneyAccounts, getPaymentMethods, getProducts, getSettings, getStorages } from "@/lib/erp/lookups";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/en";
import { createClient } from "@/lib/supabase/server";

/** Everything the sale editor needs, shared by the Sell screen and the full invoice form. */
export async function saleEditorProps(session: Session, locale: Locale, dict: Dict, defaultCustomer?: string) {
  const t = dict.erp;
  const supabase = await createClient();
  const [customers, products, storages, drivers, accounts, methods, settings, { data: overview }, { data: balances }, fx] = await Promise.all([
    getCustomers(),
    getProducts(),
    getStorages(),
    getDrivers(),
    getMoneyAccounts(),
    getPaymentMethods(),
    getSettings(),
    supabase.rpc("stock_overview"),
    supabase.from("v_party_balances").select("party_id, balance").eq("party_type", "customer").eq("gl_code", "1200"),
    getRates(),
  ]);
  const stock: Record<string, Record<string, number>> = {};
  for (const o of (overview ?? []) as { product_id: string; by_storage: Record<string, number> }[]) stock[o.product_id] = o.by_storage ?? {};
  const bal = new Map((balances ?? []).map((b) => [b.party_id, Number(b.balance)]));
  const walkIn = customers.find((c) => /walk-in/i.test(c.name));
  const ar = locale === "ar";
  return {
    customers: customers.map((c) => ({
      value: c.id,
      label: (ar ? c.name_ar || c.name : c.name) ?? "",
      sub: c.phone ?? c.code,
      keywords: [c.code, c.phone ?? "", c.name, c.name_ar ?? ""],
      driver_id: c.driver_id,
      address: c.address,
      balance: bal.get(c.id) ?? 0,
      credit_limit: c.credit_limit === null ? null : Number(c.credit_limit),
      email: c.email,
    })),
    products: products.map((p) => ({
      value: p.id,
      label: ar ? p.name_ar : p.name_en,
      sub: p.sku,
      keywords: [p.barcode ?? "", p.variety, p.name_en, p.name_ar],
      barcode: p.barcode,
      sku: p.sku,
      unit: p.unit,
      weight_kg: Number(p.weight_kg),
      price: Number(p.selling_price),
    })),
    storages,
    drivers: drivers.map((d) => ({ value: d.id, label: (ar ? d.name_ar || d.name : d.name) ?? "", sub: t.commissionTypes[d.commission_type as keyof typeof t.commissionTypes], commission: d.commission_type })),
    accounts,
    methods,
    stock,
    vat: { enabled: Boolean(settings?.vat_enabled), rate: Number(settings?.vat_rate ?? 15) },
    rates: fx.rates,
    ratesAt: fx.fetchedAt,
    defaultCustomer: defaultCustomer ?? walkIn?.id,
    canCollect: session.canAny("payments.create", "sales.collect") && accounts.length > 0,
    canOverridePrice: session.can("sales.price_override"),
    canDeliver: session.can("deliveries.manage"),
    canAddCustomer: session.can("customers.manage"),
  };
}
