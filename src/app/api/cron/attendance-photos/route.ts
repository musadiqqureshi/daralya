import { type NextRequest } from "next/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

/**
 * Daily retention job (Vercel Cron): detaches attendance photos older than the
 * configured retention period and deletes the files from private storage.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!hasAdminKey()) return new Response("SUPABASE_SECRET_KEY missing", { status: 500 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("attendance_expire_photos");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const paths = (data ?? []) as string[];
  for (let i = 0; i < paths.length; i += 100) await admin.storage.from("attendance").remove(paths.slice(i, i + 100));
  return Response.json({ ok: true, deleted: paths.length });
}
