"use client";
import Image from "next/image";
import Link from "next/link";
import { Barcode as BarcodeIcon, Eye, EyeOff, Plus, Star } from "lucide-react";
import { DataTable, type Col } from "@/components/erp/data-table";
import { Money, Num } from "@/components/erp/money";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { publicStorageUrl } from "@/lib/supabase/urls";
import { cn } from "@/lib/utils";
import { setProductFlags } from "./actions";

export type ProductRow = {
  id: string;
  sku: string;
  name_en: string;
  name_ar: string;
  variety: string;
  grade: string | null;
  unit: string;
  selling_price: number;
  cost: number | null;
  stock: number;
  min_stock: number;
  is_active: boolean;
  is_published: boolean;
  is_featured: boolean;
  image: string | null;
};

export function ProductsTable({ rows, canManage, showCost, lowOnly }: { rows: ProductRow[]; canManage: boolean; showCost: boolean; lowOnly: boolean }) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const { run, pending } = useServerAction();
  const list = lowOnly ? rows.filter((r) => r.is_active && r.stock <= r.min_stock) : rows;
  const cols: Col<ProductRow>[] = [
    {
      id: "name",
      header: t.fields.product,
      value: (r) => `${r.name_en} ${r.name_ar} ${r.sku} ${r.variety}`,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-beige">
            {r.image && <Image src={publicStorageUrl("products", r.image) ?? ""} alt="" fill sizes="40px" className="object-cover" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-palm-900">{locale === "ar" ? r.name_ar : r.name_en}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {r.sku} · {r.variety}
              {r.grade ? ` · ${r.grade}` : ""}
            </span>
          </span>
        </div>
      ),
    },
    { id: "unit", header: t.fields.unit, value: (r) => r.unit, cell: (r) => t.units[r.unit as keyof typeof t.units], hideBelow: "lg" },
    { id: "price", header: t.fields.sellingPrice, value: (r) => r.selling_price, cell: (r) => <Money value={r.selling_price} />, align: "end" },
    ...(showCost ? [{ id: "cost", header: t.fields.purchasePrice, value: (r: ProductRow) => r.cost ?? 0, cell: (r: ProductRow) => <Money value={r.cost} className="text-muted-foreground" />, align: "end" as const, hideBelow: "md" as const }] : []),
    {
      id: "stock",
      header: t.fields.stock,
      value: (r) => r.stock,
      cell: (r) => (
        <span className={cn("font-semibold tabular-nums", r.is_active && r.stock <= r.min_stock && (r.stock <= 0 ? "text-destructive" : "text-warning"))}>
          <Num value={r.stock} />
        </span>
      ),
      align: "end",
    },
    {
      id: "web",
      header: t.products.website,
      value: (r) => (r.is_published ? 1 : 0),
      cell: (r) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!canManage || pending}
            onClick={() => run(() => setProductFlags(r.id, { is_published: !r.is_published }))}
            aria-label={t.products.published}
            title={t.products.published}
          >
            {r.is_published ? <Eye className="text-palm-700" /> : <EyeOff className="text-muted-foreground" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!canManage || pending}
            onClick={() => run(() => setProductFlags(r.id, { is_featured: !r.is_featured }))}
            aria-label={t.products.featured}
            title={t.products.featured}
          >
            <Star className={r.is_featured ? "fill-gold-500 text-gold-500" : "text-muted-foreground"} />
          </Button>
        </div>
      ),
      align: "center",
      hideBelow: "sm",
    },
    { id: "status", header: dict.common.status, value: (r) => (r.is_active ? 1 : 0), cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} />, align: "center", hideBelow: "md" },
  ];
  return (
    <DataTable
      rows={list}
      columns={cols}
      rowHref={(r) => `/erp/products/${r.id}`}
      emptyTitle={t.products.empty}
      toolbar={
        <>
          <Button asChild variant="outline">
            <Link href="/print/barcodes" target="_blank">
              <BarcodeIcon />
              {t.pos.printBarcodes}
            </Link>
          </Button>
          {canManage && (
            <Button asChild>
              <Link href="/erp/products/new">
                <Plus />
                {t.products.new}
              </Link>
            </Button>
          )}
        </>
      }
    />
  );
}
