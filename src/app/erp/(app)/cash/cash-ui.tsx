"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeftRight, Banknote, Landmark, Loader2, Lock, Pencil, Plus } from "lucide-react";
import { closeCash, saveAccount, transferMoney } from "@/app/erp/(app)/_actions/finance";
import { Field, nativeSelect } from "@/components/erp/field";
import { Money } from "@/components/erp/money";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/client";
import { fmtMoney, todayRiyadh } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export type AccountRow = { id: string; name_en: string; name_ar: string; kind: "cash" | "bank"; bank_name: string | null; account_no: string | null; iban: string | null; is_active: boolean; balance: number; pending: number };

export function AccountCards({ rows, canManage }: { rows: AccountRow[]; canManage: boolean }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.cash;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((a) => (
        <li key={a.id} className={cn("relative rounded-xl border p-5", a.kind === "cash" ? "bg-card" : "bg-palm-900 text-cream", !a.is_active && "opacity-60")}>
          <div className="flex items-start justify-between gap-2">
            <span className={cn("flex size-9 items-center justify-center rounded-lg", a.kind === "cash" ? "bg-palm-50 text-palm-700" : "bg-white/10 text-gold-300")}>
              {a.kind === "cash" ? <Banknote className="size-4" /> : <Landmark className="size-4" />}
            </span>
            {canManage && <AccountDialog initial={a} trigger={<Button variant="ghost" size="icon-sm" aria-label={dict.common.edit} className={a.kind === "bank" ? "text-cream hover:bg-white/10 hover:text-cream" : ""}><Pencil /></Button>} />}
          </div>
          <Link href={`/erp/cash/accounts/${a.id}`} className="mt-4 block after:absolute after:inset-0">
            <p className={cn("text-sm", a.kind === "cash" ? "text-muted-foreground" : "text-cream/70")}>{locale === "ar" ? a.name_ar : a.name_en}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums" dir="ltr">{fmtMoney(a.balance, locale)}</p>
            {a.kind === "bank" && (a.bank_name || a.iban) && <p className="mt-1 truncate text-xs text-cream/60" dir="ltr">{[a.bank_name, a.iban || a.account_no].filter(Boolean).join(" · ")}</p>}
            {a.pending > 0 && <p className={cn("mt-2 text-xs font-medium", a.kind === "cash" ? "text-gold-700" : "text-gold-300")}>+ {fmtMoney(a.pending, locale)} {t.verifyQueue}</p>}
          </Link>
        </li>
      ))}
      {canManage && (
        <li>
          <AccountDialog
            trigger={
              <button type="button" className="flex h-full min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-medium text-muted-foreground transition hover:border-gold-500 hover:text-foreground">
                <Plus className="size-5" />
                {t.newAccount}
              </button>
            }
          />
        </li>
      )}
    </ul>
  );
}

export function AccountDialog({ initial, trigger }: { initial?: AccountRow; trigger: React.ReactNode }) {
  const { dict } = useI18n();
  const t = dict.erp.cash;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string | boolean>>({});
  const { run, pending, error } = useServerAction();
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setV({ name_en: initial?.name_en ?? "", name_ar: initial?.name_ar ?? "", kind: initial?.kind ?? "cash", bank_name: initial?.bank_name ?? "", account_no: initial?.account_no ?? "", iban: initial?.iban ?? "", opening_balance: "", opening_date: todayRiyadh(), is_active: initial?.is_active ?? true });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? t.editAccount : t.newAccount}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={dict.erp.products.nameEn} htmlFor="ac-en" required><Input id="ac-en" value={String(v.name_en ?? "")} onChange={s("name_en")} /></Field>
          <Field label={dict.erp.products.nameAr} htmlFor="ac-ar" required><Input id="ac-ar" dir="rtl" value={String(v.name_ar ?? "")} onChange={s("name_ar")} /></Field>
          <Field label={dict.common.type} htmlFor="ac-kind">
            <select id="ac-kind" className={nativeSelect} value={String(v.kind)} onChange={s("kind")} disabled={Boolean(initial)}>
              <option value="cash">{t.kinds.cash}</option>
              <option value="bank">{t.kinds.bank}</option>
            </select>
          </Field>
          {v.kind === "bank" && (
            <>
              <Field label={t.bankName} htmlFor="ac-bank"><Input id="ac-bank" value={String(v.bank_name ?? "")} onChange={s("bank_name")} /></Field>
              <Field label={t.accountNo} htmlFor="ac-no"><Input id="ac-no" dir="ltr" value={String(v.account_no ?? "")} onChange={s("account_no")} /></Field>
              <Field label={t.iban} htmlFor="ac-iban"><Input id="ac-iban" dir="ltr" value={String(v.iban ?? "")} onChange={s("iban")} /></Field>
            </>
          )}
          {!initial && (
            <>
              <Field label={dict.erp.fields.openingBalance} htmlFor="ac-ob"><Input id="ac-ob" type="number" step="0.01" value={String(v.opening_balance ?? "")} onChange={s("opening_balance")} /></Field>
              <Field label={dict.common.date} htmlFor="ac-od"><Input id="ac-od" type="date" value={String(v.opening_date ?? "")} onChange={s("opening_date")} /></Field>
            </>
          )}
          {initial && (
            <label className="flex items-center gap-2 text-sm"><Switch checked={Boolean(v.is_active)} onCheckedChange={(c) => setV((x) => ({ ...x, is_active: c }))} />{dict.common.active}</label>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  saveAccount({
                    id: initial?.id,
                    name_en: String(v.name_en),
                    name_ar: String(v.name_ar),
                    kind: v.kind as "cash" | "bank",
                    bank_name: String(v.bank_name ?? ""),
                    account_no: String(v.account_no ?? ""),
                    iban: String(v.iban ?? ""),
                    opening_balance: Number(v.opening_balance) || 0,
                    opening_date: initial ? undefined : String(v.opening_date),
                    is_active: Boolean(v.is_active),
                  }),
                { success: dict.common.saved, onSuccess: () => setOpen(false) },
              )
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Acc = { id: string; name_en: string; name_ar: string; kind: "cash" | "bank"; balance: number };

export function TransferMoneyDialog({ accounts }: { accounts: Acc[] }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.cash;
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayRiyadh());
  const [ref, setRef] = useState("");
  const { run, pending, error } = useServerAction();
  const name = (a: Acc) => `${locale === "ar" ? a.name_ar : a.name_en} · ${fmtMoney(a.balance, locale)}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={accounts.length < 2}><ArrowLeftRight />{t.transfer}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.transfer}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={dict.common.from} htmlFor="mt-from"><select id="mt-from" className={nativeSelect} value={from} onChange={(e) => setFrom(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{name(a)}</option>)}</select></Field>
          <Field label={dict.common.to} htmlFor="mt-to"><select id="mt-to" className={nativeSelect} value={to} onChange={(e) => setTo(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id} disabled={a.id === from}>{name(a)}</option>)}</select></Field>
          <Field label={dict.common.amount} htmlFor="mt-amt" required><Input id="mt-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label={dict.common.date} htmlFor="mt-date"><Input id="mt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={dict.common.reference} htmlFor="mt-ref" className="sm:col-span-2"><Input id="mt-ref" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={pending || !(Number(amount) > 0) || from === to} onClick={() => run(() => transferMoney({ from_account_id: from, to_account_id: to, amount, date, reference: ref }), { success: t.transferSaved, onSuccess: () => { setOpen(false); setAmount(""); } })}>
            {pending && <Loader2 className="animate-spin" />}
            {t.transfer}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CashClosingDialog({ accounts }: { accounts: Acc[] }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.cash;
  const cash = accounts.filter((a) => a.kind === "cash");
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(cash[0]?.id ?? "");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayRiyadh());
  const { run, pending, error } = useServerAction();
  const expected = cash.find((a) => a.id === account)?.balance ?? 0;
  const diff = counted === "" ? 0 : Math.round((Number(counted) - expected) * 100) / 100;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!cash.length}><Lock />{t.closing}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.closing}</DialogTitle>
          <DialogDescription>{date === todayRiyadh() ? null : null}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={dict.erp.fields.account} htmlFor="cc-acc"><select id="cc-acc" className={nativeSelect} value={account} onChange={(e) => setAccount(e.target.value)}>{cash.map((a) => <option key={a.id} value={a.id}>{locale === "ar" ? a.name_ar : a.name_en}</option>)}</select></Field>
          <Field label={dict.common.date} htmlFor="cc-date"><Input id="cc-date" type="date" value={date} max={todayRiyadh()} onChange={(e) => setDate(e.target.value)} /></Field>
          <div className="rounded-lg bg-muted/60 p-3 text-sm"><p className="text-muted-foreground">{t.expected}</p><p className="text-lg font-semibold"><Money value={expected} /></p></div>
          <Field label={t.counted} htmlFor="cc-count" required><Input id="cc-count" type="number" min="0" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} className="h-11 text-lg" /></Field>
          {counted !== "" && (
            <p className={cn("rounded-lg px-3 py-2 text-sm font-semibold sm:col-span-2", diff === 0 ? "bg-palm-50 text-palm-700" : "bg-warning/10 text-warning")}>
              {t.difference}: <Money value={diff} />
            </p>
          )}
          <Field label={dict.common.notes} htmlFor="cc-notes" className="sm:col-span-2" required={diff !== 0}><Input id="cc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={pending || counted === "" || (diff !== 0 && notes.trim().length < 3)} onClick={() => run(() => closeCash(account, date, Number(counted), notes), { success: t.closingSaved, onSuccess: () => { setOpen(false); setCounted(""); setNotes(""); } })}>
            {pending && <Loader2 className="animate-spin" />}
            {dict.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
