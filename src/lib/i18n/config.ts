export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "locale";

export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");
export const isLocale = (v: unknown): v is Locale => v === "en" || v === "ar";

/** Pick the field matching the locale, falling back to the other language. */
export function pick<T extends Record<string, unknown>>(row: T | null | undefined, base: string, locale: Locale): string {
  if (!row) return "";
  const primary = row[`${base}_${locale}`] as string | null | undefined;
  const other = row[`${base}_${locale === "ar" ? "en" : "ar"}`] as string | null | undefined;
  return (primary || other || (row[base] as string) || "") as string;
}
