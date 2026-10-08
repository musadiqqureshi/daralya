import "server-only";
import type { PaymentRow, PurchaseRow, SaleRow } from "@/components/erp/doc-tables";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

type Sb = Awaited<ReturnType<typeof createClient>>;
const nm = (r: { name?: string | null; name_ar?: string | null; name_en?: string | null } | null | undefined, locale: Locale) =>
  !r ? "—" : locale === "ar" ? r.name_ar || r.name || r.name_en || "—" : r.name || r.name_en || r.name_ar || "—";

const SALE_COLS = "id, invoice_no, sale_date, total, returned_total, paid_total, pending_total, payment_status, status, customers(name, name_ar), drivers(name, name_ar)";

export async function loadSales(supabase: Sb, locale: Locale, f: { customerId?: string; driverId?: string; from?: string; to?: string; limit?: number } = {}): Promise<SaleRow[]> {
  let q = supabase.from("sales").select(SALE_COLS).order("sale_date", { ascending: false }).order("created_at", { ascending: false }).limit(f.limit ?? 1000);
  if (f.customerId) q = q.eq("customer_id", f.customerId);
  if (f.driverId) q = q.eq("driver_id", f.driverId);
  if (f.from) q = q.gte("sale_date", f.from);
  if (f.to) q = q.lte("sale_date", f.to);
  const { data } = await q;
  return ((data ?? []) as unknown as (Omit<SaleRow, "customer" | "driver"> & { customers: { name: string; name_ar: string | null } | null; drivers: { name: string; name_ar: string | null } | null })[]).map((r) => ({
    id: r.id,
    invoice_no: r.invoice_no,
    sale_date: r.sale_date,
    total: Number(r.total),
    returned_total: Number(r.returned_total),
    paid_total: Number(r.paid_total),
    pending_total: Number(r.pending_total),
    payment_status: r.payment_status,
    status: r.status,
    customer: nm(r.customers, locale),
    driver: r.drivers ? nm(r.drivers, locale) : null,
  }));
}

export async function loadPurchases(supabase: Sb, locale: Locale, f: { supplierId?: string; from?: string; to?: string; limit?: number } = {}): Promise<PurchaseRow[]> {
  let q = supabase
    .from("purchases")
    .select("id, purchase_no, purchase_date, supplier_invoice_no, total, returned_total, paid_total, payment_status, status, suppliers(name, name_ar)")
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(f.limit ?? 1000);
  if (f.supplierId) q = q.eq("supplier_id", f.supplierId);
  if (f.from) q = q.gte("purchase_date", f.from);
  if (f.to) q = q.lte("purchase_date", f.to);
  const { data } = await q;
  return ((data ?? []) as unknown as (Omit<PurchaseRow, "supplier"> & { suppliers: { name: string; name_ar: string | null } | null })[]).map((r) => ({
    ...r,
    total: Number(r.total),
    returned_total: Number(r.returned_total),
    paid_total: Number(r.paid_total),
    supplier: nm(r.suppliers, locale),
  }));
}

const PARTY_TABLE = { customer: "customers", supplier: "suppliers", driver: "drivers", employee: "employees", investor: "investors" } as const;

export async function loadPayments(
  supabase: Sb,
  locale: Locale,
  f: { partyType?: keyof typeof PARTY_TABLE; partyId?: string; status?: string; accountId?: string; investmentId?: string; from?: string; to?: string; limit?: number } = {},
): Promise<PaymentRow[]> {
  let q = supabase
    .from("payments")
    .select("id, payment_no, payment_date, direction, purpose, party_type, party_id, amount, reference, status, proof_path, cancel_reason, payment_methods(name_en, name_ar), money_accounts(name_en, name_ar)")
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(f.limit ?? 500);
  if (f.partyType) q = q.eq("party_type", f.partyType);
  if (f.partyId) q = q.eq("party_id", f.partyId);
  if (f.status) q = q.eq("status", f.status);
  if (f.accountId) q = q.eq("money_account_id", f.accountId);
  if (f.investmentId) q = q.eq("investment_id", f.investmentId);
  if (f.from) q = q.gte("payment_date", f.from);
  if (f.to) q = q.lte("payment_date", f.to);
  const { data } = await q;
  type Raw = {
    id: string; payment_no: string; payment_date: string; direction: "in" | "out"; purpose: string; party_type: keyof typeof PARTY_TABLE; party_id: string;
    amount: number; reference: string | null; status: string; proof_path: string | null; cancel_reason: string | null;
    payment_methods: { name_en: string; name_ar: string } | null; money_accounts: { name_en: string; name_ar: string } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];

  // resolve party names per type in one query each
  const names = new Map<string, string>();
  await Promise.all(
    (Object.keys(PARTY_TABLE) as (keyof typeof PARTY_TABLE)[]).map(async (type) => {
      const ids = [...new Set(rows.filter((r) => r.party_type === type).map((r) => r.party_id))];
      if (!ids.length) return;
      const cols = type === "employee" ? "id, name:full_name, name_ar:full_name_ar" : "id, name, name_ar";
      const { data: parties } = await supabase.from(PARTY_TABLE[type]).select(cols).in("id", ids);
      for (const p of (parties ?? []) as unknown as { id: string; name: string; name_ar: string | null }[]) names.set(p.id, nm(p, locale));
    }),
  );
  // signed links for proofs (private bucket); only returned if the user may read them
  const proofPaths = rows.map((r) => r.proof_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (proofPaths.length) {
    const { data: urls } = await supabase.storage.from("documents").createSignedUrls(proofPaths, 60 * 30);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    payment_no: r.payment_no,
    payment_date: r.payment_date,
    direction: r.direction,
    purpose: r.purpose,
    party: names.get(r.party_id) ?? "—",
    amount: Number(r.amount),
    method: nm(r.payment_methods, locale),
    account: nm(r.money_accounts, locale),
    reference: r.reference,
    status: r.status,
    proof_url: r.proof_path ? signed.get(r.proof_path) ?? null : null,
    cancel_reason: r.cancel_reason,
  }));
}

export async function loadStatement(supabase: Sb, type: keyof typeof PARTY_TABLE, id: string, from: string, to: string) {
  const { data, error } = await supabase.rpc("party_statement", { p_type: type, p_id: id, p_start: from, p_end: to });
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    debit: r.debit === null ? null : Number(r.debit),
    credit: r.credit === null ? null : Number(r.credit),
    balance: Number(r.balance),
  })) as import("@/components/erp/statement-table").StatementRow[];
}

export function partyName(r: { name?: string | null; name_ar?: string | null; name_en?: string | null } | null | undefined, locale: Locale) {
  return nm(r, locale);
}
