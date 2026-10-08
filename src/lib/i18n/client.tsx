"use client";
import { createContext, useContext } from "react";
import type { Locale } from "./config";
import type { Dict } from "./dictionaries/en";

const I18nContext = createContext<{ locale: Locale; dict: Dict } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return { ...ctx, dir: ctx.locale === "ar" ? ("rtl" as const) : ("ltr" as const) };
}
