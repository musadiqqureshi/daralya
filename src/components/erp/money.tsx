"use client";
import { useI18n } from "@/lib/i18n/client";
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export function Money({ value, className, currency = true, signed = false }: { value: number | string | null | undefined; className?: string; currency?: boolean; signed?: boolean }) {
  const { locale } = useI18n();
  const n = Number(value ?? 0) + 0; // + 0 turns -0 into 0
  return (
    <span className={cn("tabular-nums whitespace-nowrap", signed && n < 0 && "text-destructive", className)} dir="ltr">
      {fmtMoney(n, locale, { currency })}
    </span>
  );
}

export function Num({ value, digits = 3, className }: { value: number | string | null | undefined; digits?: number; className?: string }) {
  const { locale } = useI18n();
  return <span className={cn("tabular-nums", className)}>{fmtNumber(value, locale, digits)}</span>;
}

export function DateText({ value, withTime = false, className }: { value: string | null | undefined; withTime?: boolean; className?: string }) {
  const { locale } = useI18n();
  return <span className={cn("whitespace-nowrap", className)}>{withTime ? fmtDateTime(value, locale) : fmtDate(value, locale)}</span>;
}
