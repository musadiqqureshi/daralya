import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Privileged client (bypasses RLS). Server-only; used for user administration,
 * public form submissions and scheduled maintenance. Never import from client code.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error("SUPABASE_SECRET_KEY is not configured on the server.");
  }
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const hasAdminKey = () => Boolean(process.env.SUPABASE_SECRET_KEY);
