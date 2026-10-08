"use client";
import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/dictionaries/en";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Uploads straight to Supabase Storage with the signed-in user's session
 * (bucket policies decide who may upload). Returns the stored object path.
 */
export function FileUpload({
  bucket,
  folder,
  value,
  onChange,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  maxMb = 8,
}: {
  bucket: "documents" | "products" | "site" | "staff";
  folder: string;
  value: string | null;
  onChange: (path: string | null) => void;
  accept?: string;
  maxMb?: number;
}) {
  const { dict } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setErr(null);
    if (file.size > maxMb * 1024 * 1024) {
      setErr(tpl(dict.erp.forms.maxSize, { mb: maxMb }));
      return;
    }
    setBusy(true);
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await getBrowserClient().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (error) setErr(error.message);
    else onChange(path);
  };

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <FileText className="size-4 text-palm-700" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{dict.erp.forms.uploaded} · {value.split("/").pop()}</span>
          <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={dict.common.remove}>
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={busy} className="w-full justify-start">
          {busy ? <Loader2 className="animate-spin" /> : <Paperclip />}
          {busy ? dict.erp.forms.uploading : dict.erp.forms.uploadFile}
          <span className="ms-auto text-xs text-muted-foreground">{tpl(dict.erp.forms.maxSize, { mb: maxMb })}</span>
        </Button>
      )}
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}
