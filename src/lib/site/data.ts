import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { defaultContent, mergeContent, type SiteContent } from "./content";

export type { PublicCompany, PublicProduct } from "./types";
import type { PublicCompany, PublicProduct } from "./types";

/** Cache tag for all public website data; saved edits call updateTag(SITE_TAG). */
export const SITE_TAG = "site-data";

/** Published website content merged over safe defaults. */
export const getSiteContent = cache(() => cachedContent());
const cachedContent = unstable_cache(async (): Promise<SiteContent> => {
  const supabase = createPublicClient();
  if (!supabase) return defaultContent;
  const { data, error } = await supabase.from("v_public_content").select("key, content");
  if (error || !data) return defaultContent;
  const patch: Record<string, unknown> = {};
  for (const row of data) patch[row.key] = row.content;
  return mergeContent(defaultContent, patch);
}, ["site-content"], { revalidate: 600, tags: [SITE_TAG] });

export const getPublicProducts = cache(() => cachedProducts());
const cachedProducts = unstable_cache(async (): Promise<PublicProduct[]> => {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("v_public_products")
    .select("*")
    .order("sort_order")
    .order("name_en");
  if (error || !data) return [];
  return data as PublicProduct[];
}, ["public-products"], { revalidate: 600, tags: [SITE_TAG] });

export const getPublicProduct = cache(async (slug: string) => {
  const all = await getPublicProducts();
  return all.find((p) => p.slug === slug) ?? null;
});

export const getPublicCompany = cache(() => cachedCompany());
const cachedCompany = unstable_cache(async (): Promise<PublicCompany | null> => {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase.from("v_public_company").select("*").maybeSingle();
  return (data as PublicCompany) ?? null;
}, ["public-company"], { revalidate: 600, tags: [SITE_TAG] });
