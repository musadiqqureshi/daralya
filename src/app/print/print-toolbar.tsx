"use client";
import { useEffect } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export function PrintToolbar({ extra, autoPrint = false }: { extra?: React.ReactNode; autoPrint?: boolean }) {
  const { dict } = useI18n();
  useEffect(() => {
    if (!autoPrint) return;
    // opened in a hidden frame by the POS: print as soon as fonts are ready, then tell the opener
    const done = () => window.parent?.postMessage({ type: "slip-printed" }, window.location.origin);
    window.addEventListener("afterprint", done, { once: true });
    void document.fonts.ready.then(() => window.print());
    return () => window.removeEventListener("afterprint", done);
  }, [autoPrint]);
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4">
      <div className="flex flex-wrap gap-2">{extra}</div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.close()}>
          <X />
          {dict.common.close}
        </Button>
        <Button onClick={() => window.print()}>
          <Printer />
          {dict.common.print} / {dict.common.savePdf}
        </Button>
      </div>
    </div>
  );
}
