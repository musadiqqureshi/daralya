import { Suspense } from "react";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getCustomers, getDrivers } from "@/lib/erp/lookups";
import { addDays, todayRiyadh } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { DeliveriesBoard, NewDeliveryDialog, type DeliveryCard } from "./deliveries-board";

export default async function DeliveriesPage() {
  const session = await requireSession();
  if (!session.canAny("deliveries.view", "deliveries.own")) return <NoAccess />;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const since = addDays(todayRiyadh(), -14);
  const { data } = await supabase
    .from("deliveries")
    .select("id, delivery_no, status, scheduled_date, address, recipient_name, notes, proof_photo_path, signature_path, delivered_at, vehicle_no, sale_id, driver_id, customers(name, name_ar, phone), drivers(name, name_ar), sales(invoice_no), delivery_events(status, at, note)")
    .or(`status.in.(pending,in_transit),scheduled_date.gte.${since}`)
    .neq("status", "cancelled")
    .order("scheduled_date")
    .limit(400);
  type Raw = Record<string, never> & {
    customers: { name: string; name_ar: string | null; phone: string | null };
    drivers: { name: string; name_ar: string | null } | null;
    sales: { invoice_no: string } | null;
    delivery_events: { status: string; at: string; note: string | null }[];
  };
  const raw = (data ?? []) as unknown as Raw[];
  const paths = raw.flatMap((r) => [r.proof_photo_path, r.signature_path]).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("documents").createSignedUrls(paths, 1800);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const nm = (r: { name: string; name_ar: string | null } | null) => (r ? (locale === "ar" ? r.name_ar || r.name : r.name) : null);
  const rows: DeliveryCard[] = raw.map((r) => ({
    id: r.id,
    delivery_no: r.delivery_no,
    status: r.status,
    scheduled_date: r.scheduled_date,
    address: r.address,
    customer: nm(r.customers) ?? "—",
    customer_phone: r.customers?.phone ?? null,
    driver_id: r.driver_id,
    driver: nm(r.drivers),
    vehicle_no: r.vehicle_no,
    sale_id: r.sale_id,
    invoice_no: r.sales?.invoice_no ?? null,
    recipient_name: r.recipient_name,
    notes: r.notes,
    proof_url: r.proof_photo_path ? signed.get(r.proof_photo_path) ?? null : null,
    signature_url: r.signature_path ? signed.get(r.signature_path) ?? null : null,
    delivered_at: r.delivered_at,
    events: [...(r.delivery_events ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
  }));
  const canManage = session.can("deliveries.manage");
  const [customers, drivers] = canManage ? await Promise.all([getCustomers(), getDrivers()]) : [[], []];
  const driverOpts = drivers.map((d) => ({ value: d.id, label: locale === "ar" ? d.name_ar || d.name : d.name, sub: d.vehicle_no ?? undefined }));
  return (
    <>
      <PageHeader
        title={dict.erp.deliveries.title}
        description={dict.erp.deliveries.subtitle}
        actions={canManage && <NewDeliveryDialog customers={customers.map((c) => ({ value: c.id, label: locale === "ar" ? c.name_ar || c.name : c.name, sub: c.phone ?? undefined, address: c.address }))} drivers={driverOpts} />}
      />
      <Suspense>
        <DeliveriesBoard rows={rows} drivers={driverOpts} canManage={canManage} />
      </Suspense>
    </>
  );
}
