"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocale } from "@/lib/i18n/actions";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      lang={next}
      onClick={() =>
        start(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
      disabled={pending}
      aria-label={`${dict.common.language}: ${dict.common.switchTo}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      {!compact && <span className={next === "ar" ? "font-[family-name:var(--font-body-ar)]" : undefined}>{dict.common.switchTo}</span>}
    </button>
  );
}
