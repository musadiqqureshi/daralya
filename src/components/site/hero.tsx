import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, MapPin } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/en";
import type { SiteContent } from "@/lib/site/content";
import { publicStorageUrl } from "@/lib/supabase/urls";

export function Hero({ content, locale, dict }: { content: SiteContent["hero"]; locale: Locale; dict: Dict }) {
  const img = publicStorageUrl("site", content.image);
  return (
    <section aria-labelledby="hero-title" className="relative isolate min-h-[100svh] overflow-hidden bg-palm-900 text-cream">
      {/* Photograph: full-bleed on mobile, right-hand panel on desktop */}
      <div className="absolute inset-0 lg:start-[54%]">
        {img && (
          <Image
            src={img}
            alt={content.imageAlt[locale]}
            fill
            priority
            sizes="(min-width: 1024px) 46vw, 100vw"
            className="object-cover object-center"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-palm-950 via-palm-950/70 to-palm-950/30 lg:bg-gradient-to-r lg:from-palm-900 lg:via-palm-900/10 lg:to-transparent rtl:lg:bg-gradient-to-l" aria-hidden />
      </div>

      {/* Brand panel */}
      <div className="pattern-fronds absolute inset-y-0 start-0 hidden w-[54%] opacity-60 lg:block" aria-hidden />
      <svg
        aria-hidden
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -start-24 -bottom-24 hidden size-[30rem] text-gold-500/10 lg:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <circle cx="200" cy="200" r="198" />
        <circle cx="200" cy="200" r="150" />
        <path d="M200 2v396M2 200h396M60 60l280 280M340 60 60 340" />
      </svg>

      <div className="container-site relative flex min-h-[100svh] flex-col justify-end pt-28 pb-14 lg:justify-center lg:pb-24">
        <div className="max-w-xl lg:max-w-[46%]">
          <p className="eyebrow flex items-center gap-3 text-gold-300 motion-safe:animate-rise">
            <span className="h-px w-10 bg-gold-500" aria-hidden />
            {content.eyebrow[locale]}
          </p>
          <h1
            id="hero-title"
            className="font-display mt-5 text-[2.9rem] leading-[1.02] font-semibold text-balance text-cream motion-safe:animate-rise sm:text-6xl xl:text-[4.6rem] rtl:leading-[1.25]"
            style={{ animationDelay: "80ms" }}
          >
            {content.title[locale]}
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-cream/80 motion-safe:animate-rise" style={{ animationDelay: "160ms" }}>
            {content.subtitle[locale]}
          </p>
          <div className="mt-9 flex flex-col gap-3 motion-safe:animate-rise sm:flex-row" style={{ animationDelay: "240ms" }}>
            <Link
              href="/portfolio"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gold-500 px-7 text-[0.95rem] font-semibold text-palm-950 shadow-[0_10px_30px_-12px_rgba(200,164,93,0.7)] transition-colors hover:bg-gold-300 focus-visible:ring-2 focus-visible:ring-cream focus-visible:outline-none"
            >
              {content.primary[locale]}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full border border-cream/35 px-7 text-[0.95rem] font-semibold text-cream transition-colors hover:border-cream hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:outline-none"
            >
              {content.secondary[locale]}
            </Link>
          </div>
        </div>
      </div>

      {/* Location seal */}
      <div className="absolute end-6 bottom-8 hidden items-center gap-3 rounded-2xl border border-white/15 bg-palm-950/55 px-4 py-3 backdrop-blur-md lg:flex xl:end-10">
        <LogoMark className="h-7 text-gold-500" />
        <div className="text-sm leading-tight">
          <p className="font-semibold text-cream">{dict.common.brand}</p>
          <p className="mt-0.5 flex items-center gap-1 text-cream/70">
            <MapPin className="size-3.5" aria-hidden />
            {locale === "ar" ? "العوالي · المدينة المنورة" : "Al-Awali · Madinah"}
          </p>
        </div>
      </div>

      <a
        href="#intro"
        className="absolute bottom-8 start-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs tracking-[0.25em] text-cream/60 uppercase transition-colors hover:text-cream lg:flex rtl:translate-x-1/2"
      >
        {dict.site.hero.scroll}
        <ArrowDown className="size-4 motion-safe:animate-bounce" aria-hidden />
      </a>
    </section>
  );
}
