import type { Metadata } from "next";
import Image from "next/image";
import { Compass, Package, ShieldCheck, Snowflake, Target } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site/data";
import { publicStorageUrl } from "@/lib/supabase/urls";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.site.about.eyebrow };
}

export default async function AboutPage() {
  const [locale, content] = await Promise.all([getLocale(), getSiteContent()]);
  const dict = await getDictionary(locale);
  const a = content.about;
  const pillars = [
    { icon: Target, title: dict.site.about.missionTitle, body: a.mission[locale] },
    { icon: Compass, title: dict.site.about.visionTitle, body: a.vision[locale] },
    { icon: ShieldCheck, title: dict.site.about.qualityTitle, body: a.quality[locale] },
  ];
  return (
    <>
      <PageHeader eyebrow={dict.site.about.eyebrow} title={a.title[locale]} />
      <section className="container-site grid gap-14 py-20 sm:py-28 lg:grid-cols-12">
        <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] lg:col-span-5">
          <Image src={publicStorageUrl("site", a.image) ?? ""} alt={a.imageAlt[locale]} fill sizes="(min-width:1024px) 40vw, 100vw" className="object-cover" />
        </Reveal>
        <div className="lg:col-span-6 lg:col-start-7 lg:self-center">
          <Reveal>
            <p className="font-display text-3xl leading-snug text-palm-900 sm:text-[2.1rem]">{a.body[locale]}</p>
          </Reveal>
          <ul className="mt-12 space-y-8">
            {pillars.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 0.08} className="flex gap-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-palm-800 text-gold-300">
                  <p.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-palm-900">{p.title}</h2>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-palm-900 py-20 text-cream sm:py-24">
        <div className="container-site grid gap-6 md:grid-cols-2">
          {[
            { icon: Package, title: dict.site.about.wholesaleTitle, body: a.wholesale[locale] },
            { icon: Snowflake, title: dict.site.about.sourcingTitle, body: a.sourcing[locale] },
          ].map((b, i) => (
            <Reveal key={b.title} delay={i * 0.08} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-8 sm:p-10">
              <b.icon className="size-7 text-gold-500" aria-hidden />
              <h2 className="font-display mt-6 text-3xl font-semibold">{b.title}</h2>
              <p className="mt-3 text-lg leading-relaxed text-cream/75">{b.body}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
