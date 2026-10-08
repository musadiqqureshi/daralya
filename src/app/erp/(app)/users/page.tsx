import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { UrlTabs } from "@/components/erp/url-tabs";
import { requireSession } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { hasAdminKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NewUserDialog, RoleMatrix, UsersTable, type Perm, type UserRow } from "./users-ui";

export default async function UsersPage() {
  const session = await requireSession();
  if (!session.can("users.manage")) return <NoAccess />;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.users;
  const supabase = await createClient();
  const [{ data: profiles }, { data: overrides }, { data: perms }, { data: rolePerms }, { data: drivers }, { data: employees }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, role, is_active, driver_id, employee_id").order("full_name"),
    supabase.from("user_permissions").select("user_id, permission, granted"),
    supabase.from("permissions").select("code, module, label_en, label_ar").order("module").order("code"),
    supabase.from("role_permissions").select("role, permission"),
    supabase.from("drivers").select("id, name, name_ar").eq("is_active", true),
    supabase.from("employees").select("id, employee_no, full_name, full_name_ar").eq("status", "active"),
  ]);
  const ov = new Map<string, Record<string, boolean>>();
  for (const o of overrides ?? []) (ov.get(o.user_id) ?? ov.set(o.user_id, {}).get(o.user_id)!)[o.permission] = o.granted;
  const rows: UserRow[] = (profiles ?? []).map((p) => ({ ...p, overrides: ov.get(p.id) ?? {}, isSelf: p.id === session.userId }));
  const permList: Perm[] = (perms ?? []).map((p) => ({ code: p.code, module: p.module, label: locale === "ar" ? p.label_ar : p.label_en }));
  const roleDefaults: Record<string, string[]> = {};
  for (const rp of rolePerms ?? []) (roleDefaults[rp.role] ??= []).push(rp.permission);
  const driverOpts = (drivers ?? []).map((d) => ({ value: d.id, label: (locale === "ar" ? d.name_ar || d.name : d.name) as string }));
  const empOpts = (employees ?? []).map((e) => ({ value: e.id, label: (locale === "ar" ? e.full_name_ar || e.full_name : e.full_name) as string, sub: e.employee_no }));
  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} actions={hasAdminKey() ? <NewUserDialog drivers={driverOpts} employees={empOpts} /> : <span className="text-sm text-warning">{t.needsKey}</span>} />
      <UrlTabs
        tabs={[
          { value: "users", label: t.title, content: <UsersTable rows={rows} perms={permList} drivers={driverOpts} employees={empOpts} roleDefaults={roleDefaults} /> },
          { value: "roles", label: t.roleMatrix, content: <RoleMatrix perms={permList} roleDefaults={roleDefaults} /> },
        ]}
      />
    </>
  );
}
