import { SUPABASE_URL } from "./env";

/** Public bucket path → URL. Absolute URLs (e.g. stock photography) pass through unchanged. */
export function publicStorageUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
