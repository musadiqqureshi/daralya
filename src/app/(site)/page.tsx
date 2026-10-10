import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/site/hero";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getPublicProducts, getSiteContent } from "@/lib/site/data";
import { publicStorageUrl } from "@/lib/supabase/urls";

export default async function HomePage() {
  const [locale, content, products] = await Promise.all([getLocale(), getSiteContent(), getPublicProducts()]);
  const dict = await getDictionary(locale);
  // every published product, featured varieties first
  const featured = [...products].sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order);
  const varieties = Array.from(new Set(products.map((p) => p.variety)));

  return (
    <>
      <Hero content={content.hero} locale={locale} dict={dict} />

      {/* Introduction */}
      <section id="intro" className="container-site scroll-mt-20 py-24 sm:py-32">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-6">
            <SectionHeading eyebrow={dict.site.home.introEyebrow} title={content.home.introTitle[locale]} />
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/75">{content.home.introBody[locale]}</p>
            {varieties.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-2" aria-label={dict.site.portfolio.variety}>
                {varieties.slice(0, 10).map((v) => (
                  <li key={v} className="rounded-full border border-palm-900/12 bg-white/60 px-3.5 py-1.5 text-sm text-palm-900">
                    {v}
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
          <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-[1.5rem] border border-palm-900/10 bg-palm-900/10 sm:grid-cols-3 lg:col-span-6 lg:grid-cols-1">
            {content.home.highlights.map((h, i) => (
              <Reveal as="li" key={i} delay={i * 0.08} className="flex gap-5 bg-cream p-6 sm:flex-col lg:flex-row lg:items-start lg:p-7">
                <span className="font-display text-4xl leading-none text-gold-500 tabular-nums">0{i + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold text-palm-900">{h.title[locale]}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted-foreground">{h.body[locale]}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Our dates */}
      <section id="our-dates" className="scroll-mt-20 border-y border-palm-900/8 bg-[#f3eddf] py-24 sm:py-28">
        <div className="container-site">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow={dict.site.home.featuredEyebrow} title={dict.site.home.featuredTitle} />
            <Link href="/portfolio" className="group inline-flex items-center gap-2 font-semibold text-palm-800 hover:text-palm-600">
              {dict.site.home.featuredLink}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
          {featured.length > 0 ? (
            <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((p, i) => (
                <Reveal as="li" key={p.id} delay={(i % 4) * 0.06}>
                  <ProductCard product={p} locale={locale} dict={dict} />
                </Reveal>
              ))}
            </ul>
          ) : (
            <p className="mt-10 max-w-xl rounded-2xl border border-dashed border-palm-900/20 p-6 text-muted-foreground">{dict.site.portfolio.noProducts}</p>
          )}
        </div>
      </section>

      {/* Process */}
      <section className="relative overflow-hidden bg-palm-900 py-24 text-cream sm:py-32">
        <div className="pattern-fronds absolute inset-0 opacity-50" aria-hidden />
        <div className="container-site relative grid grid-cols-1 gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading tone="light" eyebrow={dict.site.home.processEyebrow} title={dict.site.home.processTitle} />
            <div className="relative mt-10 aspect-[4/5] overflow-hidden rounded-[1.5rem] ring-1 ring-white/10">
              <Image
                src={publicStorageUrl("site", content.home.featuredImage) ?? ""}
                alt=""
                fill
                sizes="(min-width: 1024px) 38vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
          <ol className="lg:col-span-6 lg:col-start-7 lg:self-center">
            {content.home.process.map((s, i) => (
              <Reveal as="li" key={i} delay={i * 0.08} className="grid grid-cols-[auto_1fr] gap-6 border-b border-white/10 py-8 first:pt-0 last:border-none">
                <span className="font-display flex size-14 items-center justify-center rounded-full border border-gold-500/50 text-2xl text-gold-300 tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-3xl font-semibold">{s.title[locale]}</h3>
                  <p className="mt-2 max-w-md text-lg leading-relaxed text-cream/70">{s.body[locale]}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Call to action */}
      <section className="container-site py-24">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-gold-100 px-6 py-14 sm:px-14">
          <div className="absolute -end-16 -top-16 size-64 rounded-full bg-gold-300/40 blur-2xl" aria-hidden />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="font-display text-4xl font-semibold text-palm-900 sm:text-5xl">{dict.site.home.ctaTitle}</h2>
              <p className="mt-3 text-lg text-palm-900/75">{dict.site.home.ctaBody}</p>
            </div>
            <Link
              href="/contact?category=wholesale"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-palm-800 px-7 font-semibold text-cream transition-colors hover:bg-palm-700"
            >
              {dict.site.home.ctaButton}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
