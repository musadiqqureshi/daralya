"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useI18n } from "@/lib/i18n/client";
import { useServerAction } from "./use-server-action";

/** Confirmation that requires a written reason (cancellations, corrections, reversals). */
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  success,
  destructive = true,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => Promise<ActionResult<unknown>>;
  success?: string;
  destructive?: boolean;
}) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending } = useServerAction();
  const valid = reason.trim().length >= 3;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dict.erp.forms.reasonPlaceholder} rows={3} autoFocus />
        {!valid && reason.length > 0 && <p className="text-xs text-destructive">{dict.common.reasonRequired}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {dict.common.close}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!valid || pending}
            onClick={() =>
              run(() => onConfirm(reason.trim()), {
                success,
                onSuccess: () => {
                  setOpen(false);
                  setReason("");
                },
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel ?? dict.erp.forms.confirmCancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
