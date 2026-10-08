import { beforeAll, describe, expect, it } from "vitest";
import { actAs, createDb, createUser, one, rpc, trialBalanceDiff, type Db } from "./harness";

let db: Db;
let owner: string;
const ids: Record<string, string> = {};
const id = async (sql: string) => (await db.query<{ id: string }>(sql + " returning id")).rows[0].id;

beforeAll(async () => {
  db = await createDb();
  owner = await createUser(db, "owner", "owner");
  await actAs(db, owner);
  ids.store = await id("insert into public.storages (name_en, name_ar) values ('Cold 1', 'م1')");
  ids.supplier = await id("insert into public.suppliers (name) values ('Farm')");
  ids.customer = await id("insert into public.customers (name, email) values ('Gulf Trading', 'buyer@example.com')");
  ids.product = await id("insert into public.products (slug, name_en, name_ar, variety, selling_price) values ('ajwa', 'Ajwa', 'عجوة', 'Ajwa', 50)");
  await rpc(db, "purchase_create", [{ supplier_id: ids.supplier, storage_id: ids.store, lines: [{ product_id: ids.product, qty: 100, unit_price: 30 }] }]);
});

describe("foreign-currency sales", () => {
  it("refuses a currency without a fresh rate", async () => {
    await expect(rpc(db, "sale_create_fx", [{ customer_id: ids.customer, storage_id: ids.store, currency: "USD", lines: [{ product_id: ids.product, qty: 1, unit_price: 12 }] }]))
      .rejects.toThrow(/Exchange rate for USD/);
  });

  it("converts prices to SAR with the stored rate and keeps the original", async () => {
    await db.query("insert into public.exchange_rates (currency, sar_per_unit, source) values ('USD', 3.75, 'test')");
    const sale = await rpc<string>(db, "sale_create_fx", [{
      customer_id: ids.customer, storage_id: ids.store, currency: "usd",
      lines: [{ product_id: ids.product, qty: 10, unit_price: 12 }, { product_id: ids.product, qty: 2, unit_price: 13, discount_amount: 1 }],
    }]);
    const s = await one<Record<string, string>>(db, "select currency, fx_rate::text, total::text from public.sales where id = $1", [sale]);
    expect(s.currency).toBe("USD");
    expect(Number(s.fx_rate)).toBe(3.75);
    // 10×12×3.75 = 450 ; 2×13×3.75 − 1×3.75 = 93.75
    expect(Number(s.total)).toBe(543.75);
    const items = await db.query<{ unit_price: string; unit_price_fc: string }>("select unit_price::text, unit_price_fc::text from public.sale_items where sale_id = $1 order by line_no", [sale]);
    expect(items.rows.map((r) => [Number(r.unit_price), Number(r.unit_price_fc)])).toEqual([[45, 12], [48.75, 13]]);
    expect(await trialBalanceDiff(db)).toBe(0);
  });

  it("lets sales staff set their own price (below list)", async () => {
    const seller = await createUser(db, "sales", "seller");
    await actAs(db, seller);
    const sale = await rpc<string>(db, "sale_create_fx", [{ customer_id: ids.customer, storage_id: ids.store, lines: [{ product_id: ids.product, qty: 1, unit_price: 40 }] }]);
    expect(sale).toBeTruthy();
    await actAs(db, owner);
  });
});

describe("attendance photo retention", () => {
  it("drops photos 24 hours after capture but keeps the record", async () => {
    const emp = await id("insert into public.employees (full_name) values ('Ali')");
    await db.query(
      `insert into public.attendance (employee_id, work_date, status, check_in_at, check_in_photo, check_out_at, check_out_photo)
       values ($1, current_date - 2, 'present', now() - interval '25 hours', 'old/in.jpg', now() - interval '20 hours', 'old/out.jpg')`,
      [emp],
    );
    const paths = await rpc<string[]>(db, "attendance_expire_photos", []);
    expect(paths).toEqual(["old/in.jpg"]);
    const a = await one<{ check_in_photo: string | null; check_out_photo: string | null; status: string }>(db, "select check_in_photo, check_out_photo, status from public.attendance where employee_id = $1", [emp]);
    expect(a).toEqual({ check_in_photo: null, check_out_photo: "old/out.jpg", status: "present" });
  });
});

describe("salesman view", () => {
  it("each salesman sees only his own invoices, managers see all", async () => {
    const a = await createUser(db, "sales", "sellerA");
    const b = await createUser(db, "sales", "sellerB");
    const mgr = await createUser(db, "manager", "boss");
    await actAs(db, a);
    await rpc(db, "sale_create_fx", [{ customer_id: ids.customer, storage_id: ids.store, lines: [{ product_id: ids.product, qty: 1, unit_price: 50 }] }]);
    await actAs(db, b);
    await rpc(db, "sale_create_fx", [{ customer_id: ids.customer, storage_id: ids.store, lines: [{ product_id: ids.product, qty: 2, unit_price: 50 }] }]);

    const count = async (uid: string) => {
      await actAs(db, uid, "authenticated");
      const r = await db.query<{ n: number }>("select count(*)::int as n from public.sales");
      await actAs(db, owner);
      return r.rows[0].n;
    };
    const all = (await one<{ n: number }>(db, "select count(*)::int as n from public.sales")).n;
    expect(await count(a)).toBe(1);
    expect(await count(b)).toBe(1);
    expect(await count(mgr)).toBe(all);
  });

  it("stock overview gives salesmen the bought price per kg", async () => {
    const s = await createUser(db, "sales", "sellerC");
    await actAs(db, s, "authenticated");
    const r = await one<{ qty: string; cost_per_kg: string; selling_price: string }>(db, "select qty::text, cost_per_kg::text, selling_price::text from public.stock_overview() where sku is not null limit 1");
    await actAs(db, owner);
    expect(Number(r.cost_per_kg)).toBe(30);
    expect(Number(r.selling_price)).toBe(50);
    expect(Number(r.qty)).toBeGreaterThan(0);
  });
});

describe("admin set stock", () => {
  it("sets the counted quantity up and down with audited adjustments", async () => {
    await actAs(db, owner);
    const qty = async () => Number((await one<{ q: string }>(db, "select coalesce(sum(qty),0)::text as q from public.stock_movements where product_id = $1 and storage_id = $2", [ids.product, ids.store])).q);
    await rpc(db, "stock_set_quantity", [ids.product, ids.store, 200, 25, "Physical count"]);
    expect(await qty()).toBe(200);
    await rpc(db, "stock_set_quantity", [ids.product, ids.store, 150, null, "Recount"]);
    expect(await qty()).toBe(150);
    expect(await rpc(db, "stock_set_quantity", [ids.product, ids.store, 150, null, null])).toBeNull();
    const adj = await one<{ n: number }>(db, "select count(*)::int as n from public.stock_adjustments where status = 'approved'");
    expect(adj.n).toBe(2);
    expect(await trialBalanceDiff(db)).toBe(0);
    const seller = await createUser(db, "sales", "sellerD");
    await actAs(db, seller);
    await expect(rpc(db, "stock_set_quantity", [ids.product, ids.store, 1, null, null])).rejects.toThrow(/Permission denied/);
    await actAs(db, owner);
  });
});
