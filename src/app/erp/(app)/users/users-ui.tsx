"use client";
import { Fragment, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { createUser, resetPassword, setUserPermission, updateUser } from "@/app/erp/(app)/_actions/users";
import { DataTable, type Col } from "@/components/erp/data-table";
import { EntitySelect, type Option } from "@/components/erp/entity-select";
import { Field, nativeSelect } from "@/components/erp/field";
import { StatusBadge } from "@/components/erp/status-badge";
import { useServerAction } from "@/components/erp/use-server-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ROLES = ["owner", "manager", "accountant", "sales", "warehouse", "driver"] as const;
type Role = (typeof ROLES)[number];

export type UserRow = { id: string; full_name: string; email: string | null; phone: string | null; role: Role; is_active: boolean; driver_id: string | null; employee_id: string | null; overrides: Record<string, boolean>; isSelf: boolean };
export type Perm = { code: string; module: string; label: string };

function PasswordReveal({ password }: { password: string }) {
  const { dict } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border border-gold-500/40 bg-gold-100/40 p-3">
      <p className="text-xs text-muted-foreground">{dict.erp.users.tempPasswordHint}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-card px-3 py-2 font-mono text-sm" dir="ltr">{password}</code>
        <Button size="icon-sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(password); setCopied(true); }} aria-label={dict.common.copy}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

export function NewUserDialog({ drivers, employees }: { drivers: Option[]; employees: Option[] }) {
  const { dict } = useI18n();
  const t = dict.erp.users;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<{ full_name: string; email: string; role: Role; phone: string; driver_id: string | null; employee_id: string | null }>({ full_name: "", email: "", role: "sales", phone: "", driver_id: null, employee_id: null });
  const [password, setPassword] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { run, pending, error } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPassword(null); setDone(false); } }}>
      <DialogTrigger asChild><Button><Plus />{t.new}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.new}</DialogTitle></DialogHeader>
        {done ? (
          password ? <PasswordReveal password={password} /> : <p className="rounded-lg bg-palm-50 px-3 py-3 text-sm text-palm-800">{t.emailedCredentials}: <b dir="ltr">{v.email}</b></p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={dict.common.name} htmlFor="us-n" required><Input id="us-n" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></Field>
            <Field label={dict.common.email} htmlFor="us-e" required><Input id="us-e" type="email" dir="ltr" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
            <Field label={dict.erp.fields.role} htmlFor="us-r">
              <select id="us-r" className={nativeSelect} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{dict.roles[r]}</option>)}</select>
            </Field>
            <Field label={dict.common.phone} htmlFor="us-p"><Input id="us-p" dir="ltr" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
            {v.role === "driver" && <Field label={t.linkDriver} className="sm:col-span-2"><EntitySelect options={drivers} value={v.driver_id} onChange={(d) => setV({ ...v, driver_id: d })} /></Field>}
            <Field label={t.linkEmployee} className="sm:col-span-2"><EntitySelect options={employees} value={v.employee_id} onChange={(d) => setV({ ...v, employee_id: d })} clearable /></Field>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {done ? (
            <Button onClick={() => setOpen(false)}>{dict.common.close}</Button>
          ) : (
            <Button disabled={pending || v.full_name.length < 2 || !v.email} onClick={() => run(() => createUser(v), { onSuccess: (d) => { setDone(true); setPassword(d?.password ?? null); } })}>
              {pending && <Loader2 className="animate-spin" />}
              {dict.common.create}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserSheet({ user, perms, drivers, employees, roleDefaults }: { user: UserRow; perms: Perm[]; drivers: Option[]; employees: Option[]; roleDefaults: Record<string, string[]> }) {
  const { dict, locale } = useI18n();
  const t = dict.erp.users;
  const [v, setV] = useState({ full_name: user.full_name, role: user.role, is_active: user.is_active, phone: user.phone, driver_id: user.driver_id, employee_id: user.employee_id });
  const [password, setPassword] = useState<string | null>(null);
  const { run, pending, error } = useServerAction();
  const modules = [...new Set(perms.map((p) => p.module))];
  const defaults = new Set(v.role === "owner" ? perms.map((p) => p.code) : roleDefaults[v.role] ?? []);
  return (
    <Sheet>
      <SheetTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={dict.common.edit}><Pencil /></Button></SheetTrigger>
      <SheetContent side={locale === "ar" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{user.full_name}</SheetTitle>
          <SheetDescription dir="ltr" className="text-start">{user.email}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={dict.common.name} htmlFor="ue-n"><Input id="ue-n" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></Field>
            <Field label={dict.erp.fields.role} htmlFor="ue-r">
              <select id="ue-r" className={nativeSelect} value={v.role} disabled={user.isSelf} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{dict.roles[r]}</option>)}</select>
            </Field>
            <Field label={dict.common.phone} htmlFor="ue-p"><Input id="ue-p" dir="ltr" value={v.phone ?? ""} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><Switch checked={v.is_active} disabled={user.isSelf} onCheckedChange={(c) => setV({ ...v, is_active: c })} />{dict.common.active}</label>
            <Field label={t.linkDriver}><EntitySelect options={drivers} value={v.driver_id} onChange={(d) => setV({ ...v, driver_id: d })} clearable /></Field>
            <Field label={t.linkEmployee}><EntitySelect options={employees} value={v.employee_id} onChange={(d) => setV({ ...v, employee_id: d })} clearable /></Field>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => run(() => updateUser(user.id, v), { success: dict.common.saved })}>{pending && <Loader2 className="animate-spin" />}{dict.common.saveChanges}</Button>
            <Button variant="outline" disabled={pending} onClick={() => run(() => resetPassword(user.id), { onSuccess: (d) => setPassword(d?.password ?? null) })}><KeyRound />{t.resetPassword}</Button>
          </div>
          {password && <PasswordReveal password={password} />}

          {v.role !== "owner" && (
            <section>
              <h3 className="mb-1 text-sm font-semibold">{t.overrides}</h3>
              <p className="mb-3 text-xs text-muted-foreground">{t.inherit} = {dict.roles[v.role]}</p>
              <div className="space-y-4">
                {modules.map((m) => (
                  <div key={m} className="rounded-lg border">
                    <p className="border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold tracking-wide uppercase">{m}</p>
                    <ul className="divide-y">
                      {perms.filter((p) => p.module === m).map((p) => {
                        const o = user.overrides[p.code];
                        const mode = o === undefined ? "inherit" : o ? "grant" : "deny";
                        const effective = o === undefined ? defaults.has(p.code) : o;
                        return (
                          <li key={p.code} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span className="flex items-center gap-2">
                              {effective ? <Check className="size-3.5 text-success" /> : <X className="size-3.5 text-muted-foreground" />}
                              {p.label}
                            </span>
                            <div className="inline-flex rounded-md border p-0.5 text-[0.7rem]">
                              {(["inherit", "grant", "deny"] as const).map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  disabled={pending}
                                  onClick={() => run(() => setUserPermission(user.id, p.code, k))}
                                  className={cn("rounded px-2 py-0.5 font-medium", mode === k ? (k === "deny" ? "bg-destructive text-white" : k === "grant" ? "bg-palm-800 text-cream" : "bg-muted text-foreground") : "text-muted-foreground hover:text-foreground")}
                                >
                                  {k === "inherit" ? t.inherit : k === "grant" ? t.grant : t.deny}
                                </button>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UsersTable({ rows, perms, drivers, employees, roleDefaults }: { rows: UserRow[]; perms: Perm[]; drivers: Option[]; employees: Option[]; roleDefaults: Record<string, string[]> }) {
  const { dict } = useI18n();
  const cols: Col<UserRow>[] = [
    { id: "name", header: dict.common.name, value: (r) => `${r.full_name} ${r.email ?? ""}`, cell: (r) => <div><p className="font-semibold">{r.full_name}{r.isSelf && <span className="ms-2 text-xs font-normal text-muted-foreground">({dict.erp.users.you})</span>}</p><p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p></div> },
    { id: "role", header: dict.erp.fields.role, value: (r) => r.role, cell: (r) => <span className="inline-flex items-center gap-1.5">{r.role === "owner" && <ShieldCheck className="size-3.5 text-gold-700" />}{dict.roles[r.role]}</span> },
    { id: "ov", header: dict.erp.users.overrides, value: (r) => Object.keys(r.overrides).length, cell: (r) => (Object.keys(r.overrides).length ? <span className="rounded bg-gold-100 px-1.5 text-xs font-semibold text-gold-700">{Object.keys(r.overrides).length}</span> : "—"), align: "center", hideBelow: "md" },
    { id: "status", header: dict.common.status, value: (r) => (r.is_active ? 1 : 0), cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} />, align: "center" },
    { id: "act", header: "", cell: (r) => <EditUserSheet user={r} perms={perms} drivers={drivers} employees={employees} roleDefaults={roleDefaults} />, align: "end" },
  ];
  return <DataTable rows={rows} columns={cols} />;
}

export function RoleMatrix({ perms, roleDefaults }: { perms: Perm[]; roleDefaults: Record<string, string[]> }) {
  const { dict } = useI18n();
  const modules = [...new Set(perms.map((p) => p.module))];
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="sticky top-0 border-b bg-muted/60 text-xs">
          <tr>
            <th className="px-3 py-2 text-start font-semibold">{dict.erp.audit.table}</th>
            {ROLES.map((r) => <th key={r} className="px-2 py-2 text-center font-semibold">{dict.roles[r]}</th>)}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <Fragment key={m}>
              <tr className="bg-muted/30"><td colSpan={ROLES.length + 1} className="px-3 py-1 text-[0.7rem] font-bold tracking-wide uppercase text-muted-foreground">{m}</td></tr>
              {perms.filter((p) => p.module === m).map((p) => (
                <tr key={p.code} className="border-t">
                  <td className="px-3 py-1.5">{p.label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 py-1.5 text-center">
                      {r === "owner" || roleDefaults[r]?.includes(p.code) ? <Check className="mx-auto size-4 text-success" aria-label="yes" /> : <span className="text-muted-foreground/40">·</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
