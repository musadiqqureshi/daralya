import type { Metadata } from "next";
import { pageMeta } from "@/lib/site/seo";
import { LegalPage } from "@/components/site/legal-page";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { terms } from "@/lib/site/legal";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return pageMeta({ path: "/terms", locale, title: dict.site.legal.termsTitle });
}

export default async function Page() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return <LegalPage title={dict.site.legal.termsTitle} sections={terms} locale={locale} updatedLabel={dict.site.legal.updated} />;
}
