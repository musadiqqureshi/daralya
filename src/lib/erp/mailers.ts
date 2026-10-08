import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { dailyReportEmail, invoiceEmail, type DailyReport } from "@/lib/email/templates";
import { addDays, todayRiyadh } from "@/lib/i18n/format";
import { createAdminClient } from "@/lib/supabase/admin";

async function company(sb: SupabaseClient) {
  const { data } = await sb.from("settings").select("company_name_en, company_name_ar, phone, whatsapp, email, address_en, email_invoices, daily_report_enabled, daily_report_emails").eq("id", 1).single();
  return data as { company_name_en: string; company_name_ar: string; phone: string | null; whatsapp: string | null; email: string | null; address_en: string | null; email_invoices: boolean; daily_report_enabled: boolean; daily_report_emails: string | null };
}

/** Email a customer their invoice (customer-safe fields only). */
export async function mailInvoice(sb: SupabaseClient, saleId: string, opts: { sentBy?: string | null; to?: string; auto?: boolean } = {}) {
  const st = await company(sb);
  if (opts.auto && !st.email_invoices) return { ok: false, error: "disabled" };
  const { data: s } = await sb
    .from("sales")
    .select("id, invoice_no, sale_date, currency, fx_rate, subtotal, discount_amount, vat_amount, total, returned_total, paid_total, payment_status, status, customers(name, email)")
    .eq("id", saleId)
    .maybeSingle();
  if (!s) return { ok: false, error: "Invoice not found" };
  const c = s.customers as unknown as { name: string; email: string | null };
  const to = opts.to || c.email;
  if (!to) return { ok: false, error: "Customer has no email" };
  const { data: items } = await sb.from("sale_items").select("line_no, qty, unit_price, unit_price_fc, line_total, products(name_en, unit)").eq("sale_id", saleId).order("line_no");
  const { subject, html } = invoiceEmail(
    { name_en: st.company_name_en, name_ar: st.company_name_ar, phone: st.phone, whatsapp: st.whatsapp, email: st.email, address_en: st.address_en },
    {
      invoice_no: s.invoice_no,
      date: s.sale_date,
      customer: c.name,
      currency: s.currency,
      fx_rate: Number(s.fx_rate),
      lines: ((items ?? []) as unknown as { qty: number; unit_price: number; unit_price_fc: number | null; line_total: number; products: { name_en: string; unit: string } }[]).map((i) => ({
        name: i.products.name_en,
        qty: Number(i.qty),
        unit: i.products.unit,
        price_fc: i.unit_price_fc === null ? null : Number(i.unit_price_fc),
        price_sar: Number(i.unit_price),
        total_sar: Number(i.line_total),
      })),
      subtotal: Number(s.subtotal),
      discount: Number(s.discount_amount),
      vat: Number(s.vat_amount),
      total: Number(s.total) - Number(s.returned_total),
      paid: Number(s.paid_total),
      due: Math.max(Number(s.total) - Number(s.returned_total) - Number(s.paid_total), 0),
      status: s.payment_status,
    },
  );
  return sendEmail({ to, subject, html, kind: "invoice", relatedId: saleId, sentBy: opts.sentBy, replyTo: st.email ?? undefined });
}

/** End-of-day sales & stock report to owners plus configured recipients (service role). */
export async function mailDailyReport(date = todayRiyadh(), extraTo?: string[]) {
  const sb = createAdminClient();
  const st = await company(sb);
  const from = `${date}T00:00:00+03:00`;
  const to = `${addDays(date, 1)}T00:00:00+03:00`;
  const [{ data: sales }, { data: items }, { data: pays }, { data: exp }, { data: purch }, { data: products }, { data: levels }, { data: owners }] = await Promise.all([
    sb.from("sales").select("id, currency, total, returned_total").eq("sale_date", date).eq("status", "posted"),
    sb.from("sale_items").select("qty, line_total, products(name_en, unit), sales!inner(sale_date, status)").eq("sales.sale_date", date).eq("sales.status", "posted"),
    sb.from("payments").select("amount, status, direction, payment_methods(name_en)").eq("payment_date", date).eq("direction", "in").neq("status", "cancelled"),
    sb.from("expenses").select("amount, vat_amount").eq("expense_date", date).eq("status", "posted"),
    sb.from("purchases").select("total").eq("purchase_date", date).eq("status", "posted"),
    sb.from("products").select("id, name_en, unit, min_stock").eq("is_active", true).order("sort_order"),
    sb.from("v_stock_levels").select("product_id, qty"),
    sb.from("profiles").select("email").eq("role", "owner").eq("is_active", true),
  ]);
  const byProduct = new Map<string, { name: string; qty: number; unit: string; amount: number }>();
  for (const i of (items ?? []) as unknown as { qty: number; line_total: number; products: { name_en: string; unit: string } }[]) {
    const p = byProduct.get(i.products.name_en) ?? { name: i.products.name_en, qty: 0, unit: i.products.unit, amount: 0 };
    p.qty += Number(i.qty);
    p.amount += Number(i.line_total);
    byProduct.set(p.name, p);
  }
  const byCur = new Map<string, { currency: string; invoices: number; sar: number }>();
  for (const s of sales ?? []) {
    const c = byCur.get(s.currency) ?? { currency: s.currency, invoices: 0, sar: 0 };
    c.invoices += 1;
    c.sar += Number(s.total) - Number(s.returned_total);
    byCur.set(s.currency, c);
  }
  const byMethod = new Map<string, number>();
  let pending = 0;
  for (const p of (pays ?? []) as unknown as { amount: number; status: string; payment_methods: { name_en: string } }[]) {
    if (p.status === "pending_verification") pending += Number(p.amount);
    else byMethod.set(p.payment_methods.name_en, (byMethod.get(p.payment_methods.name_en) ?? 0) + Number(p.amount));
  }
  const qty = new Map<string, number>();
  for (const l of levels ?? []) qty.set(l.product_id, (qty.get(l.product_id) ?? 0) + Number(l.qty));
  const report: DailyReport = {
    date,
    invoices: (sales ?? []).length,
    salesTotal: (sales ?? []).reduce((s, x) => s + Number(x.total) - Number(x.returned_total), 0),
    byCurrency: [...byCur.values()],
    products: [...byProduct.values()].sort((a, b) => b.amount - a.amount),
    payments: [...byMethod.entries()].map(([method, amount]) => ({ method, amount })),
    pending,
    expenses: (exp ?? []).reduce((s, e) => s + Number(e.amount) + Number(e.vat_amount), 0),
    purchases: (purch ?? []).reduce((s, p) => s + Number(p.total), 0),
    stock: (products ?? []).map((p) => {
      const q = Math.round((qty.get(p.id) ?? 0) * 1000) / 1000;
      return { name: p.name_en, qty: q, unit: p.unit, min: Number(p.min_stock), low: q <= Number(p.min_stock) };
    }),
  };
  const recipients = [
    ...new Set([...(owners ?? []).map((o) => o.email).filter(Boolean), ...(st.daily_report_emails ?? "").split(/[,;\s]+/), ...(extraTo ?? [])].map((x) => (x ?? "").trim().toLowerCase()).filter((x) => /.+@.+\..+/.test(x))),
  ];
  const { subject, html } = dailyReportEmail({ name_en: st.company_name_en, name_ar: st.company_name_ar, phone: st.phone, whatsapp: st.whatsapp, email: st.email, address_en: st.address_en }, report);
  const res = await sendEmail({ to: recipients, subject, html, kind: "daily_report" });
  return { ...res, recipients: recipients.length, enabled: st.daily_report_enabled };
}

/** Delete attendance photos past retention (24 h by default). Safe to call often. */
export async function purgeAttendancePhotos() {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc("attendance_expire_photos");
  if (error) return { ok: false, error: error.message, deleted: 0 };
  const paths = (data ?? []) as string[];
  for (let i = 0; i < paths.length; i += 100) await sb.storage.from("attendance").remove(paths.slice(i, i + 100));
  return { ok: true, deleted: paths.length };
}
