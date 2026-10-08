"use server";
import { cookies } from "next/headers";

/** Mirrors the configured inactivity timeout into a cookie the proxy can read. */
export async function syncSessionTimeout(minutes: number) {
  const m = Math.min(Math.max(Math.round(minutes), 5), 1440);
  (await cookies()).set("erp_timeout_min", String(m), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
