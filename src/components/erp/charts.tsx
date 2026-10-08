"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n/client";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/i18n/format";

export const PALETTE = ["#173d32", "#c8a45d", "#6e8b74", "#b5654a", "#d9c59a", "#2b6a58", "#8f7036", "#4b5d52"];
const axis = { fontSize: 11, fill: "#6b6a62" };
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd0" vertical={false} />;

function useFmt() {
  const { locale, dir } = useI18n();
  return {
    locale,
    rtl: dir === "rtl",
    money: (v: number) => fmtMoney(v, locale, { currency: false }),
    short: (v: number) => (Math.abs(v) >= 1000 ? `${fmtNumber(v / 1000, locale, 1)}k` : fmtNumber(v, locale, 0)),
    day: (iso: string) => fmtDate(iso, locale, "short").replace(/\/\d{4}$|\/\d{2}$/, ""),
  };
}

function ChartTooltip({ active, payload, label, money = true, labelFmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean; labelFmt?: (l: string) => string }) {
  const f = useFmt();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{labelFmt ? labelFmt(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ms-auto font-semibold tabular-nums" dir="ltr">
            {money ? f.money(p.value) : fmtNumber(p.value, f.locale, 1)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function SeriesChart({
  data,
  series,
  height = 260,
  kind = "area",
  money = true,
  xKey = "date",
  stacked = false,
}: {
  data: Record<string, unknown>[];
  series: { key: string; label: string; color?: string }[];
  height?: number;
  kind?: "area" | "bar";
  money?: boolean;
  xKey?: string;
  stacked?: boolean;
}) {
  const f = useFmt();
  const isDate = xKey === "date";
  return (
    <ResponsiveContainer width="100%" height={height}>
      {kind === "area" ? (
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {grid}
          <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} reversed={f.rtl} tickFormatter={isDate ? f.day : undefined} minTickGap={16} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={44} orientation={f.rtl ? "right" : "left"} tickFormatter={f.short} />
          <Tooltip content={<ChartTooltip money={money} labelFmt={isDate ? f.day : undefined} />} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} strokeWidth={2} fill={`url(#g-${s.key})`} />
          ))}
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {grid}
          <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} reversed={f.rtl} tickFormatter={isDate ? f.day : undefined} minTickGap={8} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={44} orientation={f.rtl ? "right" : "left"} tickFormatter={f.short} />
          <Tooltip content={<ChartTooltip money={money} labelFmt={isDate ? f.day : undefined} />} cursor={{ fill: "#f3efe6" }} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i]} radius={stacked ? 0 : [4, 4, 0, 0]} stackId={stacked ? "s" : undefined} maxBarSize={36} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

/** Horizontal ranking bars (no chart library needed, prints well). */
export function RankBars({ items, money = true }: { items: { label: string; value: number; sub?: string }[]; money?: boolean }) {
  const f = useFmt();
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={it.label + i}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{it.label}</span>
            <span className="shrink-0 font-semibold tabular-nums" dir="ltr">
              {money ? f.money(it.value) : fmtNumber(it.value, f.locale, 1)}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
          </div>
          {it.sub && <p className="mt-1 text-xs text-muted-foreground">{it.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Capacity meters for storages. */
export function CapacityBars({ items, unitLabel, capTemplate }: { items: { label: string; kg: number; capacity: number | null }[]; unitLabel: string; capTemplate: string }) {
  const f = useFmt();
  return (
    <ul className="space-y-4">
      {items.map((s) => {
        const pct = s.capacity ? Math.min((s.kg / s.capacity) * 100, 100) : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground tabular-nums">
                <span className="font-semibold text-foreground">{fmtNumber(s.kg, f.locale, 0)}</span> {unitLabel}
                {s.capacity ? ` ${capTemplate.replace("{cap}", fmtNumber(s.capacity, f.locale, 0))}` : ""}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct ?? 100}%`, background: pct === null ? "#d9c59a" : pct > 90 ? "#b3412e" : pct > 75 ? "#c8a45d" : "#173d32" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
