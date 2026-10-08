import type { Metadata } from "next";
import { Clock, MapPin, MessageCircle, Phone, Mail, ExternalLink } from "lucide-react";
import { InquiryForm } from "@/components/site/inquiry-form";
import { PageHeader } from "@/components/site/page-header";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getPublicProducts, getSiteContent } from "@/lib/site/data";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.site.contact.eyebrow, description: dict.site.contact.intro };
}

export default async function ContactPage(props: PageProps<"/contact">) {
  const sp = await props.searchParams;
  const [locale, content, products] = await Promise.all([getLocale(), getSiteContent(), getPublicProducts()]);
  const dict = await getDictionary(locale);
  const t = dict.site.contact;
  const c = content.contact;
  const wa = c.whatsapp.replace(/[^\d]/g, "");
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const product = typeof sp.product === "string" ? sp.product : undefined;

  const rows = [
    { icon: Phone, label: t.callUs, value: c.phone, href: c.phone ? `tel:${c.phone}` : null, ltr: true },
    { icon: MessageCircle, label: t.chat, value: c.whatsapp, href: wa ? `https://wa.me/${wa}` : null, ltr: true },
    { icon: Mail, label: t.writeUs, value: c.email, href: c.email ? `mailto:${c.email}` : null, ltr: true },
    { icon: MapPin, label: dict.common.address, value: c.address[locale], href: c.mapsUrl || null, ltr: false },
    { icon: Clock, label: t.hours, value: c.hours[locale], href: null, ltr: false },
  ].filter((r) => r.value);

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} intro={t.intro} />
      <section className="container-site grid gap-12 py-20 lg:grid-cols-12 lg:gap-16">
        <aside className="lg:col-span-4">
          <h2 className="font-display text-3xl font-semibold text-palm-900">{t.details}</h2>
          <ul className="mt-6 space-y-3">
            {rows.map((r) => {
              const inner = (
                <>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-palm-800 text-gold-300">
                    <r.icon className="size-[1.1rem]" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-muted-foreground">{r.label}</span>
                    <span className="block font-semibold break-words text-palm-900" dir={r.ltr ? "ltr" : undefined}>
                      {r.value}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={r.label}>
                  {r.href ? (
                    <a
                      href={r.href}
                      target={r.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 rounded-2xl border border-palm-900/10 bg-white/70 p-4 transition-colors hover:border-gold-500"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 rounded-2xl border border-palm-900/10 bg-white/70 p-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {c.mapsUrl && (
            <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 font-semibold text-palm-800 hover:text-palm-600">
              {t.map}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
        </aside>
        <div className="rounded-[1.75rem] border border-palm-900/10 bg-white p-6 shadow-[0_30px_60px_-40px_rgba(23,61,50,0.35)] sm:p-10 lg:col-span-8">
          <h2 className="font-display text-3xl font-semibold text-palm-900">{t.formTitle}</h2>
          <div className="mt-6">
            <InquiryForm
              products={products.map((p) => ({ slug: p.slug, name: locale === "ar" ? p.name_ar : p.name_en }))}
              defaultCategory={category}
              defaultProduct={product}
            />
          </div>
        </div>
      </section>
    </>
  );
}
