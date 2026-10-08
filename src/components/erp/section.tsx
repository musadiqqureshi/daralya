import { cn } from "@/lib/utils";

/** A titled panel used to group content on detail pages. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
          <div>
            {title && <h2 className="text-[0.95rem] font-semibold text-palm-900">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 print:hidden">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KeyValues({ items, cols = 2 }: { items: { label: string; value: React.ReactNode; wide?: boolean }[]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>
      {items.map((i) => (
        <div key={i.label} className={cn("min-w-0", i.wide && "sm:col-span-full")}>
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
