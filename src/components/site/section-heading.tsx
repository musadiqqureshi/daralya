import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "start",
  tone = "dark",
  className,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "start" | "center";
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", "max-w-2xl", className)}>
      {eyebrow && (
        <p className={cn("eyebrow flex items-center gap-3", align === "center" && "justify-center", tone === "light" ? "text-gold-300" : "text-gold-700")}>
          <span className="h-px w-8 bg-current opacity-60" aria-hidden />
          {eyebrow}
        </p>
      )}
      <h2 className={cn("font-display mt-3 text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl", tone === "light" ? "text-cream" : "text-palm-900")}>
        {title}
      </h2>
      {intro && <p className={cn("mt-4 text-lg leading-relaxed text-pretty", tone === "light" ? "text-cream/75" : "text-muted-foreground")}>{intro}</p>}
    </div>
  );
}
