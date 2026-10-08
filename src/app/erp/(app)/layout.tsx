import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/erp/app-sidebar";
import { buildNotices } from "@/components/erp/notices";
import { SessionTimeoutSync } from "@/components/erp/session-timeout-sync";
import { Topbar } from "@/components/erp/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "ERP", template: "%s · ERP" }, robots: { index: false, follow: false } };

async function count(q: PromiseLike<{ count: number | null }>) {
  try {
    return (await q).count ?? 0;
  } catch {
    return 0;
  }
}

export default async function ErpLayout({ children }: LayoutProps<"/erp">) {
  const session = await requireSession();
  const supabase = await createClient();
  const dict = await getDictionary();
  const can = session.can;
  const head = { count: "exact" as const, head: true };

  const [pendingVerifications, lowStock, newInquiries, pendingAdjustments, pendingDeliveries, settings] = await Promise.all([
    can("payments.verify") ? count(supabase.from("payments").select("id", head).eq("status", "pending_verification")) : 0,
    can("inventory.view") ? count(supabase.from("v_product_stock").select("product_id", head).eq("is_active", true).eq("is_low", true)) : 0,
    can("inquiries.view") ? count(supabase.from("contact_inquiries").select("id", head).eq("status", "new")) : 0,
    can("inventory.adjust_approve") ? count(supabase.from("stock_adjustments").select("id", head).eq("status", "pending")) : 0,
    session.canAny("deliveries.view", "deliveries.own") ? count(supabase.from("deliveries").select("id", head).in("status", ["pending", "in_transit"])) : 0,
    supabase.from("settings").select("session_timeout_minutes").eq("id", 1).maybeSingle(),
  ]);
  const notices = buildNotices({ pendingVerifications, lowStock, newInquiries, pendingAdjustments, pendingDeliveries }, dict.erp.shell);
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const currentTimeout = Number(cookieStore.get("erp_timeout_min")?.value) || null;
  const perms = [...session.perms];

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        perms={perms}
        badges={{ cash: pendingVerifications || undefined, inventory: (pendingAdjustments + lowStock) || undefined, website: newInquiries || undefined, deliveries: pendingDeliveries || undefined }}
      />
      <SidebarInset className="min-w-0 bg-background">
        <Topbar perms={perms} user={{ name: session.profile.full_name, role: session.profile.role }} notices={notices} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </SidebarInset>
      <SessionTimeoutSync minutes={settings.data?.session_timeout_minutes ?? 120} current={currentTimeout} />
    </SidebarProvider>
  );
}
