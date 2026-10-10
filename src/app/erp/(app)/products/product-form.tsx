"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Field, nativeSelect } from "@/components/erp/field";
import { Section } from "@/components/erp/section";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { saveProduct, type ProductInput } from "./actions";

type Spec = ProductInput["specs"][number];

const num = (x: unknown, d: string | number = "") => (x as string | number | undefined) ?? d;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export function ProductForm({ initial, canSeeCost, varieties }: { initial?: Partial<ProductInput> & { id?: string }; canSeeCost: boolean; varieties: string[] }) {
  const { dict } = useI18n();
  const t = dict.erp.products;
  const f = dict.erp.fields;
  const router = useRouter();
  const [v, setV] = useState<Partial<ProductInput>>({
    unit: "kg",
    weight_kg: 1,
    selling_price: 0,
    min_stock: 0,
    is_active: true,
    is_published: false,
    is_featured: false,
    public_availability: "on_request",
    specs: [],
    sort_order: 0,
    ...initial,
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const { run, pending, error } = useServerAction();
  const set = <K extends keyof ProductInput>(k: K, val: ProductInput[K]) => setV((s) => ({ ...s, [k]: val }));
  const text = (k: keyof ProductInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const specs = (v.specs ?? []) as Spec[];
  const setSpec = (i: number, k: keyof Spec, val: string) => set("specs", specs.map((s, j) => (j === i ? { ...s, [k]: val } : s)));

  return (
    <form
      className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => saveProduct({ ...(v as ProductInput), id: initial?.id }), {
          success: t.saved,
          onSuccess: (id) => {
            if (!initial?.id && id) router.push(`/erp/products/${id}`);
          },
        });
      }}
    >
      <div className="space-y-6">
        <Section title={t.basics}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.nameEn} htmlFor="pf-en" required>
              <Input
                id="pf-en"
                value={v.name_en ?? ""}
                onChange={(e) => {
                  const name = e.target.value;
                  setV((s) => ({ ...s, name_en: name, ...(slugTouched ? {} : { slug: slugify(name) }) }));
                }}
                required
              />
            </Field>
            <Field label={t.nameAr} htmlFor="pf-ar" required>
              <Input id="pf-ar" dir="rtl" value={v.name_ar ?? ""} onChange={text("name_ar")} required />
            </Field>
            <Field label={t.nameUr} htmlFor="pf-ur">
              <Input id="pf-ur" dir="rtl" lang="ur" value={v.name_ur ?? ""} onChange={text("name_ur")} />
            </Field>
            <Field label={t.slug} htmlFor="pf-slug" hint={t.slugHint} required>
              <Input
                id="pf-slug"
                dir="ltr"
                value={v.slug ?? ""}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                required
              />
            </Field>
            <Field label={f.variety} htmlFor="pf-variety" required>
              <Input id="pf-variety" list="varieties" value={v.variety ?? ""} onChange={text("variety")} required />
              <datalist id="varieties">
                {varieties.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </Field>
            <Field label={f.grade} htmlFor="pf-grade">
              <Input id="pf-grade" value={v.grade ?? ""} onChange={text("grade")} />
            </Field>
            <Field label={f.barcode} htmlFor="pf-barcode">
              <Input id="pf-barcode" dir="ltr" value={v.barcode ?? ""} onChange={text("barcode")} />
            </Field>
            <Field label={t.sortOrder} htmlFor="pf-sort">
              <Input id="pf-sort" type="number" min="0" value={num(v.sort_order, 0)} onChange={text("sort_order")} />
            </Field>
          </div>
        </Section>

        <Section title={t.pricing}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={f.unit} htmlFor="pf-unit" required>
              <select id="pf-unit" className={nativeSelect} value={v.unit} onChange={(e) => {
                  const unit = e.target.value as ProductInput["unit"];
                  setV((s) => ({ ...s, unit, ...(unit === "kg" ? { weight_kg: 1 } : {}) }));
                }}>
                {(["kg", "carton", "box", "tray", "piece"] as const).map((u) => (
                  <option key={u} value={u}>
                    {dict.erp.units[u]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={f.weightKg} htmlFor="pf-weight" required>
              <Input id="pf-weight" type="number" min="0.001" step="0.001" value={num(v.weight_kg, "")} onChange={text("weight_kg")} disabled={v.unit === "kg"} />
            </Field>
            <Field label={f.minStock} htmlFor="pf-min">
              <Input id="pf-min" type="number" min="0" step="0.001" value={num(v.min_stock, 0)} onChange={text("min_stock")} />
            </Field>
            <Field label={f.sellingPrice} htmlFor="pf-price" required>
              <Input id="pf-price" type="number" min="0" step="0.01" value={num(v.selling_price, 0)} onChange={text("selling_price")} />
            </Field>
            <Field label={f.wholesalePrice} htmlFor="pf-wholesale">
              <Input id="pf-wholesale" type="number" min="0" step="0.01" value={(v.wholesale_price as number | string | null | undefined) ?? ""} onChange={text("wholesale_price")} />
            </Field>
            {canSeeCost && (
              <Field label={f.purchasePrice} htmlFor="pf-cost">
                <Input id="pf-cost" type="number" min="0" step="0.01" value={num(v.purchase_price, 0)} onChange={text("purchase_price")} />
              </Field>
            )}
          </div>
        </Section>

        <Section title={t.website}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.packagingEn} htmlFor="pf-pack-en">
              <Input id="pf-pack-en" value={v.packaging_en ?? ""} onChange={text("packaging_en")} />
            </Field>
            <Field label={t.packagingAr} htmlFor="pf-pack-ar">
              <Input id="pf-pack-ar" dir="rtl" value={v.packaging_ar ?? ""} onChange={text("packaging_ar")} />
            </Field>
            <Field label={t.descriptionEn} htmlFor="pf-desc-en">
              <Textarea id="pf-desc-en" rows={4} value={v.description_en ?? ""} onChange={text("description_en")} />
            </Field>
            <Field label={t.descriptionAr} htmlFor="pf-desc-ar">
              <Textarea id="pf-desc-ar" dir="rtl" rows={4} value={v.description_ar ?? ""} onChange={text("description_ar")} />
            </Field>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[0.82rem] font-medium">{t.specs}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => set("specs", [...specs, { label_en: "", label_ar: "", value_en: "", value_ar: "" }])}>
                <Plus />
                {t.addSpec}
              </Button>
            </div>
            {specs.length > 0 && (
              <ul className="space-y-2">
                {specs.map((s, i) => (
                  <li key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                    <Input aria-label={t.labelEn} placeholder={t.labelEn} value={s.label_en} onChange={(e) => setSpec(i, "label_en", e.target.value)} />
                    <Input aria-label={t.labelAr} placeholder={t.labelAr} dir="rtl" value={s.label_ar} onChange={(e) => setSpec(i, "label_ar", e.target.value)} />
                    <Input aria-label={t.valueEn} placeholder={t.valueEn} value={s.value_en} onChange={(e) => setSpec(i, "value_en", e.target.value)} />
                    <Input aria-label={t.valueAr} placeholder={t.valueAr} dir="rtl" value={s.value_ar} onChange={(e) => setSpec(i, "value_ar", e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => set("specs", specs.filter((_, j) => j !== i))} aria-label={dict.common.remove}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      </div>

      <div className="space-y-6">
        <Section title={dict.common.status}>
          <div className="space-y-4">
            {(
              [
                ["is_active", dict.common.active],
                ["is_published", t.published],
                ["is_featured", t.featured],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm">
                {label}
                <Switch checked={Boolean(v[k])} onCheckedChange={(c) => set(k, c)} />
              </label>
            ))}
            <Field label={t.availabilityLabel} htmlFor="pf-avail">
              <select id="pf-avail" className={nativeSelect} value={v.public_availability} onChange={(e) => set("public_availability", e.target.value as ProductInput["public_availability"])}>
                {(["available", "limited", "seasonal", "on_request"] as const).map((a) => (
                  <option key={a} value={a}>
                    {dict.erp.availability[a]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {dict.common.saveChanges}
        </Button>
      </div>
    </form>
  );
}
