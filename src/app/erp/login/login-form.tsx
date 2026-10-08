"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";
import { requestReset, signIn } from "./actions";

export function LoginForm({ next, expired, configured }: { next?: string; expired?: boolean; configured: boolean }) {
  const { dict } = useI18n();
  const t = dict.auth;
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState(signIn, null);
  const [resetState, resetAction, resetPending] = useActionState(requestReset, null);

  if (mode === "reset") {
    return (
      <form action={resetAction} className="space-y-5">
        <h2 className="font-display text-3xl font-semibold text-palm-900">{t.resetTitle}</h2>
        {resetState?.ok ? (
          <p role="status" className="rounded-lg bg-palm-50 px-4 py-3 text-sm text-palm-800">
            {resetState.message}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t.email}</Label>
              <Input id="reset-email" name="email" type="email" dir="ltr" required autoComplete="email" className="h-11" />
            </div>
            <Button type="submit" disabled={resetPending} className="h-11 w-full">
              {resetPending && <Loader2 className="animate-spin" />}
              {t.sendReset}
            </Button>
          </>
        )}
        <button type="button" onClick={() => setMode("login")} className="text-sm font-medium text-palm-700 hover:underline">
          ← {t.signIn}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next ?? ""} />
      {!configured && (
        <p role="alert" className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
          {t.notConfigured}
        </p>
      )}
      {expired && !state && (
        <p role="status" className="rounded-lg bg-gold-100 px-4 py-3 text-sm text-gold-700">
          {t.expired}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">{t.email}</Label>
        <Input id="email" name="email" type="email" dir="ltr" required autoComplete="username" className="h-11" autoFocus />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t.password}</Label>
          <button type="button" onClick={() => setMode("reset")} className="text-xs font-medium text-palm-700 hover:underline">
            {t.forgot}
          </button>
        </div>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} dir="ltr" required autoComplete="current-password" className="h-11 pe-11" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute end-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending || !configured} className="h-11 w-full text-[0.95rem]">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? t.signingIn : t.signIn}
      </Button>
    </form>
  );
}
