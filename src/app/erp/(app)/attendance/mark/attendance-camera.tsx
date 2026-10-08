"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Loader2, LogIn, LogOut, RefreshCcw, Search, ShieldCheck, SwitchCamera, UserRound } from "lucide-react";
import { toast } from "sonner";
import { markAttendance } from "@/app/erp/(app)/_actions/hr";
import { StatusBadge } from "@/components/erp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/dictionaries/en";
import { fmtTime, todayRiyadh } from "@/lib/i18n/format";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type CamEmployee = {
  id: string;
  employee_no: string;
  name: string;
  department: string | null;
  job_title: string | null;
  photo_url: string | null;
  today: { status: string; check_in_at: string | null; check_out_at: string | null } | null;
};

type CamState = "idle" | "starting" | "live" | "error";

const MAX_W = 1280;

export function AttendanceCamera({ employees, canManual, notice }: { employees: CamEmployee[]; canManual: boolean; notice: string }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.attendance;
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "out">("in");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [cam, setCam] = useState<CamState>("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [busy, setBusy] = useState<null | "upload" | "save">(null);
  const [flash, setFlash] = useState(false);
  const [last, setLast] = useState<{ name: string; action: string; time: string; status: string; photo: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualReason, setManualReason] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const emp = employees.find((e) => e.id === selected) ?? null;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => !q || e.name.toLowerCase().includes(q) || e.employee_no.toLowerCase().includes(q) || (e.department ?? "").toLowerCase().includes(q));
  }, [employees, query]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setCam("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (face: "user" | "environment" = facing) => {
      setCamError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCam("error");
        setCamError(t.cameraUnavailable);
        return;
      }
      stream.current?.getTracks().forEach((tr) => tr.stop());
      setCam("starting");
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play();
        }
        setCam("live");
      } catch (e) {
        const name = (e as Error).name;
        setCam("error");
        setCamError(name === "NotAllowedError" || name === "SecurityError" ? t.cameraDenied : name === "NotFoundError" || name === "OverconstrainedError" ? t.cameraUnavailable : t.cameraError);
      }
    },
    [facing, t.cameraDenied, t.cameraError, t.cameraUnavailable],
  );

  const deviceInfo = () => ({
    ua: navigator.userAgent.slice(0, 200),
    screen: `${window.screen.width}x${window.screen.height}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: navigator.language,
    camera: facing,
  });

  const finish = (res: Awaited<ReturnType<typeof markAttendance>>, photoUrl: string) => {
    if (!res.ok || !emp) {
      toast.error(res.ok ? dict.common.error : res.error);
      return false;
    }
    const at = String((mode === "in" ? res.data?.check_in_at : res.data?.check_out_at) ?? new Date().toISOString());
    const msg = tpl(t.success, { name: emp.name, action: mode === "in" ? t.checkedIn : t.checkedOut, time: fmtTime(at, locale) });
    toast.success(msg);
    setLast({ name: emp.name, action: mode === "in" ? t.checkedIn : t.checkedOut, time: fmtTime(at, locale), status: String(res.data?.status ?? "present"), photo: photoUrl });
    setSelected(null);
    setQuery("");
    router.refresh();
    return true;
  };

  /** Capture the live frame, store it privately, and record attendance in one step. */
  const capture = async () => {
    if (!emp || cam !== "live" || !video.current || !canvas.current) return;
    const v = video.current;
    const scale = Math.min(1, MAX_W / (v.videoWidth || MAX_W));
    const w = Math.round((v.videoWidth || 640) * scale);
    const h = Math.round((v.videoHeight || 480) * scale);
    const c = canvas.current;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    if (facing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // burn a small evidence stamp into the image (the database keeps the authoritative server time)
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(`${emp.employee_no} · ${emp.name} · ${mode === "in" ? "IN" : "OUT"} · ${new Date().toISOString()}`, 10, h - 12);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);

    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
    if (!blob) {
      toast.error(t.cameraError);
      return;
    }
    const preview = URL.createObjectURL(blob);
    setBusy("upload");
    const path = `${emp.id}/${todayRiyadh()}/${mode}-${crypto.randomUUID()}.jpg`;
    const { error } = await getBrowserClient().storage.from("attendance").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) {
      setBusy(null);
      toast.error(error.message);
      return;
    }
    setBusy("save");
    const res = await markAttendance({ employee_id: emp.id, kind: mode, photo_path: path, device: deviceInfo() });
    setBusy(null);
    finish(res, preview);
  };

  const manual = async () => {
    if (!emp || manualReason.trim().length < 3) return;
    setBusy("save");
    const res = await markAttendance({ employee_id: emp.id, kind: mode, photo_path: null, manual_reason: manualReason.trim(), device: deviceInfo() });
    setBusy(null);
    if (finish(res, "")) {
      setManualOpen(false);
      setManualReason("");
    }
  };

  const canAct = (e: CamEmployee) => (mode === "in" ? !e.today?.check_in_at : Boolean(e.today?.check_in_at) && !e.today?.check_out_at);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      {/* Step 1: mode + employee */}
      <section className="space-y-4" aria-label={t.selectEmployee}>
        <div className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-1" role="radiogroup" aria-label={t.mark}>
          {(["in", "out"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m);
                setSelected(null);
              }}
              className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors", mode === m ? (m === "in" ? "bg-palm-800 text-cream" : "bg-gold-500 text-palm-950") : "text-muted-foreground hover:text-foreground")}
            >
              {m === "in" ? <LogIn className="size-4" /> : <LogOut className="size-4" />}
              {m === "in" ? t.checkIn : t.checkOut}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchEmployee} className="h-10 bg-card ps-9" aria-label={t.searchEmployee} />
        </div>
        <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pe-1 lg:max-h-[calc(100vh-20rem)]">
          {list.map((e) => {
            const allowed = canAct(e);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={!allowed}
                  onClick={() => {
                    setSelected(e.id);
                    if (cam === "idle" || cam === "error") void start();
                  }}
                  aria-pressed={selected === e.id}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-start transition",
                    selected === e.id ? "border-gold-500 ring-2 ring-gold-500/30" : "hover:border-palm-800/30",
                    !allowed && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-palm-50">
                    {e.photo_url ? <Image src={e.photo_url} alt="" fill sizes="44px" className="object-cover" unoptimized /> : <UserRound className="absolute inset-0 m-auto size-5 text-palm-700" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{e.employee_no}{e.department ? ` · ${e.department}` : ""}</span>
                  </span>
                  {e.today && (
                    <span className="text-end text-xs">
                      <StatusBadge status={e.today.status} />
                      {e.today.check_in_at && <span className="mt-0.5 block text-muted-foreground tabular-nums">{fmtTime(e.today.check_in_at, locale)}{e.today.check_out_at ? ` – ${fmtTime(e.today.check_out_at, locale)}` : ""}</span>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">{dict.common.noResults}</li>}
        </ul>
      </section>

      {/* Step 2: live camera */}
      <section className="space-y-4" aria-label={t.openCamera}>
        <div className="relative overflow-hidden rounded-2xl bg-palm-950 ring-1 ring-black/5">
          <div className="relative aspect-[4/3] w-full">
            <video ref={video} playsInline muted className={cn("absolute inset-0 size-full object-cover", facing === "user" && "-scale-x-100", cam !== "live" && "opacity-0")} />
            {cam !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-cream">
                {cam === "starting" ? (
                  <>
                    <Loader2 className="size-8 animate-spin text-gold-300" />
                    <p>{t.cameraStarting}</p>
                  </>
                ) : cam === "error" ? (
                  <>
                    <CameraOff className="size-10 text-gold-300" />
                    <p className="max-w-sm text-sm text-cream/85">{camError}</p>
                    <Button variant="secondary" onClick={() => start()}>
                      <RefreshCcw />
                      {dict.common.tryAgain}
                    </Button>
                  </>
                ) : (
                  <>
                    <Camera className="size-10 text-gold-300" />
                    <p className="max-w-xs text-sm text-cream/75">{emp ? emp.name : t.selectEmployee}</p>
                    <Button onClick={() => start()} className="bg-gold-500 text-palm-950 hover:bg-gold-300" disabled={!emp}>
                      <Camera />
                      {t.openCamera}
                    </Button>
                  </>
                )}
              </div>
            )}
            {cam === "live" && (
              <>
                {/* framing guide */}
                <div className="pointer-events-none absolute inset-0 m-auto aspect-[3/4] h-[78%] rounded-[45%] border-2 border-dashed border-white/50" aria-hidden />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-3 text-cream">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-sm font-semibold backdrop-blur">
                    <span className="size-2 animate-pulse rounded-full bg-red-500" />
                    {emp ? emp.name : t.selectEmployee}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => {
                      const f = facing === "user" ? "environment" : "user";
                      setFacing(f);
                      void start(f);
                    }}
                    aria-label={t.switchCamera}
                  >
                    <SwitchCamera />
                  </Button>
                </div>
              </>
            )}
            {flash && <div className="absolute inset-0 bg-white" aria-hidden />}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-palm-950/60 text-cream backdrop-blur-sm">
                <Loader2 className="me-2 size-5 animate-spin" />
                {busy === "upload" ? t.uploading : dict.common.saving}
              </div>
            )}
          </div>
          <canvas ref={canvas} className="hidden" />
        </div>

        <Button
          className={cn("h-14 w-full text-base", mode === "out" && "bg-gold-500 text-palm-950 hover:bg-gold-300")}
          disabled={!emp || cam !== "live" || Boolean(busy)}
          onClick={capture}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Camera />}
          {mode === "in" ? t.capture : t.captureOut}
        </Button>

        {canManual && emp && (cam === "error" || manualOpen) && (
          <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-warning">
              <AlertTriangle className="size-4" />
              {t.manual}
            </p>
            <Textarea value={manualReason} onChange={(e) => setManualReason(e.target.value)} rows={2} placeholder={t.manualReason} aria-label={t.manualReason} />
            <p className="text-xs text-muted-foreground">{t.manualHint}</p>
            <Button variant="outline" disabled={manualReason.trim().length < 3 || Boolean(busy)} onClick={manual}>
              {busy === "save" && <Loader2 className="animate-spin" />}
              {mode === "in" ? t.checkIn : t.checkOut}
            </Button>
          </div>
        )}
        {canManual && emp && cam !== "error" && !manualOpen && (
          <button type="button" className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline" onClick={() => setManualOpen(true)}>
            {t.manual}
          </button>
        )}

        {last && (
          <div role="status" className="flex items-center gap-4 rounded-xl border border-palm-700/25 bg-palm-50 p-3">
            {last.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={last.photo} alt="" className="size-16 rounded-lg object-cover" />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-lg bg-white text-palm-700"><UserRound /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-semibold text-palm-900">
                <CheckCircle2 className="size-4 text-success" />
                {last.name}
              </p>
              <p className="text-sm text-palm-800">
                {last.action} · <span className="tabular-nums">{last.time}</span>
              </p>
            </div>
            <StatusBadge status={last.status} />
          </div>
        )}

        <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-palm-700" />
          <span><strong className="font-semibold text-foreground">{t.notice}:</strong> {notice}</span>
        </p>
      </section>
    </div>
  );
}
