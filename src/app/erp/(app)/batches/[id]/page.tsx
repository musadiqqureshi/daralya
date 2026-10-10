import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { DateText, Money, Num } from "@/components/erp/money";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { KeyValues, Section } from "@/components/erp/section";
import { StatCard } from "@/components/erp/stat-card";
import { requireSession } from "@/lib/auth";
import { fmtNumber } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const href: Record<string, string> = { sale: "/erp/sales/", purchase: "/erp/purchases/" };

export default async function BatchPage(props: PageProps<"/erp/batches/[id]">) {
  const session = await requireSession();
  if (!session.can("inventory.view")) return <NoAccess />;
  const { id } = await props.params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp;
  const supabase = await createClient();
  const { data: b } = await supabase.from("stock_batches").select("id, batch_no, source, received_date, initial_qty, expiry_date, notes, purchase_id, product_id, products(name_en, name_ar, unit), suppliers(id, name, name_ar), purchases(purchase_no)").eq("id", id).maybeSingle();
  if (!b) notFound();
  const { data: trace } = await supabase.rpc("batch_trace", { p_batch: id });
  type T = { movement_id: number; movement_date: string; created_at: string; movement_type: string; storage_en: string; storage_ar: string; qty: number; unit_cost: number | null; source_type: string; source_id: string | null; document_no: string | null; party: string | null };
  const rows = (trace ?? []) as T[];
  const remaining = rows.reduce((s, r) => s + Number(r.qty), 0);
  const sold = -rows.filter((r) => r.movement_type === "sale").reduce((s, r) => s + Number(r.qty), 0) - rows.filter((r) => r.movement_type === "sale_return" || (r.movement_type === "cancellation" && r.source_type === "sale")).reduce((s, r) => -Number(r.qty) + s, 0);
  const p = b.products as unknown as { name_en: string; name_ar: string; unit: string };
  const sup = b.suppliers as unknown as { id: string; name: string; name_ar: string | null } | null;
  const unit = t.units[p.unit as keyof typeof t.units];

  return (
    <>
      <PageHeader back={{ href: "/erp/batches", label: t.batches.title }} title={b.batch_no} description={<Link href={`/erp/products/${b.product_id}`} className="hover:underline">{locale === "ar" ? p.name_ar : p.name_en}</Link>} />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t.batches.initial} value={`${fmtNumber(b.initial_qty, locale, 3)} ${unit}`} />
        <StatCard label={t.movement.sale} value={`${fmtNumber(Math.max(sold, 0), locale, 3)} ${unit}`} />
        <StatCard label={t.batches.remaining} value={`${fmtNumber(remaining, locale, 3)} ${unit}`} tone="brand" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_20rem]">
        <Section title={t.batches.timeline}>
          <ol className="relative ms-3 border-s-2 border-border">
            {rows.map((r) => {
              const inbound = Number(r.qty) > 0;
              return (
                <li key={r.movement_id} className="mb-5 ms-6">
                  <span className={cn("absolute -start-[0.8rem] flex size-6 items-center justify-center rounded-full ring-4 ring-card", inbound ? "bg-palm-50 text-palm-700" : "bg-gold-100 text-gold-700")}>
                    {inbound ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      {t.movement[r.movement_type as keyof typeof t.movement]}
                      {r.document_no && (
                        <>
                          {" · "}
                          {r.source_id && href[r.source_type] ? <Link href={href[r.source_type] + r.source_id} className="font-mono text-xs hover:underline">{r.document_no}</Link> : <span className="font-mono text-xs">{r.document_no}</span>}
                        </>
                      )}
                    </p>
                    <span className={cn("font-semibold tabular-nums", inbound ? "text-success" : "text-foreground")}>{inbound ? "+" : ""}<Num value={r.qty} /> {unit}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <DateText value={r.created_at} withTime /> · {locale === "ar" ? r.storage_ar : r.storage_en}
                    {r.party ? ` · ${r.party}` : ""}
                    {r.unit_cost !== null && session.can("products.view_cost") ? <> · <Money value={r.unit_cost} /></> : null}
                  </p>
                </li>
              );
            })}
          </ol>
        </Section>
        <Section title={dict.common.details}>
          <KeyValues
            cols={1}
            items={[
              { label: t.fields.supplier, value: sup ? <Link href={`/erp/suppliers/${sup.id}`} className="hover:underline">{locale === "ar" ? sup.name_ar || sup.name : sup.name}</Link> : null },
              { label: t.nav.purchases, value: b.purchase_id ? <Link href={`/erp/purchases/${b.purchase_id}`} className="font-mono text-xs hover:underline">{(b.purchases as unknown as { purchase_no: string } | null)?.purchase_no}</Link> : null },
              { label: t.fields.received, value: <DateText value={b.received_date} /> },
              { label: t.fields.expiry, value: b.expiry_date ? <DateText value={b.expiry_date} /> : null },
              { label: dict.common.notes, value: b.notes },
            ]}
          />
        </Section>
      </div>
    </>
  );
}
