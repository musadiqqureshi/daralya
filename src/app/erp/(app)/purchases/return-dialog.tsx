"use client";
import { useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Field } from "@/components/erp/field";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useI18n } from "@/lib/i18n/client";
import { fmtNumber, todayRiyadh } from "@/lib/i18n/format";

export type ReturnLine = { id: string; label: string; available: number };

/** Shared by purchase and sales returns. */
export function ReturnDialog({
  title,
  lines,
  onSubmit,
  extra,
}: {
  title: string;
  lines: ReturnLine[];
  onSubmit: (v: { date: string; reason: string; lines: { id: string; qty: number }[] }) => Promise<ActionResult<unknown>>;
  extra?: React.ReactNode;
}) {
  const { dict, locale } = useI18n();
  const t = dict.erp;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayRiyadh());
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const { run, pending, error } = useServerAction();
  const any = Object.values(qty).some((q) => Number(q) > 0);
  const over = lines.some((l) => Number(qty[l.id] || 0) > l.available);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!lines.some((l) => l.available > 0)}>
          <Undo2 />
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ul className="divide-y rounded-lg border">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.label}</span>
                <span className="text-xs text-muted-foreground">{t.purchases.available}: {fmtNumber(l.available, locale, 3)}</span>
              </span>
              <Input
                type="number"
                min="0"
                max={l.available}
                step="0.001"
                value={qty[l.id] ?? ""}
                onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                className="h-8 w-24 tabular-nums"
                disabled={l.available <= 0}
                aria-label={`${t.purchases.returnQty} ${l.label}`}
              />
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={dict.common.date} htmlFor="ret-date">
            <Input id="ret-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {extra}
          <Field label={dict.common.reason} htmlFor="ret-reason" required className="sm:col-span-2">
            <Textarea id="ret-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.forms.reasonPlaceholder} />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
          <Button
            disabled={!any || over || reason.trim().length < 3 || pending}
            onClick={() =>
              run(() => onSubmit({ date, reason, lines: Object.entries(qty).map(([id, q]) => ({ id, qty: Number(q) || 0 })) }), {
                success: dict.common.saved,
                onSuccess: () => {
                  setOpen(false);
                  setQty({});
                  setReason("");
                },
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {t.purchases.recordReturn}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
