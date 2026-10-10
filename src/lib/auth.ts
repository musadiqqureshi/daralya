import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "manager" | "accountant" | "sales" | "warehouse" | "driver";

export type Session = {
  userId: string;
  email: string | null;
  profile: { id: string; full_name: string; role: Role; is_active: boolean; locale: string; driver_id: string | null; employee_id: string | null };
  perms: Set<string>;
  can: (perm: string) => boolean;
  canAny: (...perms: string[]) => boolean;
};

/** Current staff session (null when signed out or deactivated). Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  // verified locally against the project's signing keys (fast); falls back to the Auth server if needed
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;
  const user = { id: claims.sub as string, email: (claims.email as string | undefined) ?? null };
  const [{ data: profile }, { data: perms }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, is_active, locale, driver_id, employee_id").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_permissions"),
  ]);
  if (!profile || !profile.is_active) return null;
  const set = new Set<string>((perms as string[] | null) ?? []);
  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Session["profile"],
    perms: set,
    can: (p) => set.has(p),
    canAny: (...ps) => ps.some((p) => set.has(p)),
  };
});

/** For ERP pages: signed-in staff or redirect to login. */
export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/erp/login");
  return s;
}
