# Dar Al-Aaliya Dates — Website & ERP

Public bilingual (Arabic/English) company website plus a private ERP for buying, selling, stock, cold storage, deliveries, staff attendance, payroll, money and investors.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Supabase (Postgres, Auth, Storage) · TanStack Table · Recharts · Zod · ExcelJS · ZXing · Vercel.

---

## 1. First-time setup

### 1.1 Environment
Copy `.env.example` to `.env.local` and fill in values from the Supabase dashboard:

| Variable | Where | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys (publishable) | public |
| `SUPABASE_SECRET_KEY` | API Keys → secret (`sb_secret_…`) | **server only** |
| `SUPABASE_DB_URL` | Connect → Session pooler URI (with DB password) | **local tooling only** |
| `CRON_SECRET` | any long random string | server only |
| `NEXT_PUBLIC_SITE_URL` | your domain, e.g. `https://daraaliya.com` | public |

### 1.2 Database
```bash
npm install
npm run db:migrate        # applies supabase/migrations/*.sql in order, each in a transaction
npm run db:seed           # starter catalogue (from the paper invoice), storages, cash/bank, invoice QR codes
npm run db:create-owner -- owner@example.com "Owner Name"   # prints a one-time password
npm run dev
```
Sign in at `/erp/login`, then change the password under **My profile**. Create other staff under **Users & Permissions**.

### 1.3 Supabase Auth settings
- Authentication → URL configuration: set **Site URL** to `NEXT_PUBLIC_SITE_URL` and add `…/erp/auth/callback` to redirect URLs (password reset).
- Disable public sign-ups (Authentication → Providers → Email → *Allow new users to sign up* off). Staff accounts are created by the owner only.

---

## 2. Architecture

```
src/app/(site)/…        public website (reads only public views)
src/app/erp/(app)/…     ERP modules (server components + server actions)
src/app/print/…         A4 / 80 mm invoice, statement and payslip print views
src/app/api/export/…    Excel exports (same data as on screen)
src/app/api/cron/…      scheduled maintenance (attendance photo retention)
src/lib/erp/…           data loaders, reports, server helpers, schemas
supabase/migrations/    schema, posting engine, RLS, storage, reports
tests/db/               workflow tests on embedded Postgres (PGlite)
```

**One posting engine.** Every business event is a single Postgres function (`sale_create`, `purchase_create`, `payment_create`, `stock_transfer_create`, `payroll_approve`, …) that runs in one transaction and writes the document, stock movements and **double-entry journal lines** together. Balances (customers, suppliers, drivers, employees, investors, cash/bank, stock) are never stored — they are sums of the journal / stock movements, so all reports agree.

**Security in the database, not the browser.**
- Row-Level Security on every table; permissions are checked inside every function (`app.has_perm`).
- Costs, COGS, margins and commissions are **column-revoked** from the API and only returned by permission-checked functions. Customer invoices never read them.
- Writes to financial tables happen only through functions; direct inserts are refused.
- Financial records cannot be deleted (trigger) — they are cancelled with a reason and reversed in the ledger.
- Every change is written to `audit_logs` with the user and reason.
- The secret key is used only server-side (user administration, public contact form, cron).

**Roles:** Owner, Manager, Accountant, Sales, Warehouse, Driver — plus per-user grant/deny overrides (e.g. attendance correction, payroll approval, bank-transfer verification, financial adjustments).

---

## 3. Key workflows

| Area | Notes |
|---|---|
| Purchases | Extra transport/loading costs are spread over lines by value → landed cost per **batch**. Optional payment at entry. Returns and cancellation (only while untouched). |
| Sales | FIFO by batch per storage; no negative stock unless the owner allows it. Driver commission (fixed / % / per kg) is posted internally and never printed. Credit limit check. Barcode: hardware scanner or phone camera. |
| Payments | **Manual only** — cash, bank transfer, deposit, cheque. No gateway or bank API. Transfers/cheques stay *Pending verification* and are not cleared funds until verified. |
| Cold storage | Transfers move stock between storages in one transaction keeping batch identity; capacity enforced; temperature log with range alerts. |
| Attendance | Manager selects the employee → live camera (`getUserMedia`) → **Capture & mark attendance** uploads the frame to a private bucket and records attendance with **server time (Asia/Riyadh)**. Late is computed from the schedule + grace. Duplicate check-ins are blocked. Corrections need a reason and are logged. Manual fallback (no photo) needs its own permission and a reason. No face recognition. |
| Payroll | Generated from attendance as a **draft preview** (nothing deducted silently; unrecorded days are shown, advances are only recovered when entered). Approval posts to the ledger; salaries are then paid manually. |
| Investors | Capital and profit on separate ledgers. Profit allocations are drafts until approved; approved ones are adjusted, never edited. Example from the proposal is covered by a test (100,000 capital, 30 % of 40,000 → 12,000; 5,000 paid → 7,000 owed; capital unchanged). |
| Website CMS | Every homepage/about/quality/contact/footer/social/SEO text is editable as a draft and published on demand. Product visibility is controlled per product. |

---

## 4. Testing

```bash
npm test           # migrations + business workflows + RLS on embedded Postgres
npm run typecheck
npm run lint
npm run build
```
The database tests cover purchase → stock/batch/landed cost, FIFO sales with commission, pending vs verified bank transfers, returns, cancellations, transfers, capacity, damage approval, expenses, cash closing, investor ledgers, camera attendance rules, payroll, reports, and RLS (cost hiding, warehouse isolation, anonymous access). The trial balance is asserted to be zero after every step.

---

## 5. Deployment (Vercel)

1. Push this repository to GitHub and import it in Vercel.
2. Add the environment variables from §1.1 (not `SUPABASE_DB_URL`).
3. The cron in `vercel.json` runs the attendance-photo retention job daily (needs `CRON_SECRET`).
4. Point your domain at Vercel and update `NEXT_PUBLIC_SITE_URL` and the Supabase Auth URLs.
5. Recommended: Supabase **Pro** plan (daily backups, no project pausing). Test a restore before go-live.

---

## 6. Decisions & items to confirm before go-live

- **ZATCA e-invoicing.** When VAT is enabled the invoice prints the ZATCA simplified-invoice QR (TLV). Full Phase-2 integration (XML signing, clearance/reporting to ZATCA) is **not** included — confirm the client's VAT status.
- **PDF.** Invoices, statements and payslips are print-optimised pages (A4 and 80 mm) saved as PDF from the browser's print dialog; this renders Arabic correctly. Excel exports are generated on the server.
- **Photos.** Product and website images are free-licence Unsplash placeholders until real photos are uploaded (Products → Images, Website Management → image fields).
- **Content.** About/quality texts are neutral starting copy; replace with verified company information. Privacy/terms text should be reviewed by a qualified adviser.
- **Investments.** Structures should be reviewed by a qualified Saudi legal, accounting and Shariah adviser.
- **Payroll rules** (working days per month, overtime multiplier, late/absence deductions, half-day factor, paid leave) are configurable in Settings → Payroll; confirm them with the client.
- **Employee salaries** are visible to users with staff/attendance access at database level; the UI shows them only with payroll permission. Tighten with column privileges if required.
