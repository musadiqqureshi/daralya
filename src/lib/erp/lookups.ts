import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Option lists for forms. RLS decides what each user can see. */

export type CustomerOpt = { id: string; code: string; name: string; name_ar: string | null; phone: string | null; email: string | null; address: string | null; driver_id: string | null; credit_limit: number | null };
export type ProductOpt = {
  id: string;
  sku: string;
  barcode: string | null;
  name_en: string;
  name_ar: string;
  variety: string;
  grade: string | null;
  unit: string;
  weight_kg: number;
  selling_price: number;
  is_active: boolean;
};
export type NamedOpt = { id: string; name_en: string; name_ar: string };

export const getCustomers = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("id, code, name, name_ar, phone, email, address, driver_id, credit_limit").eq("is_active", true).order("name");
  return (data ?? []) as CustomerOpt[];
});

export const getSuppliers = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, code, name, name_ar, phone").eq("is_active", true).order("name");
  return (data ?? []) as { id: string; code: string; name: string; name_ar: string | null; phone: string | null }[];
});

export const getProducts = cache(async (activeOnly = true) => {
  const supabase = await createClient();
  let q = supabase.from("products").select("id, sku, barcode, name_en, name_ar, variety, grade, unit, weight_kg, selling_price, is_active").order("sort_order").order("name_en");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return (data ?? []) as ProductOpt[];
});

export const getStorages = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("storages").select("id, code, name_en, name_ar, capacity_kg, temp_min, temp_max, location, is_active").eq("is_active", true).order("name_en");
  return (data ?? []) as (NamedOpt & { code: string; capacity_kg: number | null; temp_min: number | null; temp_max: number | null; location: string | null })[];
});

export const getDrivers = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("drivers").select("id, code, name, name_ar, kind, vehicle_no, commission_type, commission_value").eq("is_active", true).order("name");
  return (data ?? []) as { id: string; code: string; name: string; name_ar: string | null; kind: string; vehicle_no: string | null; commission_type: string; commission_value: number }[];
});

export const getMoneyAccounts = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("money_accounts").select("id, name_en, name_ar, kind").eq("is_active", true).order("kind").order("name_en");
  return (data ?? []) as (NamedOpt & { kind: "cash" | "bank" })[];
});

export const getPaymentMethods = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("payment_methods").select("id, code, name_en, name_ar, requires_verification").eq("is_active", true).order("sort_order");
  return (data ?? []) as (NamedOpt & { code: string; requires_verification: boolean })[];
});

export const getExpenseCategories = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("expense_categories").select("id, name_en, name_ar").eq("is_active", true).order("sort_order");
  return (data ?? []) as NamedOpt[];
});

export const getEmployees = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("id, employee_no, full_name, full_name_ar, department, job_title, photo_path, status").eq("status", "active").order("full_name");
  return (data ?? []) as { id: string; employee_no: string; full_name: string; full_name_ar: string | null; department: string | null; job_title: string | null; photo_path: string | null; status: string }[];
});

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  return data as Record<string, unknown> & {
    company_name_en: string;
    company_name_ar: string;
    vat_enabled: boolean;
    vat_rate: number;
    vat_number: string | null;
    allow_negative_stock: boolean;
    attendance_notice_en: string;
    attendance_notice_ar: string;
  };
});

/** Lookup of user id → name for "recorded by" columns. */
export const getStaffNames = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name");
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name])) as Record<string, string>;
});
