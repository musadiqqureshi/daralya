import "server-only";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { translateDbError } from "./db-errors";

/** Call a permission-checked database function as the signed-in user. */
export async function callRpc<T = unknown>(fn: string, args: Record<string, unknown>, revalidate: string[] | false = []): Promise<ActionResult<T>> {
  const session = await getSession();
  const dict = await getDictionary();
  if (!session) return { ok: false, error: dict.common.permissionDenied };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: await translateDbError(friendlyError(error)) };
  // false = caller updates its own screen (POS), so the action returns without re-rendering the page
  if (revalidate !== false) {
    revalidatePath("/erp", "layout");
    revalidate.forEach((p) => revalidatePath(p));
  }
  return { ok: true, data: data as T };
}

/** Wrap a mutation that needs a permission, returning a friendly result. */
export async function guarded<T>(perm: string | string[], fn: (ctx: { supabase: Awaited<ReturnType<typeof createClient>> }) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getSession();
  const dict = await getDictionary();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!session || !perms.some((p) => session.can(p))) return { ok: false, error: dict.common.permissionDenied };
  try {
    const supabase = await createClient();
    const data = await fn({ supabase });
    revalidatePath("/erp", "layout");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: await translateDbError(friendlyError(e)) };
  }
}

/** Throw a Supabase error so `guarded` can turn it into a message. */
export function must<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}
