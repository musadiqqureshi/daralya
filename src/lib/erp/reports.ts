import "server-only";
import type { Session } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/en";
import { createClient } from "@/lib/supabase/server";

export type ReportCol = { key: string; header: string; kind?: "money" | "number" | "text" | "date" | "status"; align?: "start" | "end" };
export type Report = { title: string; columns: ReportCol[]; rows: Record<string, unknown>[]; totals?: Record<string, number>; note?: string };

export const REPORTS = ["sales", "purchases", "pl", "inventory", "storage", "receivables", "payables", "commissions", "attendance", "payroll", "expenses", "cashbank", "investors", "trial"] as const;
export type ReportName = (typeof REPORTS)[number];

/** Which permission each report needs (any of). */
export const REPORT_PERMS: Record<ReportName, string[]> = {
  sales: ["sales.view"],
  purchases: ["purchases.view"],
  pl: ["reports.financial"],
  inventory: ["inventory.view"],
  storage: ["inventory.view"],
  receivables: ["customers.view"],
  payables: ["suppliers.view"],
  commissions: ["commissions.view"],
  attendance: ["attendance.view"],
  payroll: ["payroll.view"],
  expenses: ["expenses.view"],
  cashbank: ["accounts.view"],
  investors: ["investors.view"],
  trial: ["reports.financial"],
};

const sum = (rows: Record<string, unknown>[], keys: string[]) => Object.fromEntries(keys.map((k) => [k, rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)]));

export async function buildReport(name: ReportName, p: { from: string; to: string; group?: string }, session: Session, locale: Locale, dict: Dict): Promise<Report | null> {
  if (!REPORT_PERMS[name].some((x) => session.can(x)) || !(session.can("reports.view") || session.can("reports.financial"))) return null;
  const supabase = await createClient();
  const t = dict.erp;
  const c = dict.common;
  const ar = locale === "ar";
  const nm = (r: Record<string, unknown>, base = "name") => String((ar ? r[`${base}_ar`] || r[base] || r[`${base}_en`] : r[base] || r[`${base}_en`] || r[`${base}_ar`]) ?? "");

  switch (name) {
    case "sales": {
      const group = ["day", "product", "customer", "driver"].includes(p.group ?? "") ? p.group! : "day";
      const { data } = await supabase.rpc("report_sales", { p_start: p.from, p_end: p.to, p_group: group });
      const fin = session.can("reports.financial");
      const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, label: ar ? r.label_ar : r.label_en }));
      const cols: ReportCol[] = [
        { key: "label", header: t.reports.groups[group as "day"] },
        { key: "invoices", header: t.customers.invoices, kind: "number", align: "end" },
        { key: "qty", header: c.qty, kind: "number", align: "end" },
        { key: "kg", header: c.kg, kind: "number", align: "end" },
        { key: "net_sales", header: t.fields.netAmount, kind: "money", align: "end" },
        { key: "vat", header: c.vat, kind: "money", align: "end" },
        ...(fin ? ([{ key: "cogs", header: t.sales.cogs, kind: "money", align: "end" }, { key: "gross_profit", header: t.sales.margin, kind: "money", align: "end" }] as ReportCol[]) : []),
      ];
      return { title: `${t.reports.sales} · ${t.reports.groups[group as "day"]}`, columns: cols, rows, totals: sum(rows, ["invoices", "qty", "kg", "net_sales", "vat", ...(fin ? ["cogs", "gross_profit"] : [])]) };
    }
    case "purchases": {
      const group = ["day", "product", "supplier"].includes(p.group ?? "") ? p.group! : "supplier";
      const { data } = await supabase.rpc("report_purchases", { p_start: p.from, p_end: p.to, p_group: group });
      const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, label: ar ? r.label_ar : r.label_en }));
      return {
        title: `${t.reports.purchases} · ${t.reports.groups[group as "day"]}`,
        columns: [
          { key: "label", header: t.reports.groups[group as "day"] },
          { key: "documents", header: t.fields.documentNo, kind: "number", align: "end" },
          { key: "qty", header: c.qty, kind: "number", align: "end" },
          { key: "amount", header: c.amount, kind: "money", align: "end" },
        ],
        rows,
        totals: sum(rows, ["documents", "qty", "amount"]),
      };
    }
    case "pl": {
      const { data } = await supabase.rpc("report_profit_loss", { p_start: p.from, p_end: p.to });
      const lines = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ code: r.code, name: nm(r), type: r.type, amount: Number(r.amount) }));
      const income = lines.filter((l) => l.type === "income");
      const expense = lines.filter((l) => l.type === "expense");
      const ti = income.reduce((s, l) => s + l.amount, 0);
      const te = expense.reduce((s, l) => s + l.amount, 0);
      const rows = [
        { code: "", name: t.reports.income.toUpperCase(), amount: null, strong: true },
        ...income,
        { code: "", name: `${c.total} ${t.reports.income}`, amount: ti, strong: true },
        { code: "", name: t.reports.expense.toUpperCase(), amount: null, strong: true },
        ...expense,
        { code: "", name: `${c.total} ${t.reports.expense}`, amount: te, strong: true },
        { code: "", name: t.reports.net, amount: ti - te, strong: true },
      ];
      return { title: t.reports.pl, columns: [{ key: "code", header: c.code }, { key: "name", header: c.description }, { key: "amount", header: c.amount, kind: "money", align: "end" }], rows };
    }
    case "inventory":
    case "storage": {
      const { data } = await supabase.rpc("report_inventory", { p_storage: null });
      const showValue = session.can("products.view_cost");
      let rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, product: nm(r), storage: ar ? r.storage_ar : r.storage_en, unit: t.units[r.unit as "kg"], qty: Number(r.qty), kg: Number(r.kg), value: r.value === null ? null : Number(r.value) }));
      if (name === "storage") {
        const by = new Map<string, { storage: string; products: number; kg: number; value: number }>();
        for (const r of rows) {
          const k = String(r.storage);
          const a = by.get(k) ?? { storage: k, products: 0, kg: 0, value: 0 };
          a.products += 1;
          a.kg += r.kg;
          a.value += r.value ?? 0;
          by.set(k, a);
        }
        const srows = [...by.values()];
        return {
          title: t.reports.storage,
          columns: [{ key: "storage", header: t.fields.storage }, { key: "products", header: t.fields.products, kind: "number", align: "end" }, { key: "kg", header: c.kg, kind: "number", align: "end" }, ...(showValue ? ([{ key: "value", header: t.inventory.value, kind: "money", align: "end" }] as ReportCol[]) : [])],
          rows: srows,
          totals: sum(srows, ["products", "kg", ...(showValue ? ["value"] : [])]),
        };
      }
      rows = rows.sort((a, b) => String(a.product).localeCompare(String(b.product)));
      return {
        title: t.reports.inventory,
        columns: [
          { key: "sku", header: t.fields.sku },
          { key: "product", header: t.fields.product },
          { key: "storage", header: t.fields.storage },
          { key: "qty", header: t.fields.onHand, kind: "number", align: "end" },
          { key: "unit", header: t.fields.unit },
          { key: "kg", header: c.kg, kind: "number", align: "end" },
          ...(showValue ? ([{ key: "value", header: t.inventory.value, kind: "money", align: "end" }] as ReportCol[]) : []),
        ],
        rows,
        totals: sum(rows, ["kg", ...(showValue ? ["value"] : [])]),
      };
    }
    case "receivables":
    case "payables": {
      const { data } = await supabase.rpc("report_ageing", { p_type: name === "receivables" ? "customer" : "supplier" });
      const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, name: nm(r) }));
      const keys = ["balance", "current_30", "days_31_60", "days_61_90", "over_90", "pending_verification"];
      return {
        title: name === "receivables" ? t.reports.receivables : t.reports.payables,
        columns: [
          { key: "code", header: c.code },
          { key: "name", header: c.name },
          { key: "phone", header: c.phone },
          { key: "balance", header: c.balance, kind: "money", align: "end" },
          { key: "current_30", header: t.reports.current, kind: "money", align: "end" },
          { key: "days_31_60", header: t.reports.d31, kind: "money", align: "end" },
          { key: "days_61_90", header: t.reports.d61, kind: "money", align: "end" },
          { key: "over_90", header: t.reports.d90, kind: "money", align: "end" },
          { key: "pending_verification", header: t.status.pending_verification, kind: "money", align: "end" },
        ],
        rows,
        totals: sum(rows, keys),
      };
    }
    case "commissions": {
      const { data } = await supabase.rpc("report_commissions", { p_start: p.from, p_end: p.to });
      const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, name: nm(r), kind: t.driverKinds[r.kind as "driver"], rule: t.commissionTypes[r.rule as "none"] }));
      return {
        title: t.reports.commissions,
        columns: [
          { key: "code", header: c.code },
          { key: "name", header: c.name },
          { key: "kind", header: t.fields.kind },
          { key: "rule", header: t.fields.commissionRule },
          { key: "invoices", header: t.customers.invoices, kind: "number", align: "end" },
          { key: "earned", header: t.drivers.earned, kind: "money", align: "end" },
          { key: "paid", header: t.drivers.paidOut, kind: "money", align: "end" },
          { key: "outstanding", header: t.drivers.owed, kind: "money", align: "end" },
        ],
        rows,
        totals: sum(rows, ["invoices", "earned", "paid", "outstanding"]),
        note: `${t.drivers.owed}: ${c.balance}`,
      };
    }
    case "attendance": {
      const { data } = await supabase.rpc("report_attendance", { p_start: p.from, p_end: p.to });
      const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, name: ar ? r.full_name_ar || r.full_name : r.full_name }));
      const keys = ["present", "late", "half_day", "absent", "on_leave", "holiday", "late_minutes", "worked_hours", "overtime_hours", "manual_entries"];
      return {
        title: t.reports.attendance,
        columns: [
          { key: "employee_no", header: c.code },
          { key: "name", header: c.name },
          { key: "department", header: t.fields.department },
          { key: "present", header: t.status.present, kind: "number", align: "end" },
          { key: "late", header: t.status.late, kind: "number", align: "end" },
          { key: "half_day", header: t.status.half_day, kind: "number", align: "end" },
          { key: "absent", header: t.status.absent, kind: "number", align: "end" },
          { key: "on_leave", header: t.status.on_leave, kind: "number", align: "end" },
          { key: "late_minutes", header: `${t.status.late} (min)`, kind: "number", align: "end" },
          { key: "worked_hours", header: t.payroll.hours, kind: "number", align: "end" },
          { key: "overtime_hours", header: t.payroll.overtime, kind: "number", align: "end" },
          { key: "manual_entries", header: t.attendance.manualFlag, kind: "number", align: "end" },
        ],
        rows,
        totals: sum(rows, keys),
      };
    }
    case "payroll": {
      const { data } = await supabase.from("payroll_items").select("net_pay, paid_amount, base_earned, overtime_amount, bonus, late_deduction, absence_deduction, half_day_deduction, advance_deduction, other_deduction, employees(employee_no, full_name, full_name_ar), payroll_runs!inner(run_no, period_start, period_end, status)").gte("payroll_runs.period_end", p.from).lte("payroll_runs.period_start", p.to).neq("payroll_runs.status", "cancelled");
      const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
        const e = r.employees as Record<string, string>;
        const run = r.payroll_runs as Record<string, string>;
        const n = (k: string) => Number(r[k] ?? 0);
        return {
          run: run.run_no,
          status: run.status,
          employee: ar ? e.full_name_ar || e.full_name : e.full_name,
          earnings: n("base_earned") + n("overtime_amount") + n("bonus"),
          deductions: n("late_deduction") + n("absence_deduction") + n("half_day_deduction") + n("advance_deduction") + n("other_deduction"),
          net_pay: n("net_pay"),
          paid_amount: n("paid_amount"),
        };
      });
      return {
        title: t.reports.payroll,
        columns: [
          { key: "run", header: t.payroll.runs },
          { key: "employee", header: t.fields.employee },
          { key: "status", header: c.status, kind: "status" },
          { key: "earnings", header: t.payroll.base, kind: "money", align: "end" },
          { key: "deductions", header: t.payroll.otherDeduction, kind: "money", align: "end" },
          { key: "net_pay", header: t.payroll.net, kind: "money", align: "end" },
          { key: "paid_amount", header: t.fields.paid, kind: "money", align: "end" },
        ],
        rows,
        totals: sum(rows, ["earnings", "deductions", "net_pay", "paid_amount"]),
      };
    }
    case "expenses": {
      const { data } = await supabase.rpc("report_expenses_by_category", { p_start: p.from, p_end: p.to });
      const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, name: nm(r) }));
      return {
        title: t.reports.expenses,
        columns: [{ key: "name", header: t.fields.category }, { key: "entries", header: c.rows, kind: "number", align: "end" }, { key: "amount", header: c.amount, kind: "money", align: "end" }, { key: "vat", header: c.vat, kind: "money", align: "end" }],
        rows,
        totals: sum(rows, ["entries", "amount", "vat"]),
      };
    }
    case "cashbank": {
      const [{ data: accounts }, { data: lines }] = await Promise.all([
        supabase.from("v_money_balances").select("*"),
        supabase.from("journal_lines").select("money_account_id, debit, credit, journal_entries!inner(entry_date)").not("money_account_id", "is", null).gte("journal_entries.entry_date", p.from).lte("journal_entries.entry_date", p.to),
      ]);
      const flow = new Map<string, { inflow: number; outflow: number }>();
      for (const l of (lines ?? []) as unknown as { money_account_id: string; debit: number; credit: number }[]) {
        const f = flow.get(l.money_account_id) ?? { inflow: 0, outflow: 0 };
        f.inflow += Number(l.debit);
        f.outflow += Number(l.credit);
        flow.set(l.money_account_id, f);
      }
      const rows = ((accounts ?? []) as Record<string, unknown>[]).map((a) => ({ name: nm(a), kind: t.cash.kinds[a.kind as "cash"], inflow: flow.get(String(a.id))?.inflow ?? 0, outflow: flow.get(String(a.id))?.outflow ?? 0, balance: Number(a.balance) }));
      return {
        title: t.reports.cashbank,
        columns: [{ key: "name", header: t.fields.account }, { key: "kind", header: c.type }, { key: "inflow", header: t.reports.debit, kind: "money", align: "end" }, { key: "outflow", header: t.reports.credit, kind: "money", align: "end" }, { key: "balance", header: c.balance, kind: "money", align: "end" }],
        rows,
        totals: sum(rows, ["inflow", "outflow", "balance"]),
      };
    }
    case "investors": {
      const { data } = await supabase.from("v_investment_summary").select("*, investors(name, name_ar, investor_no)");
      const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        investor: nm(r.investors as Record<string, unknown>),
        investment: r.investment_no,
        model: t.models[r.model as "loan"],
        capital_in: Number(r.capital_in),
        capital_returned: Number(r.capital_returned),
        capital_balance: Number(r.capital_balance),
        profit_earned: Number(r.profit_earned),
        profit_paid: Number(r.profit_paid),
        profit_outstanding: Number(r.profit_outstanding),
      }));
      return {
        title: t.reports.investors,
        columns: [
          { key: "investor", header: t.fields.investor },
          { key: "investment", header: t.fields.investment },
          { key: "model", header: t.fields.model },
          { key: "capital_in", header: t.investors.capitalIn, kind: "money", align: "end" },
          { key: "capital_returned", header: t.investors.capitalReturned, kind: "money", align: "end" },
          { key: "capital_balance", header: t.investors.capitalBalance, kind: "money", align: "end" },
          { key: "profit_earned", header: t.investors.profitEarned, kind: "money", align: "end" },
          { key: "profit_paid", header: t.investors.profitPaid, kind: "money", align: "end" },
          { key: "profit_outstanding", header: t.investors.profitOutstanding, kind: "money", align: "end" },
        ],
        rows,
        totals: sum(rows, ["capital_in", "capital_returned", "capital_balance", "profit_earned", "profit_paid", "profit_outstanding"]),
      };
    }
    case "trial": {
      const { data } = await supabase.rpc("trial_balance");
      const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ code: r.code, name: nm(r), debit: Number(r.debit), credit: Number(r.credit) }));
      const totals = sum(rows, ["debit", "credit"]);
      return {
        title: t.reports.trial,
        columns: [{ key: "code", header: c.code }, { key: "name", header: c.description }, { key: "debit", header: t.reports.debit, kind: "money", align: "end" }, { key: "credit", header: t.reports.credit, kind: "money", align: "end" }],
        rows,
        totals,
        note: Math.abs(totals.debit - totals.credit) < 0.005 ? t.reports.balanced : t.reports.unbalanced,
      };
    }
  }
}
