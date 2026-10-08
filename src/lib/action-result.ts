export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Turn a Postgres/Supabase error into a message safe to show users. */
export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const err = e as { message?: string; code?: string } | null;
  const msg = err?.message ?? "";
  if (err?.code === "42501" || /permission denied/i.test(msg)) {
    return msg.startsWith("Permission denied:") ? "You do not have permission to do this." : "You do not have permission to do this.";
  }
  if (err?.code === "23505" && !/already/i.test(msg)) return "This record already exists.";
  if (err?.code === "23503") return "This record is linked to other data and cannot be changed this way.";
  // messages raised by our database functions are written for people
  if (msg && msg.length < 300 && !/^(relation|column|function|syntax|invalid input syntax)/i.test(msg)) return msg;
  return fallback;
}
