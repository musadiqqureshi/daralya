"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/client";

/** Camera barcode/QR scanner (ZXing). Hardware scanners work too: they type into the search box. */
export function BarcodeScanner({ onScan, className }: { onScan: (code: string) => void; className?: string }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video.current!, (result) => {
          if (result && !cancelled) {
            cancelled = true;
            onScan(result.getText());
            setOpen(false);
          }
        });
        stop = () => controls.stop();
        setStarting(false);
      } catch (e) {
        setStarting(false);
        const name = (e as Error).name;
        setErr(name === "NotAllowedError" ? t.attendance.cameraDenied : name === "NotFoundError" ? t.attendance.cameraUnavailable : t.attendance.cameraError);
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [open, onScan, t.attendance.cameraDenied, t.attendance.cameraUnavailable, t.attendance.cameraError]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => {
          setErr(null);
          setStarting(true);
          setOpen(true);
        }}
      >
        <Camera />
        {t.sales.scan}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.sales.scan}</DialogTitle>
            <DialogDescription>{t.sales.scanHint}</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            <video ref={video} className="size-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-gold-500/80 shadow-[0_0_12px_rgba(200,164,93,.9)]" />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
                <Loader2 className="me-2 size-4 animate-spin" />
                {t.attendance.cameraStarting}
              </div>
            )}
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
