import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/config";
import { publicStorageUrl } from "@/lib/supabase/urls";
import type { SiteContent } from "./content";
import type { PublicProduct } from "./types";

/** Public origin of the website (production: https://dadmadinah.com). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dadmadinah.com").replace(/\/+$/, "");

/**
 * Both languages are served from the same paths; `?lang=ar` / `?lang=en`
 * pins the language (the proxy turns it into the locale cookie), which gives
 * search engines a crawlable URL for each version.
 */
export function localizedUrl(path: string, locale: Locale) {
  return locale === "ar" ? `${path}${path.includes("?") ? "&" : "?"}lang=ar` : path;
}

/** canonical + hreflang alternates for a public page */
export function pageAlternates(path: string, locale: Locale): Metadata["alternates"] {
  return {
    canonical: localizedUrl(path, locale),
    languages: { en: path, ar: localizedUrl(path, "ar"), "x-default": path },
  };
}

/** Standard metadata for a public page: title, description, canonical, hreflang and social cards. */
export function pageMeta({
  path,
  locale,
  title,
  description,
  image,
  type = "website",
  absoluteTitle = false,
}: {
  path: string;
  locale: Locale;
  title?: string;
  description?: string;
  /** 1200×630 preview; defaults to the branded logo card. false = the route's own opengraph-image file supplies it */
  image?: string | null | false;
  type?: "website" | "article";
  /** use the title as-is (no "· brand" suffix), e.g. on the homepage */
  absoluteTitle?: boolean;
}): Metadata {
  const url = localizedUrl(path, locale);
  // page-level openGraph replaces the inherited one, so always restate the image and site name
  const images = image === false ? undefined : [{ url: image || "/opengraph-image", width: 1200, height: 630, alt: title ?? "Dar Al-Aaliya Dates" }];
  return {
    ...(title ? { title: absoluteTitle ? { absolute: title } : title } : {}),
    ...(description ? { description } : {}),
    alternates: pageAlternates(path, locale),
    openGraph: {
      type,
      url,
      siteName: locale === "ar" ? "دار العالية للتمور" : "Dar Al-Aaliya Dates",
      locale: locale === "ar" ? "ar_SA" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_SA"],
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(images ? { images } : {}),
    },
    twitter: { card: "summary_large_image", ...(title ? { title } : {}), ...(description ? { description } : {}), ...(images ? { images: [images[0].url] } : {}) },
  };
}

const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`);

/** Business entity for search engines and answer engines (JSON-LD). */
export function organizationLd(content: SiteContent, locale: Locale) {
  const c = content.contact;
  const sameAs = [
    c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/[^\d]/g, "")}` : null,
    ...Object.values(content.social).filter((s) => /^https?:\/\//.test(s)),
  ].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${SITE_URL}/#business`,
    name: "Dar Al-Aaliya Dates",
    alternateName: ["دار العالية للتمور", "DAD Madinah"],
    url: SITE_URL,
    logo: abs("/brand-logo.png"),
    image: abs("/opengraph-image"),
    description: content.footer.blurb[locale],
    telephone: c.phone ? `+966${c.phone.replace(/^0/, "").replace(/[^\d]/g, "")}` : undefined,
    ...(c.email ? { email: c.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: locale === "ar" ? "العوالي" : "Al-Awali",
      addressLocality: locale === "ar" ? "المدينة المنورة" : "Madinah",
      addressRegion: locale === "ar" ? "منطقة المدينة المنورة" : "Al Madinah Province",
      addressCountry: "SA",
    },
    hasMap: c.mapsUrl || undefined,
    areaServed: { "@type": "Country", name: "Saudi Arabia" },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    },
    founder: { "@type": "Person", name: locale === "ar" ? "محمد ريحان" : "Muhammad Rehan", jobTitle: locale === "ar" ? "المالك" : "Owner" },
    knowsLanguage: ["ar", "en"],
    sameAs,
  };
}

export function websiteLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: locale === "ar" ? "دار العالية للتمور" : "Dar Al-Aaliya Dates",
    inLanguage: ["ar", "en"],
    publisher: { "@id": `${SITE_URL}/#business` },
  };
}

export function productLd(p: PublicProduct, locale: Locale) {
  const ar = locale === "ar";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}/portfolio/${p.slug}#product`,
    url: abs(localizedUrl(`/portfolio/${p.slug}`, locale)),
    name: ar ? p.name_ar : p.name_en,
    alternateName: ar ? p.name_en : p.name_ar,
    description: (ar ? p.description_ar : p.description_en) ?? undefined,
    image: p.images.map((i) => publicStorageUrl("products", i.src)).filter(Boolean),
    category: ar ? "تمور" : "Dates",
    brand: { "@type": "Brand", name: "Dar Al-Aaliya Dates" },
    manufacturer: { "@id": `${SITE_URL}/#business` },
    additionalProperty: [
      { "@type": "PropertyValue", name: ar ? "الصنف" : "Variety", value: p.variety },
      ...(p.grade ? [{ "@type": "PropertyValue", name: ar ? "الدرجة" : "Grade", value: p.grade }] : []),
      ...p.specs.map((s) => ({ "@type": "PropertyValue", name: ar ? s.label_ar : s.label_en, value: ar ? s.value_ar : s.value_en })),
    ],
  };
}

export function breadcrumbLd(items: { name: string; path: string }[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(localizedUrl(it.path, locale)) })),
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
