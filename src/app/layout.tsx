import type { Metadata, Viewport } from "next";
import { Amiri, Cormorant_Garamond, IBM_Plex_Sans_Arabic, Manrope } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n/client";
import { dirOf } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site/data";
import { SITE_URL } from "@/lib/site/seo";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display-en", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const bodyAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-body-ar", display: "swap" });
const displayAr = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-display-ar", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const [locale, content] = await Promise.all([getLocale(), getSiteContent()]);
  const dict = await getDictionary(locale);
  // admin-editable in ERP → Website (SEO), dictionary as fallback
  const title = content.seo.title[locale] || dict.meta.title;
  const description = content.seo.description[locale] || dict.meta.description;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${dict.common.brand}` },
    description,
    applicationName: dict.common.brand,
    keywords:
      locale === "ar"
        ? ["تمور", "تمور المدينة المنورة", "عجوة المدينة", "تمر سكري", "تمر صقعي", "تمر مجدول", "تمور بالجملة", "دار العالية للتمور", "العوالي"]
        : ["Saudi dates", "Madinah dates", "Ajwa dates", "Sukari dates", "Majdool dates", "wholesale dates", "Dar Al-Aaliya Dates", "Al-Awali Madinah"],
    authors: [{ name: dict.common.brand, url: SITE_URL }],
    creator: dict.common.brand,
    publisher: dict.common.brand,
    formatDetection: { telephone: true, address: true, email: true },
    openGraph: {
      type: "website",
      siteName: locale === "ar" ? "دار العالية للتمور" : "Dar Al-Aaliya Dates",
      title,
      description,
      url: SITE_URL,
      locale: locale === "ar" ? "ar_SA" : "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION
      ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION, other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined } }
      : {}),
  };
}

export const viewport: Viewport = { themeColor: "#173d32", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const dir = dirOf(locale);
  return (
    <html
      lang={locale}
      dir={dir}
      data-locale={locale}
      className={`${display.variable} ${body.variable} ${bodyAr.variable} ${displayAr.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <I18nProvider locale={locale} dict={dict}>
          <DirectionProvider dir={dir}>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster position={dir === "rtl" ? "top-left" : "top-right"} richColors closeButton />
            </TooltipProvider>
          </DirectionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
