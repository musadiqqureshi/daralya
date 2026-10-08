import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getMoneyAccounts, getPaymentMethods, getProducts, getStorages, getSuppliers } from "@/lib/erp/lookups";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PurchaseEditor } from "../purchase-editor";

export default async function NewPurchasePage(props: PageProps<"/erp/purchases/new">) {
  const session = await requireSession();
  if (!session.can("purchases.create")) return <NoAccess />;
  const sp = await props.searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const [suppliers, products, storages, accounts, methods, costs] = await Promise.all([
    getSuppliers(),
    getProducts(),
    getStorages(),
    getMoneyAccounts(),
    getPaymentMethods(),
    session.can("products.view_cost") ? supabase.rpc("product_costs") : Promise.resolve({ data: [] }),
  ]);
  const cost = new Map(((costs.data ?? []) as { product_id: string; purchase_price: number }[]).map((c) => [c.product_id, Number(c.purchase_price)]));
  return (
    <>
      <PageHeader back={{ href: "/erp/purchases", label: dict.erp.purchases.title }} title={dict.erp.purchases.new} />
      <PurchaseEditor
        suppliers={suppliers.map((s) => ({ value: s.id, label: locale === "ar" ? s.name_ar || s.name : s.name, sub: s.code }))}
        products={products.map((p) => ({ value: p.id, label: locale === "ar" ? p.name_ar : p.name_en, sub: p.sku, keywords: [p.barcode ?? "", p.variety], unit: p.unit, cost: cost.get(p.id) ?? 0 }))}
        storages={storages}
        accounts={accounts}
        methods={methods}
        defaultSupplier={typeof sp.supplier === "string" ? sp.supplier : undefined}
        canPay={session.can("payments.create")}
      />
    </>
  );
}
