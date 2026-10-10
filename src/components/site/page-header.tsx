import Image from "next/image";

/** Inner-page header: sits under the fixed nav, with an optional photo band. */
export function PageHeader({ eyebrow, title, intro, image }: { eyebrow: string; title: string; intro?: string; image?: string | null }) {
  return (
    <section className="relative overflow-hidden border-b border-palm-900/8 bg-[#f3eddf] pt-36 pb-16 sm:pt-40 sm:pb-20">
      <div className="pattern-fronds absolute inset-0 opacity-70" aria-hidden />
      <div className="container-site relative grid grid-cols-1 items-end gap-10 lg:grid-cols-12">
        <div className={image ? "lg:col-span-7" : "lg:col-span-9"}>
          <p className="eyebrow flex items-center gap-3 text-gold-700">
            <span className="h-px w-8 bg-current opacity-60" aria-hidden />
            {eyebrow}
          </p>
          <h1 className="font-display mt-4 text-5xl leading-[1.04] font-semibold text-balance text-palm-900 sm:text-6xl lg:text-7xl rtl:leading-[1.3]">
            {title}
          </h1>
          {intro && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/75">{intro}</p>}
        </div>
        {image && (
          <div className="relative aspect-[5/4] overflow-hidden rounded-[1.5rem] ring-1 ring-palm-900/10 lg:col-span-5">
            <Image src={image} alt="" fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}
