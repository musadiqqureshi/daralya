import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintToolbar } from "../print-toolbar";
import { Labels } from "./labels";

export default async function BarcodeSheet() {
  const session = await getSession();
  if (!session) redirect("/erp/login");
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id, sku, barcode, name_en, name_ar, selling_price").eq("is_active", true).order("sort_order").order("name_en");
  const products = (data ?? []).map((p) => ({ id: p.id, code: p.barcode || p.sku, name_en: p.name_en, name_ar: p.name_ar, price: Number(p.selling_price) }));
  return (
    <>
      <PrintToolbar />
      <Labels products={products} />
    </>
  );
}
