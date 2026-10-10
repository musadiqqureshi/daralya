"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/dictionaries/en";
import type { PublicProduct } from "@/lib/site/types";
import { cn } from "@/lib/utils";
import { ProductCardClient } from "./product-card-client";

export function PortfolioBrowser({ products }: { products: PublicProduct[] }) {
  const { dict, locale } = useI18n();
  const t = dict.site.portfolio;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const variety = params.get("variety") ?? "";
  const grade = params.get("grade") ?? "";

  const varieties = useMemo(() => Array.from(new Set(products.map((p) => p.variety))).sort(), [products]);
  const grades = useMemo(() => Array.from(new Set(products.map((p) => p.grade).filter(Boolean) as string[])).sort(), [products]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const needle = q.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      (!variety || p.variety === variety) &&
      (!grade || p.grade === grade) &&
      (!needle || [p.name_en, p.name_ar, p.variety, p.grade ?? ""].some((s) => s.toLowerCase().includes(needle))),
  );
  const hasFilters = Boolean(variety || grade || needle);

  return (
    <div>
      <div className="sticky top-[4.5rem] z-30 -mx-4 border-b border-palm-900/8 bg-cream/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <label className="relative block flex-1 lg:max-w-sm">
            <span className="sr-only">{t.searchPlaceholder}</span>
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => setParam("q", q.trim())}
              placeholder={t.searchPlaceholder}
              className="h-11 w-full rounded-full border border-palm-900/15 bg-white ps-10 pe-4 text-[0.95rem] outline-none placeholder:text-muted-foreground focus:border-gold-500 focus:ring-3 focus:ring-gold-500/20"
            />
          </label>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <FilterChips label={t.variety} all={t.allVarieties} options={varieties} value={variety} onChange={(v) => setParam("variety", v)} />
            {grades.length > 0 && (
              <select
                aria-label={t.grade}
                value={grade}
                onChange={(e) => setParam("grade", e.target.value)}
                className="h-10 rounded-full border border-palm-900/15 bg-white px-4 text-sm text-palm-900 outline-none focus:border-gold-500"
              >
                <option value="">{t.allGrades}</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between text-sm text-muted-foreground" aria-live="polite">
        <span>{tpl(t.count, { n: filtered.length })}</span>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              router.replace(pathname, { scroll: false });
            }}
            className="inline-flex items-center gap-1 font-medium text-palm-800 hover:text-palm-600"
          >
            <X className="size-3.5" aria-hidden />
            {t.clear}
          </button>
        )}
      </div>

      {filtered.length ? (
        <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p, i) => (
            <li key={p.id}>
              <ProductCardClient product={p} priority={i < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 rounded-[1.5rem] border border-dashed border-palm-900/20 px-6 py-16 text-center">
          <p className="font-display text-3xl text-palm-900">{products.length ? t.emptyTitle : t.noProducts}</p>
          {products.length > 0 && <p className="mt-2 text-muted-foreground">{t.emptyBody}</p>}
        </div>
      )}
      <span className="sr-only" lang={locale} />
    </div>
  );
}

function FilterChips({
  label,
  all,
  options,
  value,
  onChange,
}: {
  label: string;
  all: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {["", ...options].map((o) => (
        <button
          key={o || "all"}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
            value === o ? "border-palm-800 bg-palm-800 text-cream" : "border-palm-900/15 bg-white text-palm-900 hover:border-palm-800/40",
          )}
        >
          {o || all}
        </button>
      ))}
    </div>
  );
}
