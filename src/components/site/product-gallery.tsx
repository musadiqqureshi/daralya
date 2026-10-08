"use client";
import Image from "next/image";
import { useState } from "react";
import { publicStorageUrl } from "@/lib/supabase/urls";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: { src: string; alt: string }[]; name: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) return <div className="pattern-fronds aspect-[4/5] rounded-[1.5rem] bg-palm-800" aria-hidden />;
  const current = images[Math.min(active, images.length - 1)];
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-beige ring-1 ring-palm-900/8">
        <Image
          key={current.src}
          src={publicStorageUrl("products", current.src) ?? ""}
          alt={current.alt || name}
          fill
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover motion-safe:animate-[rise_.5s_ease-out_both]"
        />
      </div>
      {images.length > 1 && (
        <ul className="mt-4 grid grid-cols-5 gap-3" aria-label="Gallery">
          {images.map((img, i) => (
            <li key={img.src + i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${name} ${i + 1}`}
                aria-pressed={i === active}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-xl ring-2 transition",
                  i === active ? "ring-gold-500" : "ring-transparent opacity-75 hover:opacity-100",
                )}
              >
                <Image src={publicStorageUrl("products", img.src) ?? ""} alt="" fill sizes="120px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
