import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { JsonLd } from "@/components/site/json-ld";
import { getSiteContent } from "@/lib/site/data";
import { organizationLd, websiteLd } from "@/lib/site/seo";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [locale, content] = await Promise.all([getLocale(), getSiteContent()]);
  const dict = await getDictionary(locale);
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <JsonLd data={[organizationLd(content, locale), websiteLd(locale)]} />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter content={content} dict={dict} locale={locale} />
    </div>
  );
}
