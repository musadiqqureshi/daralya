import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site/data";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [locale, content] = await Promise.all([getLocale(), getSiteContent()]);
  const dict = await getDictionary(locale);
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter content={content} dict={dict} locale={locale} />
    </div>
  );
}
