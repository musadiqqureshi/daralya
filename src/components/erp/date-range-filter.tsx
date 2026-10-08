"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { addDays, monthStart, todayRiyadh } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export function rangePresets() {
  const today = todayRiyadh();
  const d = new Date(`${today}T12:00:00Z`);
  const dow = d.getUTCDay(); // week starts Saturday in KSA
  const weekStart = addDays(today, -((dow + 1) % 7));
  const lastMonthEnd = addDays(monthStart(today), -1);
  return {
    today: { from: today, to: today },
    week: { from: weekStart, to: today },
    month: { from: monthStart(today), to: today },
    lastMonth: { from: monthStart(lastMonthEnd), to: lastMonthEnd },
  };
}

/** URL-driven period filter (?from=YYYY-MM-DD&to=YYYY-MM-DD) with quick presets. */
export function DateRangeFilter({ from, to }: { from: string; to: string }) {
  const { dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const presets = rangePresets();
  const set = (f: string, t: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("from", f);
    next.set("to", t);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const active = (Object.keys(presets) as (keyof typeof presets)[]).find((k) => presets[k].from === from && presets[k].to === to);
  const labels = { today: dict.common.today, week: dict.common.thisWeek, month: dict.common.thisMonth, lastMonth: dict.common.lastMonth };
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="inline-flex rounded-lg border bg-card p-0.5">
        {(Object.keys(presets) as (keyof typeof presets)[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => set(presets[k].from, presets[k].to)}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors", active === k ? "bg-palm-800 text-cream" : "text-muted-foreground hover:text-foreground")}
          >
            {labels[k]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-0.5">
        <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden />
        <Input type="date" value={from} max={to} onChange={(e) => e.target.value && set(e.target.value, to)} aria-label={dict.common.from} className="h-7 w-[8.4rem] border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-0" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="date" value={to} min={from} onChange={(e) => e.target.value && set(from, e.target.value)} aria-label={dict.common.to} className="h-7 w-[8.4rem] border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-0" />
      </div>
    </div>
  );
}
