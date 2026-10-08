import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { getSession } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ERP", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/erp/login">) {
  const sp = await props.searchParams;
  if (await getSession()) redirect("/erp");
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <main className="grid min-h-screen bg-cream lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-palm-900 p-12 text-cream lg:flex lg:flex-col lg:justify-between">
        <div className="pattern-fronds absolute inset-0 opacity-60" aria-hidden />
        <LogoMark className="pointer-events-none absolute -end-24 -bottom-16 h-[26rem] text-gold-500/[0.07]" />
        <Logo className="relative" name={dict.common.brandShort} sub={locale === "ar" ? "للتمور" : "Dates"} tone="light" markClassName="h-11" />
        <div className="relative max-w-md">
          <p className="font-display text-5xl leading-tight font-semibold">
            {locale === "ar" ? "نظام إدارة الأعمال" : "Business management system"}
          </p>
          <p className="mt-4 text-lg text-cream/70">
            {locale === "ar"
              ? "المشتريات والمبيعات والمخزون والتخزين المبرد والتوصيل والمالية والموظفون — في مكان واحد."
              : "Purchases, sales, stock, cold storage, deliveries, money and people — in one place."}
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-cream/60">
          <ShieldCheck className="size-4 text-gold-500" aria-hidden />
          {locale === "ar" ? "اتصال آمن · صلاحيات حسب الدور · سجل تدقيق" : "Secure connection · Role-based access · Audit trail"}
        </p>
      </section>
      <section className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-palm-800 hover:text-palm-600">
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {dict.auth.backToSite}
          </Link>
          <LanguageToggle className="text-palm-900 hover:bg-palm-900/5" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <LogoMark className="h-10 text-palm-800 lg:hidden" />
          <h1 className="font-display mt-6 text-4xl font-semibold text-palm-900 lg:mt-0">{dict.auth.title}</h1>
          <p className="mt-2 mb-8 text-muted-foreground">{dict.auth.subtitle}</p>
          <LoginForm
            next={typeof sp.next === "string" ? sp.next : undefined}
            expired={sp.expired === "1"}
            configured={isSupabaseConfigured}
          />
        </div>
      </section>
    </main>
  );
}
