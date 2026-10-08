import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { availabilityTone, ProductCard } from "@/components/site/product-card";
import { ProductGallery } from "@/components/site/product-gallery";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getPublicProduct, getPublicProducts, getSiteContent } from "@/lib/site/data";
import { publicStorageUrl } from "@/lib/supabase/urls";
import { cn } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/portfolio/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const [p, locale] = await Promise.all([getPublicProduct(slug), getLocale()]);
  if (!p) return {};
  const name = locale === "ar" ? p.name_ar : p.name_en;
  const img = publicStorageUrl("products", p.images[0]?.src);
  return {
    title: name,
    description: (locale === "ar" ? p.description_ar : p.description_en) ?? undefined,
    openGraph: img ? { images: [img] } : undefined,
  };
}

export default async function ProductPage(props: PageProps<"/portfolio/[slug]">) {
  const { slug } = await props.params;
  const [locale, product, all, content] = await Promise.all([getLocale(), getPublicProduct(slug), getPublicProducts(), getSiteContent()]);
  if (!product) notFound();
  const dict = await getDictionary(locale);
  const t = dict.site.portfolio;
  const name = locale === "ar" ? product.name_ar : product.name_en;
  const other = locale === "ar" ? product.name_en : product.name_ar;
  const description = locale === "ar" ? product.description_ar : product.description_en;
  const packaging = locale === "ar" ? product.packaging_ar : product.packaging_en;
  const related = [
    ...all.filter((p) => p.id !== product.id && p.variety === product.variety),
    ...all.filter((p) => p.id !== product.id && p.variety !== product.variety && p.is_featured),
  ].slice(0, 4);
  const wa = content.contact.whatsapp.replace(/[^\d]/g, "");
  const waText = encodeURIComponent(locale === "ar" ? `مرحباً، أود الاستفسار عن ${name}` : `Hello, I would like to ask about ${name}`);

  return (
    <>
      <section className="container-site pt-28 pb-20 sm:pt-32">
        <Link href="/portfolio" className="inline-flex items-center gap-2 text-sm font-medium text-palm-800 hover:text-palm-600">
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t.back}
        </Link>
        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <ProductGallery
              name={name}
              images={product.images.map((i) => ({ src: i.src, alt: (locale === "ar" ? i.alt_ar : i.alt_en) ?? name }))}
            />
          </div>
          <div className="lg:col-span-6 lg:pt-6">
            <p className="text-sm font-semibold tracking-wide text-gold-700 uppercase rtl:normal-case">
              {product.variety}
              {product.grade && <span className="text-muted-foreground"> · {product.grade}</span>}
            </p>
            <h1 className="font-display mt-2 text-5xl leading-[1.05] font-semibold text-palm-900 sm:text-6xl">{name}</h1>
            <p className="mt-1 text-lg text-muted-foreground" lang={locale === "ar" ? "en" : "ar"}>
              {other}
            </p>
            <span className={cn("mt-5 inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1", availabilityTone(product.public_availability))}>
              {t.availability[product.public_availability]}
            </span>
            {description && <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/80">{description}</p>}

            <dl className="mt-8 divide-y divide-palm-900/10 border-y border-palm-900/10">
              {packaging && <SpecRow label={t.packaging} value={packaging} />}
              <SpecRow label={t.weight} value={`${Number(product.weight_kg)} ${dict.common.kg} / ${dict.units[product.unit as keyof typeof dict.units] ?? product.unit}`} />
              {product.specs.map((s, i) => (
                <SpecRow key={i} label={locale === "ar" ? s.label_ar : s.label_en} value={locale === "ar" ? s.value_ar : s.value_en} />
              ))}
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/contact?category=product&product=${product.slug}`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-palm-800 px-7 font-semibold text-cream transition-colors hover:bg-palm-700"
              >
                {t.inquire}
              </Link>
              {wa && (
                <a
                  href={`https://wa.me/${wa}?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-palm-800/30 px-7 font-semibold text-palm-900 transition-colors hover:border-palm-800"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  {dict.site.contact.chat}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-palm-900/8 bg-[#f3eddf] py-20">
          <div className="container-site">
            <h2 className="font-display text-4xl font-semibold text-palm-900">{t.related}</h2>
            <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} locale={locale} dict={dict} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,35%)_1fr] gap-4 py-3.5 text-[0.95rem]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-palm-900">{value}</dd>
    </div>
  );
}
