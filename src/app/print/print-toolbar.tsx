"use client";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export function PrintToolbar({ extra }: { extra?: React.ReactNode }) {
  const { dict } = useI18n();
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
