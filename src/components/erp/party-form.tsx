"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { saveParty, type PartyInput } from "@/app/erp/(app)/_actions/parties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { EntitySelect, type Option } from "./entity-select";
import { Field } from "./field";
import { useServerAction } from "./use-server-action";

export type PartyRow = Partial<PartyInput> & { id?: string };

export function PartyForm({ kind, trigger, initial, drivers }: { kind: "customer" | "supplier"; trigger: React.ReactNode; initial?: PartyRow; drivers?: Option[] }) {
  const { dict, locale } = useI18n();
  const t = kind === "customer" ? dict.erp.customers : dict.erp.suppliers;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<PartyRow>(initial ?? {});
  const { run, pending, error } = useServerAction();
  const set = (k: keyof PartyRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const editing = Boolean(initial?.id);

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(initial ?? {}); }}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side={locale === "ar" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? t.edit : t.new}</SheetTitle>
          <SheetDescription>{t.subtitle}</SheetDescription>
        </SheetHeader>
        <form
          id={`${kind}-form`}
          className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => saveParty(kind, v as PartyInput), { success: t.created, onSuccess: () => setOpen(false) });
          }}
        >
          <Field label={dict.common.name} htmlFor="p-name" required>
            <Input id="p-name" value={v.name ?? ""} onChange={set("name")} required minLength={2} />
          </Field>
          <Field label={dict.common.nameAr} htmlFor="p-name-ar">
            <Input id="p-name-ar" dir="rtl" value={v.name_ar ?? ""} onChange={set("name_ar")} />
          </Field>
          <Field label={dict.common.phone} htmlFor="p-phone">
            <Input id="p-phone" dir="ltr" type="tel" value={v.phone ?? ""} onChange={set("phone")} />
          </Field>
          <Field label={dict.common.whatsapp} htmlFor="p-wa">
            <Input id="p-wa" dir="ltr" type="tel" value={v.whatsapp ?? ""} onChange={set("whatsapp")} />
          </Field>
          <Field label={dict.common.email} htmlFor="p-email">
            <Input id="p-email" dir="ltr" type="email" value={v.email ?? ""} onChange={set("email")} />
          </Field>
          <Field label={dict.common.city} htmlFor="p-city">
            <Input id="p-city" value={v.city ?? ""} onChange={set("city")} />
          </Field>
          <Field label={dict.common.address} htmlFor="p-address" className="sm:col-span-2">
            <Input id="p-address" value={v.address ?? ""} onChange={set("address")} />
          </Field>
          <Field label={dict.erp.fields.vatNumber} htmlFor="p-vat">
            <Input id="p-vat" dir="ltr" value={v.vat_number ?? ""} onChange={set("vat_number")} />
          </Field>
          {kind === "customer" && (
            <Field label={dict.erp.fields.creditLimit} htmlFor="p-credit">
              <Input id="p-credit" type="number" min="0" step="0.01" value={(v.credit_limit as string | number | null) ?? ""} onChange={set("credit_limit")} />
            </Field>
          )}
          {kind === "customer" && drivers && (
            <Field label={dict.erp.customers.referredBy} className="sm:col-span-2">
              <EntitySelect options={drivers} value={(v.driver_id as string) ?? null} onChange={(d) => setV((s) => ({ ...s, driver_id: d }))} clearable />
            </Field>
          )}
          {!editing && (
            <Field label={dict.erp.fields.openingBalance} htmlFor="p-open" hint={kind === "customer" ? dict.erp.customers.balanceHint : dict.erp.suppliers.balanceHint}>
              <Input id="p-open" type="number" step="0.01" value={(v.opening_balance as string | number) ?? ""} onChange={set("opening_balance")} />
            </Field>
          )}
          <Field label={dict.common.notes} htmlFor="p-notes" className="sm:col-span-2">
            <Textarea id="p-notes" rows={3} value={v.notes ?? ""} onChange={set("notes")} />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{error}</p>}
        </form>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {dict.common.cancel}
          </Button>
          <Button type="submit" form={`${kind}-form`} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
