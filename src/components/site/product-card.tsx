import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/en";
import type { PublicProduct } from "@/lib/site/types";
import { publicStorageUrl } from "@/lib/supabase/urls";
import { cn } from "@/lib/utils";

export function availabilityTone(a: PublicProduct["public_availability"]) {
  return {
    available: "bg-palm-50 text-palm-700 ring-palm-700/15",
    limited: "bg-gold-100 text-gold-700 ring-gold-700/20",
    seasonal: "bg-[#f6e9e2] text-terracotta ring-terracotta/20",
    on_request: "bg-white/90 text-palm-900 ring-palm-900/10",
  }[a];
}

export function ProductCard({ product, locale, dict, priority = false }: { product: PublicProduct; locale: Locale; dict: Dict; priority?: boolean }) {
  const img = product.images[0];
  const src = publicStorageUrl("products", img?.src);
  const name = locale === "ar" ? product.name_ar : product.name_en;
  const other = locale === "ar" ? product.name_en : product.name_ar;
  const packaging = locale === "ar" ? product.packaging_ar : product.packaging_en;
  return (
    <article className="group relative flex h-full flex-col">
      <Link
        href={`/portfolio/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-beige ring-1 ring-palm-900/5"
        aria-label={`${name} — ${dict.site.portfolio.viewDetails}`}
      >
        {src ? (
          <Image
            src={src}
            alt={(locale === "ar" ? img?.alt_ar : img?.alt_en) || name}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 90vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="pattern-fronds absolute inset-0 bg-palm-800" aria-hidden />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" aria-hidden />
        <span className={cn("absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 backdrop-blur", availabilityTone(product.public_availability))}>
          {dict.site.portfolio.availability[product.public_availability]}
        </span>
        <span className="absolute end-3 bottom-3 inline-flex size-10 translate-y-1 items-center justify-center rounded-full bg-cream text-palm-900 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
        </span>
      </Link>
      <div className="flex flex-1 flex-col pt-4">
        <p className="text-xs font-semibold tracking-wide text-gold-700 uppercase rtl:normal-case">
          {product.variety}
          {product.grade ? <span className="text-muted-foreground"> · {product.grade}</span> : null}
        </p>
        <h3 className="font-display mt-1 text-[1.65rem] leading-tight font-semibold text-palm-900">
          <Link href={`/portfolio/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
            {name}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground" lang={locale === "ar" ? "en" : "ar"}>
          {other}
        </p>
        {packaging && <p className="mt-2 line-clamp-1 text-sm text-foreground/70">{packaging}</p>}
      </div>
    </article>
  );
}
