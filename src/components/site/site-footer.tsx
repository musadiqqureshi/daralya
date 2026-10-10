import Link from "next/link";
import { MapPin, MessageCircle, Phone, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/shared/language-toggle";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/en";
import type { SiteContent } from "@/lib/site/content";

const socialLabels: Record<keyof SiteContent["social"], string> = {
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  facebook: "Facebook",
  youtube: "YouTube",
};

export function SiteFooter({ content, dict, locale }: { content: SiteContent; dict: Dict; locale: Locale }) {
  const c = content.contact;
  const socials = (Object.keys(socialLabels) as (keyof SiteContent["social"])[]).filter((k) => content.social[k]);
  const wa = c.whatsapp.replace(/[^\d]/g, "");
  return (
    <footer className="relative overflow-hidden bg-palm-950 text-cream/80">
      <div className="pattern-fronds pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="container-site relative grid grid-cols-1 gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo name={dict.common.brandShort} sub={locale === "ar" ? "للتمور" : "Dates"} tone="light" markClassName="h-10" />
          <p className="mt-5 max-w-sm text-[0.95rem] leading-relaxed text-cream/70">{content.footer.blurb[locale]}</p>
          {socials.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow text-gold-300">{dict.site.footer.follow}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {socials.map((k) => (
                  <li key={k}>
                    <a
                      href={content.social[k]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-full border border-cream/15 px-3 py-1.5 text-sm text-cream/80 transition-colors hover:border-gold-500 hover:text-gold-300"
                    >
                      {socialLabels[k]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <nav aria-label={dict.site.footer.explore} className="md:col-span-3">
          <p className="eyebrow text-gold-300">{dict.site.footer.explore}</p>
          <ul className="mt-4 space-y-2.5 text-[0.95rem]">
            {[
              ["/", dict.site.nav.home],
              ["/about", dict.site.nav.about],
              ["/portfolio", dict.site.nav.portfolio],
              ["/quality", dict.site.nav.quality],
              ["/contact", dict.site.nav.contact],
              ["/erp", dict.site.nav.erp],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="transition-colors hover:text-gold-300">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-4">
          <p className="eyebrow text-gold-300">{dict.site.footer.contact}</p>
          <ul className="mt-4 space-y-3 text-[0.95rem]">
            <li className="flex gap-3">
              <MapPin className="mt-1 size-4 shrink-0 text-gold-500" aria-hidden />
              <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold-300">
                {c.address[locale]}
              </a>
            </li>
            {c.phone && (
              <li className="flex gap-3">
                <Phone className="mt-1 size-4 shrink-0 text-gold-500" aria-hidden />
                <a href={`tel:${c.phone}`} dir="ltr" className="hover:text-gold-300">
                  {c.phone}
                </a>
              </li>
            )}
            {wa && (
              <li className="flex gap-3">
                <MessageCircle className="mt-1 size-4 shrink-0 text-gold-500" aria-hidden />
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="hover:text-gold-300">
                  {c.whatsapp}
                </a>
              </li>
            )}
            {c.email && (
              <li className="flex gap-3">
                <Mail className="mt-1 size-4 shrink-0 text-gold-500" aria-hidden />
                <a href={`mailto:${c.email}`} className="hover:text-gold-300">
                  {c.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="container-site flex flex-col items-start justify-between gap-4 py-6 text-sm text-cream/60 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {dict.common.brand}. {dict.site.footer.rights}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-gold-300">
              {dict.site.footer.privacy}
            </Link>
            <Link href="/terms" className="hover:text-gold-300">
              {dict.site.footer.terms}
            </Link>
            <LanguageToggle className="-mx-3 text-cream/70 hover:text-gold-300" />
          </div>
        </div>
      </div>
    </footer>
  );
}
