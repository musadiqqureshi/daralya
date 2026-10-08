import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { ar } from "./dictionaries/ar";

export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^\s*ar\b/i.test(accept) ? "ar" : defaultLocale;
});

export async function getDictionary(locale?: Locale) {
  const l = locale ?? (await getLocale());
  return l === "ar" ? ar : en;
}
