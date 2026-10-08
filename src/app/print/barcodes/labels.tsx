"use client";
import { useState } from "react";
import { Barcode } from "@/components/erp/barcode";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/client";

type P = { id: string; code: string; name_en: string; name_ar: string; price: number };

/** A4 sheet of barcode labels (3 × 8). Code = product barcode, or the SKU when none is set. */
export function Labels({ products }: { products: P[] }) {
  const { dict } = useI18n();
  const t = dict.erp.pos;
  const [copies, setCopies] = useState(3);
  const [price, setPrice] = useState(false);
  const labels = products.flatMap((p) => Array.from({ length: Math.max(1, Math.min(copies, 100)) }, (_, i) => ({ ...p, key: `${p.id}-${i}` })));
  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-4 rounded-xl bg-card px-4 py-3 text-sm">
        <span className="font-semibold">{t.labels}: {labels.length}</span>
        <label className="flex items-center gap-2">
          {t.copies}
          <Input type="number" min={1} max={100} value={copies} onChange={(e) => setCopies(Number(e.target.value) || 1)} className="h-8 w-20" />
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={price} onCheckedChange={setPrice} />
          {t.showPrice}
        </label>
      </div>
      <style>{"@page { size: A4; margin: 8mm; }"}</style>
      <div className="mx-auto grid w-[210mm] grid-cols-3 gap-[2mm] bg-white p-[6mm] print:w-auto print:p-0">
        {labels.map((l) => (
          <div key={l.key} className="flex h-[34mm] break-inside-avoid flex-col items-center justify-center overflow-hidden rounded-[1.5mm] border border-dashed border-[#c9c1ae] px-[2mm] text-center print:border-[#ddd]">
            <p className="w-full truncate text-[9pt] leading-tight font-bold">{l.name_en}</p>
            <p className="w-full truncate text-[9pt] leading-tight" dir="rtl">{l.name_ar}</p>
            <Barcode value={l.code} height={34} className="mt-[1mm] h-[17mm] max-w-full" />
            {price && <p className="text-[8pt] font-semibold">SAR {l.price.toFixed(2)}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
