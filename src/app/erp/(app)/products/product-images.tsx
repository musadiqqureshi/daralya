"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowDown, ArrowUp, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { Section } from "@/components/erp/section";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { getBrowserClient } from "@/lib/supabase/client";
import { publicStorageUrl } from "@/lib/supabase/urls";
import { addProductImage, moveProductImage, removeProductImage } from "./actions";

export function ProductImages({ productId, images, name }: { productId: string; images: { id: string; src: string }[]; name: { en: string; ar: string } }) {
  const { dict } = useI18n();
  const t = dict.erp.products;
  const { run, pending } = useServerAction();
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${productId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await getBrowserClient().storage.from("products").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return void run(async () => ({ ok: false, error: error.message }));
    void run(() => addProductImage(productId, path, name.en, name.ar));
  };

  return (
    <Section title={t.images}>
      {images.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <Image src={publicStorageUrl("products", img.src) ?? ""} alt="" fill sizes="200px" className="object-cover" />
              {i === 0 && <span className="absolute start-1.5 top-1.5 rounded bg-palm-800 px-1.5 py-0.5 text-[0.65rem] font-semibold text-cream">★</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button type="button" size="icon-xs" variant="secondary" disabled={pending || i === 0} onClick={() => run(() => moveProductImage(productId, img.id, -1))} aria-label="Move up">
                  <ArrowUp />
                </Button>
                <Button type="button" size="icon-xs" variant="secondary" disabled={pending || i === images.length - 1} onClick={() => run(() => moveProductImage(productId, img.id, 1))} aria-label="Move down">
                  <ArrowDown />
                </Button>
                <Button type="button" size="icon-xs" variant="destructive" disabled={pending} onClick={() => run(() => removeProductImage(img.id))} aria-label={dict.common.remove}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {t.uploadImage}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.imageUrl} className="ps-9" />
          </div>
          <Button type="button" variant="outline" disabled={pending || !/^https:\/\//.test(url)} onClick={() => run(() => addProductImage(productId, url.trim(), name.en, name.ar), { onSuccess: () => setUrl("") })}>
            {t.addImage}
          </Button>
        </div>
      </div>
    </Section>
  );
}
