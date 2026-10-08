import { redirect } from "next/navigation";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { DriversTable, type DriverRow } from "./drivers-ui";

export default async function DriversPage() {
  const session = await requireSession();
  if (!session.can("drivers.view")) {
    if (session.profile.driver_id) redirect(`/erp/drivers/${session.profile.driver_id}`);
    return <NoAccess />;
  }
  const dict = await getDictionary();
  const supabase = await createClient();
  const [{ data: drivers }, { data: report }] = await Promise.all([
    supabase.from("drivers").select("id, code, name, name_ar, kind, phone, vehicle_no, commission_type, commission_value, is_active").order("name"),
    session.can("commissions.view") ? supabase.rpc("report_commissions", { p_start: "2000-01-01", p_end: "2999-12-31" }) : Promise.resolve({ data: [] }),
  ]);
  const rep = new Map(((report ?? []) as { driver_id: string; earned: number; paid: number; outstanding: number }[]).map((r) => [r.driver_id, r]));
  const rows: DriverRow[] = (drivers ?? []).map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    name_ar: d.name_ar,
    kind: d.kind,
    phone: d.phone,
    vehicle_no: d.vehicle_no,
    rule: d.commission_type,
    value: Number(d.commission_value),
    earned: Number(rep.get(d.id)?.earned ?? 0),
    paid: Number(rep.get(d.id)?.paid ?? 0),
    owed: Number(rep.get(d.id)?.outstanding ?? 0),
    is_active: d.is_active,
  }));
  return (
    <>
      <PageHeader title={dict.erp.drivers.title} description={dict.erp.drivers.subtitle} />
      <DriversTable rows={rows} canManage={session.can("drivers.manage")} />
    </>
  );
}
