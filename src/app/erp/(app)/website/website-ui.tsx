"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Mail, MessageCircle, Phone, Plus, Save, Send, Star, Trash2 } from "lucide-react";
import { publishSection, saveDraft, updateInquiry } from "@/app/erp/(app)/_actions/website";
import { setProductFlags } from "@/app/erp/(app)/products/actions";
import { DateText } from "@/components/erp/money";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { getBrowserClient } from "@/lib/supabase/client";
import { publicStorageUrl } from "@/lib/supabase/urls";
import { cn } from "@/lib/utils";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
const isBi = (v: Json): v is { en: string; ar: string } => typeof v === "object" && v !== null && !Array.isArray(v) && "en" in v && "ar" in v && Object.keys(v).length === 2;
const isImageKey = (k: string) => /image$/i.test(k) || k === "ogImage";
const human = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { dict } = useI18n();
  const [busy, setBusy] = useState(false);
  const url = publicStorageUrl("site", value);
  return (
    <div className="flex items-start gap-3">
      <span className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {url && <Image src={url} alt="" fill sizes="112px" className="object-cover" />}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <Input dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className="text-xs" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          {dict.erp.products.uploadImage}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              const path = `content/${crypto.randomUUID()}.${(f.name.split(".").pop() || "jpg").toLowerCase()}`;
              const { error } = await getBrowserClient().storage.from("site").upload(path, f, { contentType: f.type });
              setBusy(false);
              if (!error) onChange(path);
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Recursively renders editors for the content JSON shape (bilingual pairs, images, lists). */
function NodeEditor({ name, value, onChange, depth = 0 }: { name: string; value: Json; onChange: (v: Json) => void; depth?: number }) {
  const { dict } = useI18n();
  const t = dict.erp.website;
  if (isBi(value)) {
    const long = (value.en?.length ?? 0) > 70 || /body|subtitle|intro|description|mission|vision|quality|wholesale|sourcing|blurb/i.test(name);
    const C = long ? Textarea : Input;
    return (
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-[0.82rem] font-medium">{human(name)}</legend>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <Label className="mb-1 text-[0.7rem] text-muted-foreground">{t.english}</Label>
            <C value={value.en} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange({ ...value, en: e.target.value })} rows={long ? 3 : undefined} />
          </div>
          <div>
            <Label className="mb-1 text-[0.7rem] text-muted-foreground">{t.arabic}</Label>
            <C dir="rtl" value={value.ar} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange({ ...value, ar: e.target.value })} rows={long ? 3 : undefined} />
          </div>
        </div>
      </fieldset>
    );
  }
  if (typeof value === "string") {
    return (
      <div className="space-y-1.5">
        <Label className="text-[0.82rem] font-medium">{human(name)}</Label>
        {isImageKey(name) ? <ImageField value={value} onChange={onChange} /> : <Input dir={/url|phone|whatsapp|email|instagram|tiktok|snapchat|facebook|youtube|^x$/i.test(name) ? "ltr" : undefined} value={value} onChange={(e) => onChange(e.target.value)} />}
      </div>
    );
  }
  if (Array.isArray(value)) {
    const template = value[0] ? JSON.parse(JSON.stringify(value[0])) : null;
    const blank = (v: Json): Json => (typeof v === "string" ? "" : isBi(v) ? { en: "", ar: "" } : Array.isArray(v) ? [] : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])) : v);
    return (
      <div className="space-y-3">
        <p className="text-[0.82rem] font-semibold">{human(name)}</p>
        <ol className="space-y-3">
          {value.map((item, i) => (
            <li key={i} className="relative rounded-xl border bg-muted/20 p-4">
              <span className="absolute -start-2.5 -top-2.5 flex size-6 items-center justify-center rounded-full bg-palm-800 text-xs font-bold text-cream">{i + 1}</span>
              <Button type="button" size="icon-xs" variant="ghost" className="absolute end-2 top-2" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={dict.common.remove}>
                <Trash2 />
              </Button>
              <NodeEditor name="" value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} depth={depth + 1} />
            </li>
          ))}
        </ol>
        {template && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, blank(template)])}>
            <Plus />
            {t.addItem}
          </Button>
        )}
      </div>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className={cn("space-y-5", depth === 0 && "")}>
        {Object.entries(value).map(([k, v]) => (
          <NodeEditor key={k} name={k} value={v} onChange={(nv) => onChange({ ...value, [k]: nv })} depth={depth + 1} />
        ))}
      </div>
    );
  }
  return null;
}

export function SectionEditor({ sectionKey, initial, publishedAt, updatedAt, dirtyVsPublished }: { sectionKey: string; initial: Json; publishedAt: string | null; updatedAt: string | null; dirtyVsPublished: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.website;
  const [value, setValue] = useState<Json>(initial);
  const [changed, setChanged] = useState(false);
  const { run, pending } = useServerAction();
  return (
    <div className="space-y-5">
      <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-2.5 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {publishedAt ? (
            <>
              {t.published}: <DateText value={publishedAt} withTime />
            </>
          ) : (
            t.unpublishedChanges
          )}
          {(changed || dirtyVsPublished) && <span className="ms-2 rounded bg-gold-100 px-1.5 py-0.5 font-semibold text-gold-700">{t.unpublishedChanges}</span>}
          {updatedAt && !changed && <span className="ms-2">· {dict.common.updated}: <DateText value={updatedAt} withTime /></span>}
        </p>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm"><Link href="/" target="_blank"><ExternalLink />{t.preview}</Link></Button>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => saveDraft(sectionKey, value), { success: t.draftSaved, onSuccess: () => setChanged(false) })}>
            <Save />
            {t.saveDraft}
          </Button>
          <Button size="sm" disabled={pending} onClick={() => run(() => publishSection(sectionKey, value), { success: t.publishedOk, onSuccess: () => setChanged(false) })}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            {t.publish}
          </Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <NodeEditor
          name={sectionKey}
          value={value}
          onChange={(v) => {
            setValue(v);
            setChanged(true);
          }}
        />
      </div>
    </div>
  );
}

export type PortfolioRow = { id: string; name: string; variety: string; is_published: boolean; is_featured: boolean; image: string | null; slug: string };

export function PortfolioManager({ rows, canEdit }: { rows: PortfolioRow[]; canEdit: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp.products;
  const { run, pending } = useServerAction();
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((p) => (
        <li key={p.id} className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", !p.is_published && "opacity-70")}>
          <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-beige">{p.image && <Image src={publicStorageUrl("products", p.image) ?? ""} alt="" fill sizes="56px" className="object-cover" />}</span>
          <div className="min-w-0 flex-1">
            <Link href={`/erp/products/${p.id}`} className="block truncate font-semibold hover:underline">{p.name}</Link>
            <p className="truncate text-xs text-muted-foreground">{p.variety}</p>
          </div>
          <Button size="icon-sm" variant="ghost" disabled={!canEdit || pending} onClick={() => run(() => setProductFlags(p.id, { is_published: !p.is_published }))} aria-label={t.published} title={t.published}>
            {p.is_published ? <Eye className="text-palm-700" /> : <EyeOff />}
          </Button>
          <Button size="icon-sm" variant="ghost" disabled={!canEdit || pending} onClick={() => run(() => setProductFlags(p.id, { is_featured: !p.is_featured }))} aria-label={t.featured} title={t.featured}>
            <Star className={p.is_featured ? "fill-gold-500 text-gold-500" : ""} />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export type InquiryRow = { id: string; created_at: string; name: string; company: string | null; phone: string | null; email: string | null; category: string; product: string | null; message: string; status: string; internal_notes: string | null; locale: string };

export function InquiriesInbox({ rows }: { rows: InquiryRow[] }) {
  const { dict } = useI18n();
  const t = dict.erp.website;
  const [openId, setOpenId] = useState<string | null>(rows.find((r) => r.status === "new")?.id ?? rows[0]?.id ?? null);
  const current = rows.find((r) => r.id === openId) ?? null;
  const [notes, setNotes] = useState(current?.internal_notes ?? "");
  const { run, pending } = useServerAction();
  if (!rows.length) return <p className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">{t.noInquiries}</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <ul className="max-h-[70vh] divide-y overflow-y-auto rounded-xl border bg-card">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => {
                setOpenId(r.id);
                setNotes(r.internal_notes ?? "");
              }}
              className={cn("w-full px-4 py-3 text-start transition-colors hover:bg-muted/50", r.id === openId && "bg-gold-100/60")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate", r.status === "new" ? "font-bold" : "font-medium")}>{r.name}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{dict.site.contact.categories[r.category as "general"]} · {r.message}</p>
              <p className="mt-1 text-[0.7rem] text-muted-foreground"><DateText value={r.created_at} withTime /></p>
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <article className="space-y-4 rounded-xl border bg-card p-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{current.name}</h3>
              {current.company && <p className="text-sm text-muted-foreground">{current.company}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{dict.site.contact.categories[current.category as "general"]}{current.product ? ` · ${current.product}` : ""} · <DateText value={current.created_at} withTime /></p>
            </div>
            <StatusBadge status={current.status} />
          </header>
          <p className="rounded-lg bg-muted/50 p-4 text-[0.95rem] leading-relaxed whitespace-pre-wrap" dir="auto">{current.message}</p>
          <div className="flex flex-wrap gap-2">
            {current.phone && <Button asChild variant="outline" size="sm"><a href={`tel:${current.phone}`}><Phone />{current.phone}</a></Button>}
            {current.phone && <Button asChild variant="outline" size="sm"><a href={`https://wa.me/${current.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><MessageCircle />WhatsApp</a></Button>}
            {current.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${current.email}`}><Mail />{current.email}</a></Button>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inq-notes" className="text-[0.82rem]">{t.internalNotes}</Label>
            <Textarea id="inq-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => updateInquiry(current.id, { internal_notes: notes }), { success: dict.common.saved })}>
              <Save />{dict.common.save}
            </Button>
            {current.status !== "in_progress" && <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => updateInquiry(current.id, { status: "in_progress", internal_notes: notes }))}>{t.markInProgress}</Button>}
            {current.status !== "closed" && <Button size="sm" disabled={pending} onClick={() => run(() => updateInquiry(current.id, { status: "closed", internal_notes: notes }))}>{t.markClosed}</Button>}
          </div>
        </article>
      )}
    </div>
  );
}
