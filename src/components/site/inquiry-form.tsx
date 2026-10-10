"use client";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitInquiry } from "@/app/(site)/contact/actions";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const field =
  "mt-1.5 w-full rounded-xl border border-palm-900/15 bg-white px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-muted-foreground/70 focus:border-gold-500 focus:ring-3 focus:ring-gold-500/20 aria-invalid:border-destructive";

export function InquiryForm({
  products,
  defaultCategory,
  defaultProduct,
}: {
  products: { slug: string; name: string }[];
  defaultCategory?: string;
  defaultProduct?: string;
}) {
  const { dict } = useI18n();
  const t = dict.site.contact;
  const [state, action, pending] = useActionState(submitInquiry, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  if (state?.ok) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-[1.5rem] border border-palm-700/20 bg-palm-50 p-8">
        <CheckCircle2 className="size-9 text-palm-700" aria-hidden />
        <p className="font-display text-3xl text-palm-900">{state.message}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="block sm:col-span-1">
        <span className="text-sm font-medium text-palm-900">{t.name}</span>
        <input name="name" required autoComplete="name" className={field} aria-invalid={!!err("name")} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-palm-900">{t.company}</span>
        <input name="company" autoComplete="organization" className={field} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-palm-900">{t.phone}</span>
        <input name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" className={cn(field, "text-start")} aria-invalid={!!err("phone")} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-palm-900">{t.email}</span>
        <input name="email" type="email" dir="ltr" autoComplete="email" className={cn(field, "text-start")} aria-invalid={!!err("email")} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-palm-900">{t.category}</span>
        <select name="category" defaultValue={defaultCategory ?? "general"} className={field}>
          {Object.entries(t.categories).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-palm-900">{t.product}</span>
        <select name="product" defaultValue={defaultProduct ?? ""} className={field}>
          <option value="">—</option>
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-palm-900">{t.message}</span>
        <textarea name="message" required rows={5} className={cn(field, "resize-y")} aria-invalid={!!err("message")} />
      </label>
      {state && !state.ok && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="flex flex-col-reverse items-start justify-between gap-4 sm:col-span-2 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">{t.privacy}</p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-palm-800 px-8 font-semibold text-cream transition-colors hover:bg-palm-700 disabled:opacity-70"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? t.sending : t.submit}
        </button>
      </div>
    </form>
  );
}
