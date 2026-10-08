"use client";
import { useI18n } from "@/lib/i18n/client";
import type { PublicProduct } from "@/lib/site/types";
import { ProductCard } from "./product-card";

export function ProductCardClient({ product, priority }: { product: PublicProduct; priority?: boolean }) {
  const { dict, locale } = useI18n();
  return <ProductCard product={product} locale={locale} dict={dict} priority={priority} />;
}
