import "server-only";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const money = (v: number) => new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

type Company = { name_en: string; name_ar: string; phone?: string | null; whatsapp?: string | null; email?: string | null; address_en?: string | null };

function layout(company: Company, title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3eddf;font-family:Segoe UI,Arial,sans-serif;color:#1f2420">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3eddf;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#173d32;padding:22px 28px;color:#f8f4eb">
  <div style="font-family:Georgia,serif;font-size:22px;font-weight:bold">${esc(company.name_en)}</div>
  <div style="font-size:16px;color:#e2cb98" dir="rtl">${esc(company.name_ar)}</div>
</td></tr>
<tr><td style="padding:26px 28px">
  <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:#173d32">${esc(title)}</h1>
  ${body}
</td></tr>
<tr><td style="padding:16px 28px;background:#f8f4eb;font-size:12px;color:#6b6a62">
  ${esc([company.address_en, company.phone, company.whatsapp ? `WhatsApp ${company.whatsapp}` : null, company.email].filter(Boolean).join(" · "))}
</td></tr>
</table></td></tr></table></body></html>`;
}

const table = (head: string[], rows: (string | number)[][], alignEndFrom = 1) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:12px 0">
<tr>${head.map((h, i) => `<th style="background:#173d32;color:#fff;padding:7px 8px;text-align:${i >= alignEndFrom ? "right" : "left"};font-weight:600">${esc(h)}</th>`).join("")}</tr>
${rows.map((r) => `<tr>${r.map((c, i) => `<td style="border-bottom:1px solid #e6dfd0;padding:7px 8px;text-align:${i >= alignEndFrom ? "right" : "left"}">${esc(c)}</td>`).join("")}</tr>`).join("")}
</table>`;

export function credentialsEmail(company: Company, u: { name: string; email: string; password: string; role: string; reset?: boolean }) {
  const title = u.reset ? "Your password was reset · تم إعادة تعيين كلمة المرور" : "Your staff account · حسابك في النظام";
  const body = `
<p style="margin:0 0 12px">Hello ${esc(u.name)},</p>
<p style="margin:0 0 12px">${u.reset ? "A new temporary password has been set for your account." : `An account has been created for you in the ${esc(company.name_en)} business system (role: <b>${esc(u.role)}</b>).`}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#f8f4eb;border-radius:10px;padding:14px 16px;margin:14px 0;font-size:14px">
<tr><td style="padding:3px 12px 3px 0;color:#6b6a62">Login</td><td><a href="${site()}/erp/login" style="color:#173d32">${site()}/erp/login</a></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b6a62">Email</td><td><b>${esc(u.email)}</b></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b6a62">Password</td><td><b style="font-family:Consolas,monospace;font-size:15px">${esc(u.password)}</b></td></tr>
</table>
<p style="margin:0 0 12px">Please sign in and change this password under <b>My profile</b>. Do not share it with anyone.</p>
<p dir="rtl" style="margin:16px 0 0;text-align:right">مرحباً ${esc(u.name)}، تم ${u.reset ? "تعيين كلمة مرور مؤقتة جديدة لحسابك" : "إنشاء حساب لك في النظام"}. سجّل الدخول من الرابط أعلاه بالبريد وكلمة المرور، ثم غيّر كلمة المرور من «ملفي».</p>`;
  return { subject: `${company.name_en} — ${u.reset ? "password reset" : "your login details"}`, html: layout(company, title, body) };
}

export type InvoiceMail = {
  invoice_no: string;
  date: string;
  customer: string;
  currency: string;
  fx_rate: number;
  lines: { name: string; qty: number; unit: string; price_fc: number | null; price_sar: number; total_sar: number }[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paid: number;
  due: number;
  status: string;
};

export function invoiceEmail(company: Company, inv: InvoiceMail) {
  const fx = inv.currency !== "SAR";
  const rows = inv.lines.map((l) => [l.name, `${l.qty} ${l.unit}`, fx && l.price_fc !== null ? `${inv.currency} ${money(l.price_fc)}` : money(l.price_sar), money(l.total_sar)]);
  const body = `
<p style="margin:0 0 6px">Dear ${esc(inv.customer)},</p>
<p style="margin:0 0 12px">Thank you for your purchase. Here is your invoice <b>${esc(inv.invoice_no)}</b> dated ${esc(inv.date)}.</p>
${table(["Item / الصنف", "Qty / الكمية", fx ? `Price (${inv.currency})` : "Price / السعر", "Total (SAR)"], rows)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
<tr><td style="padding:3px 0;color:#6b6a62">Subtotal</td><td align="right">SAR ${money(inv.subtotal)}</td></tr>
${inv.discount ? `<tr><td style="padding:3px 0;color:#6b6a62">Discount</td><td align="right">− SAR ${money(inv.discount)}</td></tr>` : ""}
${inv.vat ? `<tr><td style="padding:3px 0;color:#6b6a62">VAT</td><td align="right">SAR ${money(inv.vat)}</td></tr>` : ""}
<tr><td style="padding:8px 0;font-weight:bold;color:#173d32;border-top:2px solid #173d32">Total / الإجمالي</td><td align="right" style="font-weight:bold;color:#173d32;border-top:2px solid #173d32">SAR ${money(inv.total)}</td></tr>
<tr><td style="padding:3px 0;color:#6b6a62">Paid / المدفوع</td><td align="right">SAR ${money(inv.paid)}</td></tr>
<tr><td style="padding:3px 0;font-weight:bold">Balance due / المتبقي</td><td align="right" style="font-weight:bold">SAR ${money(inv.due)}</td></tr>
</table>
${fx ? `<p style="font-size:12px;color:#6b6a62;margin:12px 0 0">Prices agreed in ${esc(inv.currency)} at 1 ${esc(inv.currency)} = ${inv.fx_rate.toFixed(4)} SAR.</p>` : ""}
<p dir="rtl" style="margin:16px 0 0;text-align:right">عميلنا العزيز ${esc(inv.customer)}، شكراً لتعاملكم معنا. هذه فاتورتكم رقم ${esc(inv.invoice_no)}.</p>`;
  return { subject: `${company.name_en} — Invoice ${inv.invoice_no}`, html: layout(company, `Invoice ${inv.invoice_no} · فاتورة`, body) };
}

export type DailyReport = {
  date: string;
  invoices: number;
  salesTotal: number;
  byCurrency: { currency: string; invoices: number; sar: number }[];
  products: { name: string; qty: number; unit: string; amount: number }[];
  payments: { method: string; amount: number }[];
  pending: number;
  expenses: number;
  purchases: number;
  stock: { name: string; qty: number; unit: string; min: number; low: boolean }[];
};

export function dailyReportEmail(company: Company, r: DailyReport) {
  const low = r.stock.filter((s) => s.low);
  const body = `
<p style="margin:0 0 14px;color:#6b6a62">Daily summary for <b style="color:#1f2420">${esc(r.date)}</b> (Saudi time).</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr>
${[["Sales (SAR)", money(r.salesTotal)], ["Invoices", String(r.invoices)], ["Purchases", money(r.purchases)], ["Expenses", money(r.expenses)]]
  .map(([k, v]) => `<td style="background:#f8f4eb;border-radius:10px;padding:10px 12px;width:25%"><div style="font-size:11px;color:#6b6a62">${k}</div><div style="font-size:18px;font-weight:bold;color:#173d32">${v}</div></td><td width="6"></td>`)
  .join("")}
</tr></table>
<h2 style="font-size:16px;color:#173d32;margin:18px 0 0">Sales by product · المبيعات حسب المنتج</h2>
${r.products.length ? table(["Product", "Qty", "Amount (SAR)"], r.products.map((p) => [p.name, `${p.qty} ${p.unit}`, money(p.amount)])) : '<p style="color:#6b6a62">No sales today.</p>'}
${r.byCurrency.length > 1 || (r.byCurrency[0] && r.byCurrency[0].currency !== "SAR") ? `<h2 style="font-size:16px;color:#173d32;margin:18px 0 0">By currency</h2>${table(["Currency", "Invoices", "SAR"], r.byCurrency.map((c) => [c.currency, c.invoices, money(c.sar)]))}` : ""}
<h2 style="font-size:16px;color:#173d32;margin:18px 0 0">Money received · المقبوضات</h2>
${r.payments.length ? table(["Method", "Amount (SAR)"], r.payments.map((p) => [p.method, money(p.amount)])) : '<p style="color:#6b6a62">No verified receipts today.</p>'}
${r.pending ? `<p style="color:#8f7036;font-size:13px">Bank transfers waiting for verification: SAR ${money(r.pending)}</p>` : ""}
<h2 style="font-size:16px;color:#173d32;margin:18px 0 0">Stock on hand · المخزون${low.length ? ` — <span style="color:#b3412e">${low.length} low</span>` : ""}</h2>
${table(["Product", "On hand", "Minimum"], r.stock.map((s) => [`${s.low ? "⚠ " : ""}${s.name}`, `${s.qty} ${s.unit}`, s.min]))}
<p style="margin:16px 0 0;font-size:12px"><a href="${site()}/erp" style="color:#173d32">Open the dashboard</a></p>`;
  return { subject: `${company.name_en} — Daily report ${r.date}`, html: layout(company, `Daily sales & stock report · التقرير اليومي`, body) };
}
