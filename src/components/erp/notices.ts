import { tpl } from "@/lib/i18n/dictionaries/en";
import type { ErpDict } from "@/lib/i18n/dictionaries/erp-types";

export type Notice = { key: string; count: number; href: string; text: string };

export function buildNotices(
  counts: { pendingVerifications?: number; lowStock?: number; newInquiries?: number; pendingAdjustments?: number; pendingDeliveries?: number },
  t: ErpDict["shell"],
): Notice[] {
  const out: Notice[] = [];
  const add = (key: string, count: number | undefined, href: string, text: string) => {
    if (count) out.push({ key, count, href, text: tpl(text, { n: count }) });
  };
  add("pv", counts.pendingVerifications, "/erp/cash?tab=verify", t.pendingVerifications);
  add("pa", counts.pendingAdjustments, "/erp/inventory?tab=adjustments", t.pendingAdjustments);
  add("ls", counts.lowStock, "/erp/inventory?low=1", t.lowStock);
  add("ni", counts.newInquiries, "/erp/website?tab=inquiries", t.newInquiries);
  add("pd", counts.pendingDeliveries, "/erp/deliveries", t.pendingDeliveries);
  return out;
}
