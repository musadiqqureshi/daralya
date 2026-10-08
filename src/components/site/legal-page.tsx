import { PageHeader } from "@/components/site/page-header";
import type { Locale } from "@/lib/i18n/config";
import { fmtDate } from "@/lib/i18n/format";
import type { Bi } from "@/lib/site/content";
import { legalUpdated } from "@/lib/site/legal";

export function LegalPage({ title, sections, locale, updatedLabel }: { title: string; sections: { heading: Bi; body: Bi }[]; locale: Locale; updatedLabel: string }) {
  return (
    <>
      <PageHeader eyebrow={`${updatedLabel}: ${fmtDate(legalUpdated, locale, "long")}`} title={title} />
      <article className="container-site max-w-3xl py-16 sm:py-20">
        {sections.map((s) => (
          <section key={s.heading.en} className="border-b border-palm-900/10 py-8 first:pt-0 last:border-none">
            <h2 className="font-display text-3xl font-semibold text-palm-900">{s.heading[locale]}</h2>
            <p className="mt-3 text-lg leading-relaxed text-foreground/80">{s.body[locale]}</p>
          </section>
        ))}
      </article>
    </>
  );
}
