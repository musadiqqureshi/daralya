import { type NextRequest } from "next/server";
import { mailDailyReport } from "@/lib/erp/mailers";
import { hasAdminKey } from "@/lib/supabase/admin";

/** End-of-day sales & stock email (Vercel Cron, 23:55 Saudi time). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!hasAdminKey()) return new Response("SUPABASE_SECRET_KEY missing", { status: 500 });
  const res = await mailDailyReport();
  if (!res.enabled) return Response.json({ ok: true, skipped: "disabled in settings" });
  return Response.json(res, { status: res.ok ? 200 : 500 });
}
