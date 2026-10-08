import { monthStart, todayRiyadh } from "@/lib/i18n/format";

const iso = /^\d{4}-\d{2}-\d{2}$/;

/** Read ?from/?to with a this-month default. */
export function readRange(sp: Record<string, string | string[] | undefined>, fallback: "month" | "today" = "month") {
  const today = todayRiyadh();
  const from = typeof sp.from === "string" && iso.test(sp.from) ? sp.from : fallback === "today" ? today : monthStart(today);
  const to = typeof sp.to === "string" && iso.test(sp.to) ? sp.to : today;
  return from <= to ? { from, to } : { from: to, to: from };
}
