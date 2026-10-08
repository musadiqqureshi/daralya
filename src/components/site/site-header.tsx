"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LockKeyhole, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { dict, locale } = useI18n();
  const pathname = usePathname();
  const overlay = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nav = [
    { href: "/", label: dict.site.nav.home },
    { href: "/about", label: dict.site.nav.about },
    { href: "/#our-dates", label: dict.site.nav.dates },
    { href: "/portfolio", label: dict.site.nav.portfolio },
    { href: "/quality", label: dict.site.nav.quality },
    { href: "/contact", label: dict.site.nav.contact },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href));
  const solid = !overlay || scrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300",
        solid ? "border-b border-palm-900/10 bg-cream/90 shadow-[0_1px_0_rgba(23,61,50,0.04)] backdrop-blur-md" : "border-b border-transparent bg-transparent",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-palm-800 focus:px-3 focus:py-2 focus:text-cream">
        {dict.site.nav.skip}
      </a>
      <div className="container-site flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" aria-label={dict.common.brand} className="shrink-0">
          <Logo
            name={locale === "ar" ? "دار العالية" : "Dar Al-Aaliya"}
            sub={locale === "ar" ? "للتمور" : "Dates"}
            tone={solid ? "dark" : "light"}
            markClassName="h-8"
          />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative rounded-full px-3 py-2 text-[0.92rem] font-medium transition-colors",
                    solid ? "text-palm-900/80 hover:text-palm-900" : "text-cream/85 hover:text-cream",
                    isActive(item.href) &&
                      "after:absolute after:inset-x-3 after:-bottom-0.5 after:h-px after:bg-gold-500" +
                        (solid ? " text-palm-900" : " text-cream"),
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <LanguageToggle
            className={cn("hidden sm:inline-flex", solid ? "text-palm-900 hover:bg-palm-900/5" : "text-cream hover:bg-white/10")}
          />
          <Link
            href="/erp"
            className={cn(
              "hidden items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors sm:inline-flex",
              solid
                ? "border-palm-800 bg-palm-800 text-cream hover:bg-palm-700"
                : "border-cream/40 text-cream hover:border-cream hover:bg-white/10",
            )}
          >
            <LockKeyhole className="size-3.5" aria-hidden />
            {dict.site.nav.erp}
          </Link>

          <Sheet>
            <SheetTrigger
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-full lg:hidden",
                solid ? "text-palm-900 hover:bg-palm-900/5" : "text-cream hover:bg-white/10",
              )}
              aria-label={dict.site.nav.menu}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side={locale === "ar" ? "left" : "right"} className="w-[86vw] max-w-sm border-none bg-palm-900 p-0 text-cream [&>button]:hidden">
              <SheetHeader className="flex-row items-center justify-between border-b border-white/10 px-5 py-4">
                <SheetTitle className="text-cream">
                  <Logo name={locale === "ar" ? "دار العالية" : "Dar Al-Aaliya"} sub={locale === "ar" ? "للتمور" : "Dates"} tone="light" markClassName="h-7" />
                </SheetTitle>
                <SheetClose className="inline-flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label={dict.site.nav.closeMenu}>
                  <X className="size-5" />
                </SheetClose>
              </SheetHeader>
              <nav aria-label="Mobile" className="px-3 py-4">
                <ul className="space-y-1">
                  {nav.map((item) => (
                    <li key={item.href}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-3 py-3 font-display text-2xl transition-colors hover:bg-white/5",
                            isActive(item.href) ? "text-gold-300" : "text-cream",
                          )}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto space-y-3 border-t border-white/10 p-5">
                <LanguageToggle className="w-full justify-center border border-white/20 py-2.5 text-cream hover:bg-white/10" />
                <SheetClose asChild>
                  <Link href="/erp" className="flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 py-2.5 text-sm font-semibold text-palm-950 hover:bg-gold-300">
                    <LockKeyhole className="size-4" aria-hidden />
                    {dict.site.nav.erp}
                  </Link>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
