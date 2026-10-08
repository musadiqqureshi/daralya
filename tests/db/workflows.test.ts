import { beforeAll, describe, expect, it } from "vitest";
import { actAs, createDb, createUser, one, rpc, trialBalanceDiff, type Db } from "./harness";

let db: Db;
let owner: string;
const ids: Record<string, string> = {};

async function balance(type: string, id: string, gl: string) {
  const r = await one<{ b: string }>(
    db,
    "select coalesce(sum(debit - credit), 0)::text as b from public.journal_lines where party_type = $1 and party_id = $2 and gl_code = $3",
    [type, id, gl],
  );
  return Number(r.b);
}
async function money(id: string) {
  const r = await one<{ b: string }>(db, "select balance::text as b from public.v_money_balances where id = $1", [id]);
  return Number(r.b);
}
async function stock(product: string, storage?: string) {
  const r = await one<{ q: string }>(
    db,
    "select coalesce(sum(qty), 0)::text as q from public.stock_movements where product_id = $1 and ($2::uuid is null or storage_id = $2)",
    [product, storage ?? null],
  );
  return Number(r.q);
}
async function insertId(sql: string, params: unknown[]) {
  const r = await db.query<{ id: string }>(sql + " returning id", params);
  return r.rows[0].id;
}

beforeAll(async () => {
  db = await createDb();
  owner = await createUser(db, "owner", "owner");
  await actAs(db, owner);
  ids.cold1 = await insertId("insert into public.storages (name_en, name_ar, capacity_kg) values ('Cold Store 1', 'المستودع 1', 10000)", []);
  ids.cold2 = await insertId("insert into public.storages (name_en, name_ar) values ('Cold Store 2', 'المستودع 2')", []);
  ids.cash = await insertId("insert into public.money_accounts (name_en, name_ar, kind, opening_balance) values ('Main cash', 'الصندوق', 'cash', 1000)", []);
  ids.bank = await insertId("insert into public.money_accounts (name_en, name_ar, kind) values ('Al Rajhi', 'الراجحي', 'bank')", []);
  ids.supplier = await insertId("insert into public.suppliers (name) values ('Qassim Farms')", []);
  ids.customer = await insertId("insert into public.customers (name) values ('Riyadh Sweets')", []);
  ids.driver = await insertId(
    "insert into public.drivers (name, commission_type, commission_value) values ('Ahmed', 'per_kg', 0.5)",
    [],
  );
  ids.sukkari = await insertId(
    "insert into public.products (slug, name_en, name_ar, variety, unit, weight_kg, selling_price, purchase_price, min_stock) values ('sukkari-5kg', 'Sukkari 5kg carton', 'سكري ٥ كجم', 'Sukkari', 'carton', 5, 100, 60, 10) ",
    [],
  );
  ids.cashMethod = (await one<{ id: string }>(db, "select id from public.payment_methods where code = 'cash'"))!.id;
  ids.bankMethod = (await one<{ id: string }>(db, "select id from public.payment_methods where code = 'bank_transfer'"))!.id;
});

describe("purchases", () => {
  it("creates batch, stock, landed cost and supplier balance in one transaction", async () => {
    ids.purchase1 = await rpc<string>(db, "purchase_create", [{
      supplier_id: ids.supplier, storage_id: ids.cold1, transport_cost: 100, loading_cost: 0,
      lines: [{ product_id: ids.sukkari, qty: 50, unit_price: 60 }],
    }]);
    expect(await stock(ids.sukkari, ids.cold1)).toBe(50);
    expect(await balance("supplier", ids.supplier, "2100")).toBe(-3100); // we owe 3,000 + 100 transport
    const b = await one<{ unit_cost: string; batch_no: string }>(db, "select unit_cost::text, batch_no from public.stock_batches where purchase_id = $1", [ids.purchase1]);
    expect(Number(b.unit_cost)).toBe(62); // (3000 + 100) / 50
    expect(b.batch_no).toMatch(/^B-\d{4}-\d{5}$/);
    expect(await trialBalanceDiff(db)).toBe(0);
  });

  it("records a second batch at a different cost (for FIFO)", async () => {
    ids.purchase2 = await rpc<string>(db, "purchase_create", [{
      supplier_id: ids.supplier, storage_id: ids.cold1,
      lines: [{ product_id: ids.sukkari, qty: 20, unit_price: 70 }],
      payment: { amount: 500, method_id: ids.cashMethod, money_account_id: ids.cash },
    }]);
    const p = await one<{ payment_status: string; paid_total: string }>(db, "select payment_status, paid_total::text from public.purchases where id = $1", [ids.purchase2]);
    expect(p.payment_status).toBe("partial");
    expect(Number(p.paid_total)).toBe(500);
    expect(await money(ids.cash)).toBe(500);
  });
});

describe("sales", () => {
  it("updates invoice, customer, stock (FIFO cost), commission and profit", async () => {
    ids.sale1 = await rpc<string>(db, "sale_create", [{
      customer_id: ids.customer, storage_id: ids.cold1, driver_id: ids.driver, discount_amount: 0,
      lines: [{ product_id: ids.sukkari, qty: 55, unit_price: 100 }],
      payment: { amount: 2000, method_id: ids.cashMethod, money_account_id: ids.cash },
      delivery: { scheduled_date: null },
    }]);
    const s = await one<Record<string, string>>(db,
      "select invoice_no, total::text, cogs_total::text, commission_amount::text, payment_status, total_kg::text from public.sales where id = $1", [ids.sale1]);
    expect(s.invoice_no).toMatch(/^INV-\d{4}-00001$/);
    expect(Number(s.total)).toBe(5500);
    expect(Number(s.cogs_total)).toBe(50 * 62 + 5 * 70); // FIFO across two batches = 3450
    expect(Number(s.total_kg)).toBe(275);
    expect(Number(s.commission_amount)).toBe(137.5); // 275 kg × 0.5
    expect(s.payment_status).toBe("partial");
    expect(await stock(ids.sukkari, ids.cold1)).toBe(15);
    expect(await balance("customer", ids.customer, "1200")).toBe(3500);
    expect(await balance("driver", ids.driver, "2300")).toBe(-137.5);
    expect(await money(ids.cash)).toBe(2500);
    const d = await one<{ n: number }>(db, "select count(*)::int as n from public.deliveries where sale_id = $1", [ids.sale1]);
    expect(d.n).toBe(1);
    expect(await trialBalanceDiff(db)).toBe(0);
  });

  it("refuses to sell more than is in stock", async () => {
    await expect(rpc(db, "sale_create", [{
      customer_id: ids.customer, storage_id: ids.cold1, lines: [{ product_id: ids.sukkari, qty: 16, unit_price: 100 }],
    }])).rejects.toThrow(/Insufficient stock/);
    expect(await stock(ids.sukkari, ids.cold1)).toBe(15);
  });

  it("keeps a pending bank transfer out of cleared funds until verified", async () => {
    ids.pay1 = await rpc<string>(db, "payment_create", [{
      purpose: "customer_receipt", party_id: ids.customer, amount: 3500, method_id: ids.bankMethod,
      money_account_id: ids.bank, reference: "TRX-1", allocations: [{ doc_type: "sale", doc_id: ids.sale1, amount: 3500 }],
    }]);
    let s = await one<Record<string, string>>(db, "select payment_status, pending_total::text from public.sales where id = $1", [ids.sale1]);
    expect(s.payment_status).toBe("partial");
    expect(Number(s.pending_total)).toBe(3500);
    expect(await money(ids.bank)).toBe(0);
    expect(await balance("customer", ids.customer, "1200")).toBe(3500);

    await rpc(db, "payment_verify", [ids.pay1]);
    s = await one<Record<string, string>>(db, "select payment_status, pending_total::text from public.sales where id = $1", [ids.sale1]);
    expect(s.payment_status).toBe("paid");
    expect(await money(ids.bank)).toBe(3500);
    expect(await balance("customer", ids.customer, "1200")).toBe(0);
  });

  it("processes a partial sales return with stock, VAT-free credit and commission reversal", async () => {
    const item = await one<{ id: string }>(db, "select id from public.sale_items where sale_id = $1", [ids.sale1]);
    await rpc(db, "sale_return_create", [{ sale_id: ids.sale1, reason: "Damaged cartons", lines: [{ sale_item_id: item.id, qty: 5 }] }]);
    expect(await stock(ids.sukkari, ids.cold1)).toBe(20);
    expect(await balance("customer", ids.customer, "1200")).toBe(-500); // credit owed to customer
    expect(await balance("driver", ids.driver, "2300")).toBe(-125); // 137.5 − 12.5
    expect(await trialBalanceDiff(db)).toBe(0);
  });

  it("blocks cancelling an invoice that has payments", async () => {
    await expect(rpc(db, "sale_cancel", [ids.sale1, "Wrong customer"])).rejects.toThrow(/has returns|Cancel the payments/);
  });

  it("cancels an invoice and restores stock exactly", async () => {
    const id = await rpc<string>(db, "sale_create", [{
      customer_id: ids.customer, storage_id: ids.cold1, lines: [{ product_id: ids.sukkari, qty: 4, unit_price: 100 }],
    }]);
    expect(await stock(ids.sukkari, ids.cold1)).toBe(16);
    await rpc(db, "sale_cancel", [id, "Entered twice"]);
    expect(await stock(ids.sukkari, ids.cold1)).toBe(20);
    expect(await balance("customer", ids.customer, "1200")).toBe(-500);
    await expect(db.query("delete from public.sales where id = $1", [id])).rejects.toThrow(/cannot be deleted/);
  });
});

describe("storage", () => {
  it("transfers stock between storages in one transaction, keeping batches", async () => {
    await rpc(db, "stock_transfer_create", [{
      from_storage_id: ids.cold1, to_storage_id: ids.cold2, lines: [{ product_id: ids.sukkari, qty: 8 }],
    }]);
    expect(await stock(ids.sukkari, ids.cold1)).toBe(12);
    expect(await stock(ids.sukkari, ids.cold2)).toBe(8);
    expect(await stock(ids.sukkari)).toBe(20);
  });

  it("enforces storage capacity", async () => {
    await expect(rpc(db, "purchase_create", [{
      supplier_id: ids.supplier, storage_id: ids.cold1, lines: [{ product_id: ids.sukkari, qty: 2000, unit_price: 50 }],
    }])).rejects.toThrow(/capacity/);
  });

  it("posts damage only after approval", async () => {
    const adj = await rpc<string>(db, "stock_adjustment_request", [{
      storage_id: ids.cold2, adj_type: "damage", reason: "Cooling failure", lines: [{ product_id: ids.sukkari, qty: 2 }],
    }]);
    expect(await stock(ids.sukkari, ids.cold2)).toBe(8);
    await rpc(db, "stock_adjustment_review", [adj, true, "Checked"]);
    expect(await stock(ids.sukkari, ids.cold2)).toBe(6);
    expect(await trialBalanceDiff(db)).toBe(0);
  });
});

describe("cash & bank", () => {
  it("records expenses, transfers and cash closing with over/short", async () => {
    const cat = (await one<{ id: string }>(db, "select id from public.expense_categories where name_en = 'Fuel'"))!.id;
    await rpc(db, "expense_create", [{ category_id: cat, amount: 150, money_account_id: ids.cash, description: "Diesel" }]);
    expect(await money(ids.cash)).toBe(2350);
    await rpc(db, "money_transfer_create", [{ from_account_id: ids.cash, to_account_id: ids.bank, amount: 1000 }]);
    expect(await money(ids.cash)).toBe(1350);
    await expect(rpc(db, "money_transfer_create", [{ from_account_id: ids.cash, to_account_id: ids.bank, amount: 99999 }]))
      .rejects.toThrow(/Not enough balance/);
    const today = (await one<{ d: string }>(db, "select app.today()::text as d"))!.d;
    await expect(rpc(db, "cash_closing_create", [ids.cash, today, 1340, null])).rejects.toThrow(/Explain the difference/);
    await rpc(db, "cash_closing_create", [ids.cash, today, 1340, "Counted short by 10"]);
    expect(await money(ids.cash)).toBe(1340);
    expect(await trialBalanceDiff(db)).toBe(0);
  });

  it("pays driver commission and the balance drops", async () => {
    await rpc(db, "payment_create", [{
      purpose: "driver_commission", party_id: ids.driver, amount: 100, method_id: ids.cashMethod, money_account_id: ids.cash,
    }]);
    expect(await balance("driver", ids.driver, "2300")).toBe(-25);
  });
});

describe("investors", () => {
  it("keeps capital and profit separate (proposal example)", async () => {
    ids.investor = await insertId("insert into public.investors (name) values ('Investor One')", []);
    const no = (await one<{ investor_no: string }>(db, "select investor_no from public.investors where id = $1", [ids.investor]))!.investor_no;
    expect(no).toBe("INV-0001");
    ids.investment = await insertId(
      "insert into public.investments (investor_id, model, committed_amount, start_date, profit_share_pct) values ($1, 'profit_share', 100000, current_date, 30)",
      [ids.investor],
    );
    await rpc(db, "payment_create", [{
      purpose: "investor_capital_in", party_id: ids.investor, investment_id: ids.investment, amount: 100000,
      method_id: ids.cashMethod, money_account_id: ids.bank,
    }]);
    const alloc = await rpc<string>(db, "profit_allocation_create", [{ investment_id: ids.investment, period_label: "Q1", basis_net_profit: 40000 }]);
    let sum = await one<Record<string, string>>(db, "select * from public.v_investment_summary where investment_id = $1", [ids.investment]);
    expect(Number(sum.profit_earned)).toBe(0); // draft is not final
    await rpc(db, "profit_allocation_approve", [alloc]);
    await rpc(db, "payment_create", [{
      purpose: "investor_profit", party_id: ids.investor, investment_id: ids.investment, amount: 5000,
      method_id: ids.cashMethod, money_account_id: ids.bank,
    }]);
    sum = await one<Record<string, string>>(db, "select * from public.v_investment_summary where investment_id = $1", [ids.investment]);
    expect(Number(sum.capital_balance)).toBe(100000);
    expect(Number(sum.profit_earned)).toBe(12000);
    expect(Number(sum.profit_paid)).toBe(5000);
    expect(Number(sum.profit_outstanding)).toBe(7000);
    await expect(rpc(db, "profit_allocation_cancel", [alloc, "changed mind"])).rejects.toThrow(/adjustment/);
    await rpc(db, "payment_create", [{
      purpose: "investor_capital_return", party_id: ids.investor, investment_id: ids.investment, amount: 20000,
      method_id: ids.cashMethod, money_account_id: ids.bank,
    }]);
    sum = await one<Record<string, string>>(db, "select * from public.v_investment_summary where investment_id = $1", [ids.investment]);
    expect(Number(sum.capital_balance)).toBe(80000);
    expect(Number(sum.profit_outstanding)).toBe(7000);
    expect(await trialBalanceDiff(db)).toBe(0);
  });
});

describe("attendance & payroll", () => {
  it("marks attendance from a stored live photo with server time, blocks duplicates, checks out", async () => {
    // schedule started an hour ago (Saudi time) so this check-in is late
    await db.exec(`insert into public.work_schedules (name, start_time, end_time, break_minutes, working_days, half_day_minutes)
      values ('Test', ((now() at time zone 'Asia/Riyadh') - interval '61 minutes')::time, ((now() at time zone 'Asia/Riyadh') + interval '7 hours')::time, 0, '{0,1,2,3,4,5,6}', 1)`);
    const sched = (await one<{ id: string }>(db, "select id from public.work_schedules where name = 'Test'"))!.id;
    ids.emp = await insertId(
      "insert into public.employees (full_name, basic_salary, salary_type, schedule_id, joining_date) values ('Salman', 2600, 'monthly', $1, current_date - 40)",
      [sched],
    );
    await expect(rpc(db, "attendance_check_in", [ids.emp, `${ids.emp}/missing.jpg`, null, null, null]))
      .rejects.toThrow(/photo was not received/);
    await expect(rpc(db, "attendance_check_in", [ids.emp, null, null, "", null])).rejects.toThrow(/needs a reason/);

    const path = `${ids.emp}/2026/in.jpg`;
    await db.query("insert into storage.objects (bucket_id, name) values ('attendance', $1)", [path]);
    const rec = await rpc<Record<string, unknown>>(db, "attendance_check_in", [ids.emp, path, { ua: "test" }, null, null]);
    expect(rec.status).toBe("late");
    expect(Number(rec.late_minutes)).toBeGreaterThanOrEqual(60);
    expect(rec.recorded_by).toBe(owner);
    await expect(rpc(db, "attendance_check_in", [ids.emp, path, null, null, null])).rejects.toThrow(/already checked in/);

    const outPath = `${ids.emp}/2026/out.jpg`;
    await db.query("insert into storage.objects (bucket_id, name) values ('attendance', $1)", [outPath]);
    const out = await rpc<Record<string, unknown>>(db, "attendance_check_out", [ids.emp, outPath, null, null, null]);
    expect(out.check_out_at).toBeTruthy();
    await expect(rpc(db, "attendance_check_out", [ids.emp, outPath, null, null, null])).rejects.toThrow(/already checked out/);
    await expect(db.query("delete from public.attendance where id = $1", [rec.id])).rejects.toThrow(/cannot be deleted/);
  });

  it("requires a reason for corrections and logs them", async () => {
    const a = (await one<{ id: string }>(db, "select id from public.attendance where employee_id = $1", [ids.emp]))!.id;
    await expect(rpc(db, "attendance_correct", [a, { status: "present" }, ""])).rejects.toThrow(/reason/);
    await rpc(db, "attendance_correct", [a, { notes: "Traffic accident on highway" }, "Late excused by manager"]);
    const c = await one<{ n: number }>(db, "select count(*)::int as n from public.attendance_corrections where attendance_id = $1", [a]);
    expect(c.n).toBe(1);
  });

  it("previews payroll with deductions shown, approves and pays", async () => {
    // an absence yesterday and an advance
    await db.query("insert into public.attendance (employee_id, work_date, status) values ($1, app.today() - 1, 'absent')", [ids.emp]);
    await rpc(db, "payment_create", [{ purpose: "salary_advance", party_id: ids.emp, amount: 300, method_id: ids.cashMethod, money_account_id: ids.bank }]);
    const run = await rpc<string>(db, "payroll_generate", [
      (await one<{ d: string }>(db, "select (app.today() - 1)::text as d"))!.d,
      (await one<{ d: string }>(db, "select app.today()::text as d"))!.d,
      null,
    ]);
    const item = await one<Record<string, string>>(db, "select * from public.payroll_items where run_id = $1 and employee_id = $2", [run, ids.emp]);
    expect(Number(item.absent_days)).toBe(1);
    expect(Number(item.absence_deduction)).toBe(100); // 2600 / 26
    expect(Number(item.advance_balance)).toBe(300);
    expect(Number(item.advance_deduction)).toBe(0); // never applied silently
    await rpc(db, "payroll_item_update", [item.id, { advance_deduction: 300 }]);
    await expect(rpc(db, "payroll_item_update", [item.id, { advance_deduction: 301 }])).rejects.toThrow(/cannot exceed/);
    await rpc(db, "payroll_approve", [run]);
    const net = Number((await one<{ n: string }>(db, "select net_pay::text as n from public.payroll_items where id = $1", [item.id]))!.n);
    expect(await balance("employee", ids.emp, "2400")).toBe(-net);
    expect(await balance("employee", ids.emp, "1400")).toBe(0);
    await rpc(db, "payment_create", [{
      purpose: "salary", party_id: ids.emp, amount: net, method_id: ids.cashMethod, money_account_id: ids.bank,
      allocations: [{ doc_type: "payroll_item", doc_id: item.id, amount: net }],
    }]);
    expect(await balance("employee", ids.emp, "2400")).toBe(0);
    await expect(rpc(db, "payroll_generate", ["2000-01-01", "2100-01-01", null])).rejects.toThrow(/already covers/);
    expect(await trialBalanceDiff(db)).toBe(0);
  });
});

describe("reports", () => {
  it("dashboard and P&L read real postings", async () => {
    const today = (await one<{ d: string }>(db, "select app.today()::text as d"))!.d;
    const d = await rpc<Record<string, unknown>>(db, "dashboard_summary", [today, today]);
    expect(Number(d.revenue)).toBe(5000); // 5,500 sold − 500 returned (excluding the cancelled invoice)
    expect(Number(d.receivables)).toBe(-500);
    const pl = await db.query<{ code: string; amount: string }>("select code, amount::text from public.report_profit_loss($1, $1)", [today]);
    const by = Object.fromEntries(pl.rows.map((r) => [r.code, Number(r.amount)]));
    expect(by["4100"]).toBe(5500);
    expect(by["4110"]).toBe(-500);
    const st = await db.query("select * from public.party_statement('customer', $1, $2, $2)", [ids.customer, today]);
    expect(st.rows.length).toBeGreaterThan(2);
  });
});

describe("row-level security", () => {
  it("hides costs and blocks direct ledger writes for sales staff", async () => {
    const sales = await createUser(db, "sales", "seller");
    await actAs(db, sales, "authenticated");
    const p = await db.query("select id, name_en, selling_price from public.products");
    expect(p.rows.length).toBe(1);
    await expect(db.query("select purchase_price from public.products")).rejects.toThrow(/permission denied/);
    await expect(db.query("select cogs from public.sale_items")).rejects.toThrow(/permission denied/);
    await expect(rpc(db, "product_costs", [])).rejects.toThrow(/Permission denied/);
    const lines = await db.query<{ gl_code: string }>("select distinct gl_code from public.journal_lines");
    expect(lines.rows.map((r) => r.gl_code).sort()).toEqual(["1200"]); // only customer lines
    await expect(db.query("insert into public.journal_entries (entry_no, entry_date, source_type) values ('X', current_date, 'hack')"))
      .rejects.toThrow();
    await expect(rpc(db, "purchase_create", [{ supplier_id: ids.supplier, storage_id: ids.cold1, lines: [] }]))
      .rejects.toThrow(/Permission denied: purchases.create/);
    await actAs(db, owner);
  });

  it("warehouse staff see stock but not sales or money", async () => {
    const wh = await createUser(db, "warehouse", "store");
    await actAs(db, wh, "authenticated");
    expect((await db.query("select id from public.sales")).rows.length).toBe(0);
    await expect(db.query("select * from public.sales")).rejects.toThrow(/permission denied/);
    expect((await db.query("select * from public.v_money_balances")).rows.length).toBe(0);
    expect((await db.query("select product_id, qty from public.stock_movements")).rows.length).toBeGreaterThan(0);
    await actAs(db, owner);
  });

  it("anonymous visitors only see published products", async () => {
    await db.exec("reset role");
    await db.query("update public.products set is_published = true where id = $1", [ids.sukkari]);
    await actAs(db, null);
    await db.exec("set role anon");
    const r = await db.query<Record<string, unknown>>("select * from public.v_public_products");
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]).not.toHaveProperty("purchase_price");
    expect(r.rows[0]).not.toHaveProperty("selling_price");
    await expect(db.query("select * from public.customers")).rejects.toThrow();
    await actAs(db, owner);
  });
});
