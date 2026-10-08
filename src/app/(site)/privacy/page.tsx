import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { privacy } from "@/lib/site/legal";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.site.legal.privacyTitle };
}

export default async function Page() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return <LegalPage title={dict.site.legal.privacyTitle} sections={privacy} locale={locale} updatedLabel={dict.site.legal.updated} />;
}
