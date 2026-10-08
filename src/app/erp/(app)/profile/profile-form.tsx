"use client";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { changeOwnPassword } from "@/app/erp/(app)/_actions/users";
import { Field } from "@/components/erp/field";
import { Section } from "@/components/erp/section";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";

export function ProfileForm() {
  const { dict } = useI18n();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const { run, pending, error } = useServerAction();
  return (
    <Section title={dict.auth.setPassword}>
      <div className="space-y-3">
        <Field label={dict.auth.newPassword} htmlFor="pw1" hint="10+"><Input id="pw1" type="password" autoComplete="new-password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label={dict.common.confirm} htmlFor="pw2"><Input id="pw2" type="password" autoComplete="new-password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={pending || pw.length < 10 || pw !== pw2} onClick={() => run(() => changeOwnPassword(pw), { success: dict.auth.passwordUpdated, onSuccess: () => { setPw(""); setPw2(""); } })}>
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {dict.auth.setPassword}
        </Button>
      </div>
    </Section>
  );
}
