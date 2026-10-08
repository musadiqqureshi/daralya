import { Pencil, Thermometer } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { NewStorageButton, StorageDialog, TemperatureDialog, TransferDialog, type StorageRow } from "@/components/erp/stock-ui";
import { StorageTables } from "./storage-tables";
import { UrlTabs } from "@/components/erp/url-tabs";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { getProducts } from "@/lib/erp/lookups";
import { fmtDateTime, fmtNumber } from "@/lib/i18n/format";
import { tpl } from "@/lib/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function StoragePage() {
  const session = await requireSession();
  if (!session.canAny("inventory.view", "storage.manage")) return <NoAccess />;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.storage;
  const supabase = await createClient();
  const [{ data: storages }, { data: levels }, { data: transfers }, { data: temps }, products] = await Promise.all([
    supabase.from("storages").select("id, code, name_en, name_ar, location, capacity_kg, temp_min, temp_max, is_active").order("name_en"),
    supabase.from("v_stock_levels").select("product_id, storage_id, qty, products(weight_kg)"),
    supabase.from("stock_transfers").select("id, transfer_no, transfer_date, notes, from:storages!stock_transfers_from_storage_id_fkey(name_en, name_ar), to:storages!stock_transfers_to_storage_id_fkey(name_en, name_ar), stock_transfer_items(qty, products(name_en, name_ar))").order("created_at", { ascending: false }).limit(200),
    supabase.from("temperature_logs").select("id, storage_id, recorded_at, temperature_c, humidity_pct, notes").order("recorded_at", { ascending: false }).limit(300),
    getProducts(),
  ]);
  const list = (storages ?? []) as (StorageRow & { code: string })[];
  const active = list.filter((s) => s.is_active);
  const kg = new Map<string, number>();
  const stock: Record<string, Record<string, number>> = {};
  for (const l of (levels ?? []) as unknown as { product_id: string; storage_id: string; qty: number; products: { weight_kg: number } }[]) {
    kg.set(l.storage_id, (kg.get(l.storage_id) ?? 0) + Number(l.qty) * Number(l.products.weight_kg));
    stock[l.product_id] ??= {};
    stock[l.product_id][l.storage_id] = (stock[l.product_id][l.storage_id] ?? 0) + Number(l.qty);
  }
  const lastTemp = new Map<string, { temperature_c: number; recorded_at: string }>();
  for (const tl of temps ?? []) if (!lastTemp.has(tl.storage_id)) lastTemp.set(tl.storage_id, tl);
  const name = (r: { name_en: string; name_ar: string }) => (locale === "ar" ? r.name_ar : r.name_en);
  const prodOpts = products.map((p) => ({ value: p.id, label: locale === "ar" ? p.name_ar : p.name_en, sub: p.sku, unit: p.unit }));

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <>
            {session.can("storage.manage") && <NewStorageButton />}
            {session.can("storage.temperature") && active.length > 0 && <TemperatureDialog storages={active} />}
            {session.can("inventory.transfer") && <TransferDialog storages={active} products={prodOpts} stock={stock} />}
          </>
        }
      />
      <ul className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => {
          const load = kg.get(s.id) ?? 0;
          const pct = s.capacity_kg ? Math.min((load / Number(s.capacity_kg)) * 100, 100) : null;
          const lt = lastTemp.get(s.id);
          const out = lt && ((s.temp_min !== null && Number(lt.temperature_c) < Number(s.temp_min)) || (s.temp_max !== null && Number(lt.temperature_c) > Number(s.temp_max)));
          return (
            <li key={s.id} className={cn("rounded-xl border bg-card p-5", !s.is_active && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
                  <h2 className="font-display text-2xl font-semibold text-palm-900">{name(s)}</h2>
                  {s.location && <p className="text-sm text-muted-foreground">{s.location}</p>}
                </div>
                {session.can("storage.manage") && (
                  <StorageDialog initial={s} trigger={<Button variant="ghost" size="icon-sm" aria-label={dict.common.edit}><Pencil /></Button>} />
                )}
              </div>
              <div className="mt-5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">{t.load}</span>
                  <span className="tabular-nums">
                    <strong>{fmtNumber(load, locale, 0)}</strong> {dict.common.kg}
                    {s.capacity_kg ? ` ${tpl(dict.erp.dashboard.capacity, { cap: fmtNumber(s.capacity_kg, locale, 0) })}` : ""}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct ?? 100}%`, background: pct === null ? "#d9c59a" : pct > 90 ? "#b3412e" : pct > 75 ? "#c8a45d" : "#173d32" }} />
                </div>
                {!s.capacity_kg && <p className="mt-1 text-xs text-muted-foreground">{t.noCapacity}</p>}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Thermometer className="size-4" />
                  {s.temp_min !== null || s.temp_max !== null ? `${t.range}: ${s.temp_min ?? "—"}…${s.temp_max ?? "—"} °C` : "—"}
                </span>
                {lt && (
                  <span className={cn("font-semibold tabular-nums", out ? "text-destructive" : "text-palm-700")} title={fmtDateTime(lt.recorded_at, locale)}>
                    {Number(lt.temperature_c)} °C
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <EmptyState title={t.empty} className="mb-6" />}
      <UrlTabs
        tabs={[
          {
            value: "transfers",
            label: t.transfers,
            content: (
              <StorageTables
                kind="transfers"
                rows={((transfers ?? []) as unknown as Record<string, never>[]).map((r) => ({
                  id: r.id,
                  no: r.transfer_no,
                  date: r.transfer_date,
                  from: name(r.from),
                  to: name(r.to),
                  items: ((r.stock_transfer_items ?? []) as { qty: number; products: { name_en: string; name_ar: string } }[]).map((i) => `${name(i.products)} × ${fmtNumber(i.qty, locale, 3)}`).join(", "),
                  notes: r.notes,
                }))}
              />
            ),
          },
          {
            value: "temperatures",
            label: t.temperatures,
            content: (
              <StorageTables
                kind="temps"
                rows={(temps ?? []).map((tl) => {
                  const s = list.find((x) => x.id === tl.storage_id);
                  const out = s && ((s.temp_min !== null && Number(tl.temperature_c) < Number(s.temp_min)) || (s.temp_max !== null && Number(tl.temperature_c) > Number(s.temp_max)));
                  return { id: tl.id, at: tl.recorded_at, storage: s ? name(s) : "—", temp: Number(tl.temperature_c), humidity: tl.humidity_pct === null ? null : Number(tl.humidity_pct), notes: tl.notes, out: Boolean(out) };
                })}
              />
            ),
          },
        ]}
      />
    </>
  );
}
