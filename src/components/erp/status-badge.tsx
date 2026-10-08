"use client";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  posted: "bg-palm-50 text-palm-700 ring-palm-700/15",
  paid: "bg-palm-50 text-palm-700 ring-palm-700/15",
  verified: "bg-palm-50 text-palm-700 ring-palm-700/15",
  approved: "bg-palm-50 text-palm-700 ring-palm-700/15",
  delivered: "bg-palm-50 text-palm-700 ring-palm-700/15",
  present: "bg-palm-50 text-palm-700 ring-palm-700/15",
  active: "bg-palm-50 text-palm-700 ring-palm-700/15",
  closed: "bg-muted text-muted-foreground ring-border",
  partial: "bg-gold-100 text-gold-700 ring-gold-700/20",
  pending: "bg-gold-100 text-gold-700 ring-gold-700/20",
  pending_verification: "bg-gold-100 text-gold-700 ring-gold-700/20",
  draft: "bg-gold-100 text-gold-700 ring-gold-700/20",
  in_transit: "bg-sky-50 text-sky-700 ring-sky-700/15",
  in_progress: "bg-sky-50 text-sky-700 ring-sky-700/15",
  new: "bg-sky-50 text-sky-700 ring-sky-700/15",
  late: "bg-gold-100 text-gold-700 ring-gold-700/20",
  half_day: "bg-gold-100 text-gold-700 ring-gold-700/20",
  on_leave: "bg-violet-50 text-violet-700 ring-violet-700/15",
  holiday: "bg-violet-50 text-violet-700 ring-violet-700/15",
  unpaid: "bg-red-50 text-red-700 ring-red-700/15",
  absent: "bg-red-50 text-red-700 ring-red-700/15",
  failed: "bg-red-50 text-red-700 ring-red-700/15",
  rejected: "bg-red-50 text-red-700 ring-red-700/15",
  cancelled: "bg-muted text-muted-foreground ring-border line-through decoration-1",
  inactive: "bg-muted text-muted-foreground ring-border",
  terminated: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const { dict } = useI18n();
  const text = label ?? (dict.erp.status as Record<string, string>)[status] ?? status;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", tones[status] ?? "bg-muted text-foreground ring-border", className)}>
      {text}
    </span>
  );
}
