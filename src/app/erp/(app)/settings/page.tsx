import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { UrlTabs } from "@/components/erp/url-tabs";
import { requireSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AttendanceSettings, CompanySettings, InvoiceSettings, ListEditor, PayrollSettings, QrSettings, ScheduleEditor, SecuritySettings, StockSettings, type QrRow, type ScheduleRow } from "./settings-ui";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!session.can("settings.manage")) return <NoAccess />;
  const dict = await getDictionary();
  const t = dict.erp.settings;
  const supabase = await createClient();
  const [{ data: s }, { data: qrs }, { data: methods }, { data: cats }, { data: schedules }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("invoice_qr_codes").select("*").order("sort_order"),
    supabase.from("payment_methods").select("id, name_en, name_ar, is_active, requires_verification").order("sort_order"),
    supabase.from("expense_categories").select("id, name_en, name_ar, is_active").order("sort_order"),
    supabase.from("work_schedules").select("id, name, start_time, end_time, break_minutes, grace_minutes, half_day_minutes, working_days, is_default, is_active").order("name"),
  ]);
  const init = (s ?? {}) as Record<string, string | number | boolean | null>;
  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} />
      <UrlTabs
        tabs={[
          { value: "company", label: t.company, content: <CompanySettings initial={init} /> },
          { value: "invoice", label: t.invoice, content: <div className="space-y-6"><InvoiceSettings initial={init} /><QrSettings rows={(qrs ?? []) as QrRow[]} /></div> },
          { value: "stock", label: t.stock, content: <StockSettings initial={init} /> },
          { value: "attendance", label: t.attendance, content: <div className="space-y-6"><AttendanceSettings initial={init} /><ScheduleEditor rows={(schedules ?? []) as ScheduleRow[]} /></div> },
          { value: "payroll", label: t.payroll, content: <PayrollSettings initial={init} /> },
          { value: "lists", label: t.lists, content: <div className="grid gap-6 xl:grid-cols-2"><ListEditor table="payment_methods" title={t.paymentMethods} rows={methods ?? []} /><ListEditor table="expense_categories" title={t.expenseCategories} rows={cats ?? []} /></div> },
          { value: "security", label: t.security, content: <SecuritySettings initial={init} /> },
        ]}
      />
    </>
  );
}
