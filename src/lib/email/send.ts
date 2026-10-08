import "server-only";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

type Mail = { to: string | string[]; subject: string; html: string; text?: string; kind: "invoice" | "credentials" | "daily_report" | "other"; relatedId?: string | null; sentBy?: string | null; replyTo?: string };

/** Send through the Resend API and record the outcome in email_log. Never throws. */
export async function sendEmail(m: Mail): Promise<{ ok: boolean; error?: string }> {
  const to = (Array.isArray(m.to) ? m.to : [m.to]).map((x) => x.trim()).filter(Boolean);
  let result: { ok: boolean; error?: string };
  if (!to.length) result = { ok: false, error: "No recipient" };
  else if (!emailConfigured()) result = { ok: false, error: "Email is not configured (RESEND_API_KEY / EMAIL_FROM)" };
  else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo }),
        signal: AbortSignal.timeout(10000),
      });
      result = res.ok ? { ok: true } : { ok: false, error: ((await res.json().catch(() => ({}))) as { message?: string }).message ?? `HTTP ${res.status}` };
    } catch (e) {
      result = { ok: false, error: (e as Error).message };
    }
  }
  if (hasAdminKey()) {
    await createAdminClient()
      .from("email_log")
      .insert(to.map((r) => ({ kind: m.kind, recipient: r, subject: m.subject, related_id: m.relatedId ?? null, status: result.ok ? "sent" : "failed", error: result.error ?? null, sent_by: m.sentBy ?? null })))
      .then(() => undefined, () => undefined);
  }
  return result;
}
