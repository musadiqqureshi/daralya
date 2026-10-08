"use client";
import Link from "next/link";
import { Barcode as BarcodeIcon, Pencil, Plus } from "lucide-react";
import { SetStockDialog } from "./set-stock-dialog";
import { DataTable, type Col } from "@/components/erp/data-table";
import { Money, Num } from "@/components/erp/money";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type StockRow = {
  product_id: string;
  sku: string;
  name: string;
  other: string;
  variety: string;
  unit: string;
  weight_kg: number;
  qty: number;
  kg: number;
  cost_per_kg: number | null;
  sell_per_kg: number;
  selling_price: number;
  min_stock: number;
  storages: string;
  by_storage: Record<string, number>;
};

export function StockTable({ rows, admin }: { rows: StockRow[]; admin?: { canSetStock: boolean; canEditProducts: boolean; storages: { id: string; name: string }[] } }) {
  const { dict } = useI18n();
  const t = dict.erp.pos;
  const showCost = rows.some((r) => r.cost_per_kg !== null);
  const cols: Col<StockRow>[] = [
    {
      id: "name",
      header: dict.erp.fields.product,
      value: (r) => `${r.name} ${r.other} ${r.sku} ${r.variety}`,
      cell: (r) => (
        <div>
          <p className="text-[0.95rem] font-semibold text-palm-900">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.sku} · {r.other}</p>
        </div>
      ),
    },
    {
      id: "qty",
      header: t.inStock,
      value: (r) => r.kg,
      cell: (r) =>
        r.qty > 0 ? (
          <div>
            <p className={cn("text-base font-semibold tabular-nums", r.qty <= r.min_stock && "text-warning")}>
              <Num value={r.kg} digits={1} /> {dict.common.kg}
            </p>
            {r.unit !== "kg" && <p className="text-xs text-muted-foreground"><Num value={r.qty} /> {dict.erp.units[r.unit as "kg"]}</p>}
            {r.storages && <p className="text-xs text-muted-foreground">{r.storages}</p>}
          </div>
        ) : (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{t.outOfStock}</span>
        ),
    },
    ...(showCost
      ? [{ id: "cost", header: t.boughtPerKg, value: (r: StockRow) => r.cost_per_kg ?? 0, cell: (r: StockRow) => (r.cost_per_kg ? <Money value={r.cost_per_kg} className="text-base" /> : <span className="text-muted-foreground">—</span>), align: "end" as const }]
      : []),
    { id: "sell", header: t.sellPerKg, value: (r) => r.sell_per_kg, cell: (r) => <Money value={r.sell_per_kg} className="text-base font-semibold" />, align: "end" },
    ...(showCost
      ? [
          {
            id: "margin",
            header: t.margin,
            value: (r: StockRow) => (r.cost_per_kg ? (r.sell_per_kg - r.cost_per_kg) / r.cost_per_kg : 0),
            cell: (r: StockRow) => {
              if (!r.cost_per_kg || !r.sell_per_kg) return <span className="text-muted-foreground">—</span>;
              const m = ((r.sell_per_kg - r.cost_per_kg) / r.cost_per_kg) * 100;
              return <span className={cn("font-semibold tabular-nums", m < 0 ? "text-destructive" : "text-success")}>{m.toFixed(0)}%</span>;
            },
            align: "end" as const,
            hideBelow: "sm" as const,
          },
        ]
      : []),
    ...(admin && (admin.canSetStock || admin.canEditProducts)
      ? [
          {
            id: "admin",
            header: "",
            align: "end" as const,
            cell: (r: StockRow) => (
              <div className="flex justify-end gap-1">
                {admin.canSetStock && (
                  <SetStockDialog product={{ id: r.product_id, name: r.name }} storages={admin.storages} byStorage={r.by_storage} unit={dict.erp.units[r.unit as "kg"]} cost={r.cost_per_kg !== null ? r.cost_per_kg * r.weight_kg : null} />
                )}
                {admin.canEditProducts && (
                  <Button asChild size="icon-sm" variant="ghost" aria-label={t.editProduct} title={t.editProduct}>
                    <Link href={`/erp/products/${r.product_id}`}><Pencil /></Link>
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];
  return (
    <DataTable
      rows={rows}
      columns={cols}
      pageSize={100}
      toolbar={
        <>
          <Button asChild variant="outline">
            <Link href="/print/barcodes" target="_blank">
              <BarcodeIcon />
              {t.printBarcodes}
            </Link>
          </Button>
          {admin?.canEditProducts && (
            <Button asChild>
              <Link href="/erp/products/new">
                <Plus />
                {dict.erp.products.new}
              </Link>
            </Button>
          )}
        </>
      }
    />
  );
}
