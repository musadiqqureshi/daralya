"use client";
import { useState } from "react";
import { Loader2, PencilLine } from "lucide-react";
import { setStock } from "@/app/erp/(app)/_actions/stock";
import { Field, nativeSelect } from "@/components/erp/field";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { fmtNumber } from "@/lib/i18n/format";

export function SetStockDialog({
  product,
  storages,
  byStorage,
  unit,
  cost,
}: {
  product: { id: string; name: string };
  storages: { id: string; name: string }[];
  byStorage: Record<string, number>;
  unit: string;
  cost: number | null;
}) {
  const { dict, locale } = useI18n();
  const t = dict.erp.pos;
  const [open, setOpen] = useState(false);
  const [storage, setStorage] = useState(storages[0]?.id ?? "");
  const [qty, setQty] = useState(String(byStorage[storages[0]?.id ?? ""] ?? 0));
  const [unitCost, setUnitCost] = useState(cost ? String(cost) : "");
  const [reason, setReason] = useState("");
  const { run, pending, error } = useServerAction();
  const current = byStorage[storage] ?? 0;
  const diff = (Number(qty) || 0) - current;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PencilLine />
          {t.setStock}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.setStock} · {product.name}</DialogTitle>
          <DialogDescription>{t.setStockHint}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={dict.erp.fields.storage} htmlFor="ss-st">
            <select
              id="ss-st"
              className={nativeSelect}
              value={storage}
              onChange={(e) => {
                setStorage(e.target.value);
                setQty(String(byStorage[e.target.value] ?? 0));
              }}
            >
              {storages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {t.currentQty}: {fmtNumber(byStorage[s.id] ?? 0, locale, 3)} {unit}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`${t.newQty} (${unit})`} htmlFor="ss-q" required>
            <Input id="ss-q" type="number" min="0" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} className="h-11 text-lg tabular-nums" autoFocus />
          </Field>
          {diff !== 0 && (
            <p className={diff > 0 ? "rounded-lg bg-palm-50 px-3 py-2 text-sm font-semibold text-palm-800" : "rounded-lg bg-warning/10 px-3 py-2 text-sm font-semibold text-warning"}>
              {diff > 0 ? "+" : ""}
              {fmtNumber(diff, locale, 3)} {unit}
            </p>
          )}
          {diff > 0 && (
            <Field label={t.costForNew} htmlFor="ss-c">
              <Input id="ss-c" type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </Field>
          )}
          <Field label={dict.common.reason} htmlFor="ss-r">
            <Input id="ss-r" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dict.common.optional} />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending || qty === "" || Number(qty) < 0 || diff === 0}
            onClick={() => run(() => setStock({ product_id: product.id, storage_id: storage, qty, unit_cost: unitCost, reason }), { success: t.stockUpdated, onSuccess: () => setOpen(false) })}
          >
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
