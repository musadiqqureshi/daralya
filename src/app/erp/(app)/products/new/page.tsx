import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const session = await requireSession();
  if (!session.can("products.manage")) return <NoAccess />;
  const dict = await getDictionary();
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("variety");
  const varieties = [...new Set((data ?? []).map((d) => d.variety as string))].sort();
  return (
    <>
      <PageHeader back={{ href: "/erp/products", label: dict.erp.products.title }} title={dict.erp.products.new} />
      <ProductForm canSeeCost={session.can("products.view_cost")} varieties={varieties} />
    </>
  );
}
