/** Currencies a salesman can price an invoice in. Books are always kept in SAR. */
export const CURRENCIES = ["SAR", "USD", "GBP", "EUR", "AED", "KWD", "PKR", "INR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_INFO: Record<Currency, { en: string; ar: string; symbol: string }> = {
  SAR: { en: "Saudi riyal", ar: "ريال سعودي", symbol: "SAR" },
  USD: { en: "US dollar", ar: "دولار أمريكي", symbol: "$" },
  GBP: { en: "British pound", ar: "جنيه إسترليني", symbol: "£" },
  EUR: { en: "Euro", ar: "يورو", symbol: "€" },
  AED: { en: "UAE dirham", ar: "درهم إماراتي", symbol: "AED" },
  KWD: { en: "Kuwaiti dinar", ar: "دينار كويتي", symbol: "KWD" },
  PKR: { en: "Pakistani rupee", ar: "روبية باكستانية", symbol: "Rs" },
  INR: { en: "Indian rupee", ar: "روبية هندية", symbol: "₹" },
};

export type Rates = { rates: Partial<Record<Currency, number>>; fetchedAt: string | null };

export function fmtCurrency(value: number, currency: string, locale: "en" | "ar") {
  const n = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return `${currency} ${n}`;
}
