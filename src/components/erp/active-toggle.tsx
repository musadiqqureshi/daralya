"use client";
import { Power } from "lucide-react";
import { setPartyActive } from "@/app/erp/(app)/_actions/parties";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { useServerAction } from "./use-server-action";

export function ActiveToggle({ kind, id, active }: { kind: "customer" | "supplier" | "driver"; id: string; active: boolean }) {
  const { dict } = useI18n();
  const { run, pending } = useServerAction();
  return (
    <Button
      variant={active ? "outline" : "default"}
      size="sm"
      className="w-full"
      disabled={pending}
      onClick={() => run(() => setPartyActive(kind, id, !active), { success: dict.common.saved })}
    >
      <Power />
      {active ? dict.common.deactivate : dict.common.activate}
    </Button>
  );
}
