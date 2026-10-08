"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Eraser, Loader2, MapPin, Plus, Truck, XCircle } from "lucide-react";
import { createDelivery, updateDelivery } from "@/app/erp/(app)/_actions/logistics";
import { EntitySelect, type Option } from "@/components/erp/entity-select";
import { Field } from "@/components/erp/field";
import { DateText } from "@/components/erp/money";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { todayRiyadh } from "@/lib/i18n/format";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type DeliveryCard = {
  id: string;
  delivery_no: string;
  status: "pending" | "in_transit" | "delivered" | "failed" | "cancelled";
  scheduled_date: string;
  address: string | null;
  customer: string;
  customer_phone: string | null;
  driver_id: string | null;
  driver: string | null;
  vehicle_no: string | null;
  sale_id: string | null;
  invoice_no: string | null;
  recipient_name: string | null;
  notes: string | null;
  proof_url: string | null;
  signature_url: string | null;
  delivered_at: string | null;
  events: { status: string; at: string; note: string | null }[];
};

const COLUMNS = ["pending", "in_transit", "delivered", "failed"] as const;

async function uploadBlob(blob: Blob, ext: string) {
  const path = `deliveries/${todayRiyadh()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getBrowserClient().storage.from("documents").upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}

function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const { dict } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#173d32";
  }, []);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) ref.current!.toBlob((b) => onChange(b), "image/png");
  };
  return (
    <div>
      <canvas
        ref={ref}
        className="h-36 w-full touch-none rounded-lg border-2 border-dashed border-palm-900/20 bg-white"
        aria-label={dict.erp.deliveries.signHere}
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = ref.current!.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={finish}
        onPointerLeave={finish}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{dict.erp.deliveries.signHere}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => {
            const c = ref.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            dirty.current = false;
            onChange(null);
          }}
        >
          <Eraser className="size-3" />
          {dict.erp.deliveries.clearSignature}
        </button>
      </div>
    </div>
  );
}

function DeliveryDetail({ d, drivers, canManage, onClose }: { d: DeliveryCard; drivers: Option[]; canManage: boolean; onClose: () => void }) {
  const { dict } = useI18n();
  const t = dict.erp.deliveries;
  const { run, pending, error, setError } = useServerAction();
  const [recipient, setRecipient] = useState(d.recipient_name ?? "");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [sig, setSig] = useState<Blob | null>(null);
  const [driver, setDriver] = useState<string | null>(d.driver_id);
  const [busy, setBusy] = useState(false);
  const open = d.status === "pending" || d.status === "in_transit" || d.status === "failed";

  const submit = async (status: DeliveryCard["status"]) => {
    setError(null);
    let proof_photo_path: string | undefined;
    let signature_path: string | undefined;
    if (status === "delivered") {
      if (!photo && !sig && !d.proof_url && !d.signature_url) {
        setError(t.needProof);
        return;
      }
      try {
        setBusy(true);
        if (photo) proof_photo_path = await uploadBlob(photo, (photo.name.split(".").pop() || "jpg").toLowerCase());
        if (sig) signature_path = await uploadBlob(sig, "png");
      } catch (e) {
        setBusy(false);
        setError((e as Error).message);
        return;
      }
      setBusy(false);
    }
    void run(() => updateDelivery(d.id, { status, note, recipient_name: recipient, proof_photo_path, signature_path, ...(canManage && driver !== d.driver_id ? { driver_id: driver } : {}) }), {
      success: t.updated,
      onSuccess: onClose,
    });
  };

  return (
    <div className="space-y-5 px-4 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={d.status} />
        <span className="text-sm text-muted-foreground">{t.scheduled}: <DateText value={d.scheduled_date} /></span>
      </div>
      <dl className="grid gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{dict.erp.fields.customer}</dt><dd className="font-semibold">{d.customer} {d.customer_phone && <a href={`tel:${d.customer_phone}`} dir="ltr" className="ms-2 font-normal text-palm-700">{d.customer_phone}</a>}</dd></div>
        {d.address && (
          <div>
            <dt className="text-xs text-muted-foreground">{dict.common.address}</dt>
            <dd><a href={`https://maps.google.com/?q=${encodeURIComponent(d.address)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline"><MapPin className="size-3.5" />{d.address}</a></dd>
          </div>
        )}
        {d.invoice_no && <div><dt className="text-xs text-muted-foreground">{dict.erp.fields.invoiceNo}</dt><dd><Link href={`/erp/sales/${d.sale_id}`} className="font-mono font-semibold hover:underline">{d.invoice_no}</Link></dd></div>}
        {d.notes && <div><dt className="text-xs text-muted-foreground">{dict.common.notes}</dt><dd>{d.notes}</dd></div>}
      </dl>

      {canManage && open && (
        <Field label={dict.erp.fields.driver}>
          <EntitySelect options={drivers} value={driver} onChange={setDriver} clearable />
        </Field>
      )}

      {(d.proof_url || d.signature_url) && (
        <div className="grid grid-cols-2 gap-3">
          {d.proof_url && (
            <a href={d.proof_url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.proof_url} alt={t.proofPhoto} className="aspect-square w-full object-cover" />
            </a>
          )}
          {d.signature_url && (
            <div className="overflow-hidden rounded-lg border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.signature_url} alt={t.signature} className="w-full" />
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <Field label={t.recipient} htmlFor="dl-rec">
            <Input id="dl-rec" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </Field>
          <div>
            <p className="mb-1.5 text-[0.82rem] font-medium">{t.proofPhoto}</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted">
              <Camera className="size-4" />
              <span className="truncate">{photo ? photo.name : dict.erp.forms.uploadFile}</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div>
            <p className="mb-1.5 text-[0.82rem] font-medium">{t.signature}</p>
            <SignaturePad onChange={setSig} />
          </div>
          <Field label={dict.common.notes} htmlFor="dl-note">
            <Textarea id="dl-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {d.status !== "in_transit" && (
              <Button variant="outline" disabled={pending || busy} onClick={() => submit("in_transit")}>
                <Truck />
                {t.markInTransit}
              </Button>
            )}
            <Button disabled={pending || busy} onClick={() => submit("delivered")}>
              {pending || busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {t.markDelivered}
            </Button>
            <Button variant="ghost" className="text-destructive" disabled={pending || busy} onClick={() => submit("failed")}>
              <XCircle />
              {t.markFailed}
            </Button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{t.history}</p>
        <ol className="space-y-2 text-sm">
          {d.events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" />
              <span>
                <StatusBadge status={e.status} /> <DateText value={e.at} withTime className="text-muted-foreground" />
                {e.note && <span className="block text-muted-foreground">{e.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function NewDeliveryDialog({ customers, drivers }: { customers: (Option & { address: string | null })[]; drivers: Option[] }) {
  const { dict } = useI18n();
  const t = dict.erp.deliveries;
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<string | null>(null);
  const [driver, setDriver] = useState<string | null>(null);
  const [date, setDate] = useState(todayRiyadh());
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const { run, pending, error } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus />{t.new}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.new}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={dict.erp.fields.customer} required className="sm:col-span-2">
            <EntitySelect options={customers} value={customer} onChange={(v) => { setCustomer(v); setAddress(customers.find((c) => c.value === v)?.address ?? ""); }} />
          </Field>
          <Field label={dict.erp.fields.driver}><EntitySelect options={drivers} value={driver} onChange={setDriver} clearable /></Field>
          <Field label={t.scheduled} htmlFor="nd-date"><Input id="nd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={dict.common.address} htmlFor="nd-addr" className="sm:col-span-2"><Input id="nd-addr" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          <Field label={dict.common.notes} htmlFor="nd-notes" className="sm:col-span-2"><Textarea id="nd-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={!customer || pending} onClick={() => run(() => createDelivery({ customer_id: customer!, driver_id: driver, scheduled_date: date, address, notes }), { success: t.updated, onSuccess: () => setOpen(false) })}>
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeliveriesBoard({ rows, drivers, canManage }: { rows: DeliveryCard[]; drivers: Option[]; canManage: boolean }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const openId = sp.get("open");
  const current = rows.find((r) => r.id === openId) ?? null;
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (id) next.set("open", id);
    else next.delete("open");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const today = todayRiyadh();
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = rows.filter((r) => r.status === col);
          return (
            <section key={col} className="flex min-h-40 flex-col rounded-xl border bg-muted/40" aria-label={t.status[col]}>
              <header className="flex items-center justify-between px-3 py-2.5">
                <StatusBadge status={col} />
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">{items.length}</span>
              </header>
              <ul className="flex-1 space-y-2 px-2 pb-2">
                {items.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(d.id)}
                      className={cn(
                        "w-full rounded-lg border bg-card p-3 text-start shadow-xs transition hover:border-gold-500/60",
                        col !== "delivered" && d.scheduled_date < today && "border-s-4 border-s-destructive",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs font-semibold">{d.delivery_no}</span>
                        <span className="text-xs text-muted-foreground"><DateText value={d.scheduled_date} /></span>
                      </div>
                      <p className="mt-1 font-semibold text-palm-900">{d.customer}</p>
                      {d.address && <p className="line-clamp-1 text-xs text-muted-foreground">{d.address}</p>}
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Truck className="size-3.5" />
                        {d.driver ?? "—"}
                        {d.invoice_no && <span className="ms-auto font-mono">{d.invoice_no}</span>}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <Sheet open={Boolean(current)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {current && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{current.delivery_no}</SheetTitle>
              </SheetHeader>
              <DeliveryDetail d={current} drivers={drivers} canManage={canManage} onClose={() => setOpen(null)} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
