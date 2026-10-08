import type { Locale } from "./config";

const TZ = "Asia/Riyadh";
const tag = (l: Locale) => (l === "ar" ? "ar-SA-u-nu-latn" : "en-GB");

export function fmtMoney(value: number | string | null | undefined, locale: Locale, opts: { currency?: boolean } = {}) {
  const n = Number(value ?? 0) + 0;
  const s = new Intl.NumberFormat(tag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  if (opts.currency === false) return s;
  return locale === "ar" ? `${s} ر.س` : `SAR ${s}`;
}

export function fmtNumber(value: number | string | null | undefined, locale: Locale, digits = 0) {
  return new Intl.NumberFormat(tag(locale), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(Number(value ?? 0));
}

export function fmtDate(value: string | Date | null | undefined, locale: Locale, style: "short" | "medium" | "long" = "medium") {
  if (!value) return "—";
  // plain dates (YYYY-MM-DD) are calendar days; don't shift them through time zones
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(tag(locale), {
    timeZone: typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : TZ,
    dateStyle: style,
  }).format(d);
}

export function fmtTime(value: string | Date | null | undefined, locale: Locale) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(tag(locale), { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function fmtDateTime(value: string | Date | null | undefined, locale: Locale) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(tag(locale), { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** Today's date in Saudi Arabia as YYYY-MM-DD. */
export function todayRiyadh() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export function minutesToHours(min: number | null | undefined, locale: Locale) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return locale === "ar" ? `${h}س ${m}د` : `${h}h ${String(m).padStart(2, "0")}m`;
}
