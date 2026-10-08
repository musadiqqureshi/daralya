import type { Metadata, Viewport } from "next";
import { Amiri, Cormorant_Garamond, IBM_Plex_Sans_Arabic, Manrope } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n/client";
import { dirOf } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display-en", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const bodyAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-body-ar", display: "swap" });
const displayAr = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-display-ar", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: dict.meta.title, template: `%s · ${dict.common.brand}` },
    description: dict.meta.description,
    icons: { icon: "/icon.svg" },
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
