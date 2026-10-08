import { cn } from "@/lib/utils";

/** The DAD palm monogram, coloured with the current text colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block aspect-[1325/807] bg-current", className)}
      style={{
        WebkitMask: "url(/brand/logo-mark.svg) center / contain no-repeat",
        mask: "url(/brand/logo-mark.svg) center / contain no-repeat",
      }}
    />
  );
}

export function Logo({
  className,
  markClassName,
  name,
  sub,
  tone = "dark",
}: {
  className?: string;
  markClassName?: string;
  name: string;
  sub?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark className={cn("h-9", tone === "light" ? "text-gold-500" : "text-palm-800", markClassName)} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-[1.3rem] font-semibold", tone === "light" ? "text-cream" : "text-palm-900")}>{name}</span>
        {sub ? (
          <span className={cn("mt-1 text-[0.62rem] font-semibold tracking-[0.2em] uppercase rtl:tracking-normal rtl:text-[0.7rem]", tone === "light" ? "text-gold-300" : "text-gold-700")}>
            {sub}
          </span>
        ) : null}
      </span>
    </span>
  );
}
