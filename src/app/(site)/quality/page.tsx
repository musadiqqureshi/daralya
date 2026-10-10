import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site/data";
import { publicStorageUrl } from "@/lib/supabase/urls";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.site.quality.eyebrow };
}

export default async function QualityPage() {
  const [locale, content] = await Promise.all([getLocale(), getSiteContent()]);
  const dict = await getDictionary(locale);
  const q = content.quality;
  return (
    <>
      <PageHeader eyebrow={dict.site.quality.eyebrow} title={q.title[locale]} intro={q.intro[locale]} image={publicStorageUrl("site", q.image)} />
      <section className="container-site py-20 sm:py-28">
        <ol className="relative grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
          {q.steps.map((s, i) => (
            <Reveal as="li" key={i} delay={(i % 3) * 0.08} className="group">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-beige">
                {s.image && (
                  <Image
                    src={publicStorageUrl("site", s.image) ?? ""}
                    alt=""
                    fill
                    sizes="(min-width:1024px) 30vw, (min-width:768px) 45vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                )}
                <span className="font-display absolute start-4 top-4 flex size-11 items-center justify-center rounded-full bg-cream/95 text-xl font-semibold text-palm-900 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h2 className="font-display mt-6 text-3xl font-semibold text-palm-900">{s.title[locale]}</h2>
              <p className="mt-2 text-lg leading-relaxed text-muted-foreground">{s.body[locale]}</p>
            </Reveal>
          ))}
        </ol>
      </section>
    </>
  );
}
