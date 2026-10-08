#!/usr/bin/env node
/**
 * Database tasks against the Supabase Postgres in SUPABASE_DB_URL.
 *   node scripts/db.mjs migrate        apply pending supabase/migrations/*.sql (each in a transaction)
 *   node scripts/db.mjs seed           load supabase/seed/seed.sql (idempotent)
 *   node scripts/db.mjs status         list applied / pending migrations
 *   node scripts/db.mjs create-owner <email> <full name>
 *        creates the first Owner login and prints a one-time password to change at first sign-in
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is missing in .env.local (Supabase → Connect → Session pooler URI).");
  process.exit(1);
}
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
const dir = join(process.cwd(), "supabase", "migrations");
const cmd = process.argv[2];

async function ensureTable() {
  await sql`create schema if not exists app`;
  await sql`create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
}

async function applied() {
  await ensureTable();
  return new Set((await sql`select name from app.schema_migrations`).map((r) => r.name));
}

try {
  if (cmd === "migrate" || cmd === "status") {
    const done = await applied();
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (done.has(f)) {
        if (cmd === "status") console.log(`  applied  ${f}`);
        continue;
      }
      if (cmd === "status") {
        console.log(`  pending  ${f}`);
        continue;
      }
      process.stdout.write(`Applying ${f} … `);
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(join(dir, f), "utf8"));
        await tx`insert into app.schema_migrations (name) values (${f})`;
      });
      console.log("done");
    }
    if (cmd === "migrate") console.log("Database is up to date.");
  } else if (cmd === "seed") {
    await sql.unsafe(readFileSync(join(process.cwd(), "supabase", "seed", "seed.sql"), "utf8"));
    console.log("Seed data loaded.");
  } else if (cmd === "create-owner") {
    const [email, ...nameParts] = process.argv.slice(3);
    const fullName = nameParts.join(" ") || "Owner";
    if (!email) throw new Error("Usage: node scripts/db.mjs create-owner <email> <full name>");
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    const password = randomBytes(9).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw error;
    await sql`insert into public.profiles (id, full_name, email, role) values (${data.user.id}, ${fullName}, ${email}, 'owner')
              on conflict (id) do update set role = 'owner', is_active = true`;
    console.log(`Owner created: ${email}\nTemporary password: ${password}\nSign in at /erp/login and change it under your profile.`);
  } else {
    console.log("Commands: migrate | status | seed | create-owner <email> <name>");
  }
} catch (e) {
  console.error("\nFailed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
