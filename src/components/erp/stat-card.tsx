import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative" | "warning" | "brand";
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8rem] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              tone === "brand" ? "bg-gold-500/20 text-gold-300" : "bg-palm-50 text-palm-700",
              tone === "negative" && "bg-destructive/10 text-destructive",
              tone === "warning" && "bg-warning/10 text-warning",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-2 text-[1.55rem] leading-none font-semibold tracking-tight tabular-nums",
          tone === "brand" ? "text-cream" : "text-palm-900",
          tone === "negative" && "text-destructive",
          tone === "positive" && "text-success",
        )}
      >
        {value}
      </p>
      {hint && <p className={cn("mt-2 text-xs", tone === "brand" ? "text-cream/60" : "text-muted-foreground")}>{hint}</p>}
    </>
  );
  const cls = cn(
    "block rounded-xl border p-4 transition-colors",
    tone === "brand" ? "border-transparent bg-palm-800" : "bg-card",
    href && "hover:border-gold-500/50",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
