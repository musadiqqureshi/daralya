import "server-only";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES, type Currency, type Rates } from "./currency";

const MAX_AGE_MS = 60 * 60 * 1000; // refresh at most hourly

/**
 * Live exchange rates as SAR per 1 unit. Cached in `exchange_rates` and refreshed
 * from open.er-api.com (free, no key) when older than an hour. The database
 * function that posts a sale reads the rate from the table, never from the browser.
 */
export async function getRates(opts: { force?: boolean } = {}): Promise<Rates> {
  const supabase = await createClient();
  const { data } = await supabase.from("exchange_rates").select("currency, sar_per_unit, fetched_at");
  const rows = (data ?? []) as { currency: Currency; sar_per_unit: number; fetched_at: string }[];
  const oldest = rows.length ? Math.min(...rows.map((r) => new Date(r.fetched_at).getTime())) : 0;
  const missing = CURRENCIES.some((c) => c !== "SAR" && !rows.find((r) => r.currency === c));
  if ((opts.force || missing || Date.now() - oldest > MAX_AGE_MS) && hasAdminKey()) {
    const fresh = await refreshRates();
    if (fresh) return fresh;
  }
  return {
    rates: { SAR: 1, ...Object.fromEntries(rows.map((r) => [r.currency, Number(r.sar_per_unit)])) },
    fetchedAt: rows.length ? new Date(oldest).toISOString() : null,
  };
}

async function refreshRates(): Promise<Rates | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/SAR", { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { result: string; rates: Record<string, number> };
    if (json.result !== "success") return null;
    const now = new Date().toISOString();
    // API gives units of X per 1 SAR → invert to SAR per 1 X
    const rows = CURRENCIES.filter((c) => c !== "SAR" && json.rates[c] > 0).map((c) => ({
      currency: c,
      sar_per_unit: Number((1 / json.rates[c]).toFixed(8)),
      source: "open.er-api.com",
      fetched_at: now,
    }));
    await createAdminClient().from("exchange_rates").upsert(rows, { onConflict: "currency" });
    return { rates: { SAR: 1, ...Object.fromEntries(rows.map((r) => [r.currency, r.sar_per_unit])) }, fetchedAt: now };
  } catch {
    return null;
  }
}
