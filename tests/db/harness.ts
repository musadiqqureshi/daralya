import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");

export async function createDb() {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  const dir = join(root, "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), "utf8"));
    } catch (e) {
      throw new Error(`${file}: ${(e as Error).message}`);
    }
  }
  return db;
}

export type Db = PGlite;

/** Act as a signed-in Supabase user (RLS applies when asRole is "authenticated"). */
export async function actAs(db: Db, userId: string | null, asRole: "authenticated" | null = null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  if (asRole) await db.exec(`set role ${asRole}`);
}

export async function one<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []) {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}

export async function rpc<T = unknown>(db: Db, fn: string, args: unknown[]) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const r = await db.query<{ r: T }>(`select public.${fn}(${placeholders}) as r`, args.map((a) => (typeof a === "object" && a !== null ? JSON.stringify(a) : a)));
  return r.rows[0].r;
}

export async function createUser(db: Db, role: string, name = role) {
  await db.exec("reset role");
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${name}@test.local`]);
  await db.query("insert into public.profiles (id, full_name, email, role) values ($1, $2, $3, $4)", [id, name, `${name}@test.local`, role]);
  return id;
}

export async function trialBalanceDiff(db: Db) {
  const r = await one<{ diff: string }>(db, "select coalesce(sum(debit) - sum(credit), 0)::text as diff from public.journal_lines");
  return Number(r.diff);
}
