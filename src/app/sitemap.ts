import type { MetadataRoute } from "next";
import { getPublicProducts } from "@/lib/site/data";
import { localizedUrl, SITE_URL } from "@/lib/site/seo";
import { publicStorageUrl } from "@/lib/supabase/urls";

export const revalidate = 3600;

/** Every public page in English and Arabic, linked as hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getPublicProducts();
  const now = new Date();
  const entry = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" | "yearly", images?: string[]) => {
    const languages = { en: `${SITE_URL}${path}`, ar: `${SITE_URL}${localizedUrl(path, "ar")}` };
    return (["en", "ar"] as const).map((l) => ({
      url: languages[l],
      lastModified: now,
      changeFrequency,
      priority: l === "en" ? priority : Math.round(priority * 90) / 100,
      alternates: { languages: { ...languages, "x-default": languages.en } },
      ...(images?.length ? { images } : {}),
    }));
  };
  return [
    ...entry("/", 1, "weekly"),
    ...entry("/portfolio", 0.9, "weekly"),
    ...products.flatMap((p) => entry(`/portfolio/${p.slug}`, 0.8, "weekly", p.images.map((i) => publicStorageUrl("products", i.src)).filter((s): s is string => Boolean(s)).slice(0, 3))),
    ...entry("/about", 0.7, "monthly"),
    ...entry("/quality", 0.6, "monthly"),
    ...entry("/contact", 0.7, "monthly"),
    ...entry("/privacy", 0.2, "yearly"),
    ...entry("/terms", 0.2, "yearly"),
  ];
}
