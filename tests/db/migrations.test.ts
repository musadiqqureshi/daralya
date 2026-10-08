import { describe, it, expect } from "vitest";
import { createDb } from "./harness";

describe("migrations", () => {
  it("apply cleanly on Postgres", async () => {
    const db = await createDb();
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.permissions");
    expect(r.rows[0].n).toBeGreaterThan(50);
  });
});

describe("seed", () => {
  it("loads the starter catalogue", async () => {
    const { readFileSync } = await import("node:fs");
    const db = await createDb();
    await db.exec(readFileSync("supabase/seed/seed.sql", "utf8"));
    await db.exec(readFileSync("supabase/seed/seed.sql", "utf8")); // idempotent
    const r = await db.query<{ n: number; imgs: number }>(
      "select (select count(*)::int from public.products) as n, (select count(*)::int from public.product_images) as imgs");
    expect(r.rows[0].n).toBe(16);
    expect(r.rows[0].imgs).toBe(16);
    const pub = await db.query("select * from public.v_public_products");
    expect(pub.rows.length).toBe(16);
  });
});
