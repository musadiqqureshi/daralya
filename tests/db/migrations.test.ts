import { describe, it, expect } from "vitest";
import { createDb } from "./harness";

describe("migrations", () => {
  it("apply cleanly on Postgres", async () => {
    const db = await createDb();
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.permissions");
    expect(r.rows[0].n).toBeGreaterThan(50);
  });
});
