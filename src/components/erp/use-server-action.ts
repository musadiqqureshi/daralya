"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/** Run a server action with pending state, toasts and a refresh of server data. */
export function useServerAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onSuccess?: (data?: T) => void; refresh?: boolean } = {}) =>
    new Promise<ActionResult<T>>((resolve) => {
      setError(null);
      start(async () => {
        try {
          const res = await fn();
          if (res.ok) {
            if (opts.success ?? res.message) toast.success(opts.success ?? res.message);
            opts.onSuccess?.(res.data);
            if (opts.refresh !== false) router.refresh();
          } else {
            setError(res.error);
            toast.error(res.error);
          }
          resolve(res);
        } catch (e) {
          const msg = (e as Error)?.message || "Something went wrong";
          // redirects thrown by server actions are not errors
          if (/NEXT_REDIRECT/.test(msg)) return;
          setError(msg);
          toast.error(msg);
          resolve({ ok: false, error: msg });
        }
      });
    });
  return { run, pending, error, setError };
}
