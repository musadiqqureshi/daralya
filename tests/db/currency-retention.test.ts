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
