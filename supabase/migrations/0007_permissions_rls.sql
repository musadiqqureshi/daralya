-- =====================================================================
-- 0007 PERMISSIONS, ROLE MATRIX, ROW-LEVEL SECURITY, GRANTS
-- =====================================================================

insert into public.permissions (code, module, label_en, label_ar) values
  ('dashboard.view', 'dashboard', 'View dashboard', 'عرض لوحة التحكم'),
  ('dashboard.financials', 'dashboard', 'View financial figures on dashboard', 'عرض الأرقام المالية في اللوحة'),
  ('customers.view', 'customers', 'View customers', 'عرض العملاء'),
  ('customers.manage', 'customers', 'Add and edit customers', 'إضافة وتعديل العملاء'),
  ('suppliers.view', 'suppliers', 'View suppliers', 'عرض الموردين'),
  ('suppliers.manage', 'suppliers', 'Add and edit suppliers', 'إضافة وتعديل الموردين'),
  ('products.view', 'products', 'View products', 'عرض المنتجات'),
  ('products.manage', 'products', 'Add and edit products', 'إضافة وتعديل المنتجات'),
  ('products.view_cost', 'products', 'See purchase prices and costs', 'عرض أسعار الشراء والتكاليف'),
  ('purchases.view', 'purchases', 'View purchases', 'عرض المشتريات'),
  ('purchases.create', 'purchases', 'Record purchases and returns', 'تسجيل المشتريات والمرتجعات'),
  ('purchases.cancel', 'purchases', 'Cancel purchases', 'إلغاء المشتريات'),
  ('sales.view', 'sales', 'View sales invoices', 'عرض فواتير المبيعات'),
  ('sales.create', 'sales', 'Create invoices and returns', 'إنشاء الفواتير والمرتجعات'),
  ('sales.cancel', 'sales', 'Cancel invoices', 'إلغاء الفواتير'),
  ('sales.price_override', 'sales', 'Sell below list price', 'البيع بأقل من سعر القائمة'),
  ('sales.credit_override', 'sales', 'Exceed customer credit limit', 'تجاوز حد الائتمان'),
  ('sales.collect', 'sales', 'Collect customer payments', 'تحصيل دفعات العملاء'),
  ('inventory.view', 'inventory', 'View stock', 'عرض المخزون'),
  ('inventory.transfer', 'inventory', 'Transfer between storages', 'التحويل بين المستودعات'),
  ('inventory.adjust_request', 'inventory', 'Request damage, wastage and adjustments', 'طلب تسجيل التلف والهدر والتسويات'),
  ('inventory.adjust_approve', 'inventory', 'Approve stock adjustments', 'اعتماد تسويات المخزون'),
  ('storage.manage', 'storage', 'Manage cold storages', 'إدارة المستودعات المبردة'),
  ('storage.temperature', 'storage', 'Record temperature logs', 'تسجيل درجات الحرارة'),
  ('drivers.view', 'drivers', 'View drivers and agents', 'عرض السائقين والمناديب'),
  ('drivers.manage', 'drivers', 'Add and edit drivers and agents', 'إضافة وتعديل السائقين والمناديب'),
  ('commissions.view', 'drivers', 'View commissions', 'عرض العمولات'),
  ('commissions.own', 'drivers', 'View own commission statement', 'عرض كشف العمولة الخاص'),
  ('deliveries.view', 'deliveries', 'View deliveries', 'عرض التوصيلات'),
  ('deliveries.manage', 'deliveries', 'Create and manage deliveries', 'إنشاء وإدارة التوصيلات'),
  ('deliveries.own', 'deliveries', 'Update own deliveries', 'تحديث التوصيلات الخاصة'),
  ('employees.view', 'staff', 'View staff', 'عرض الموظفين'),
  ('employees.manage', 'staff', 'Add, edit and deactivate staff', 'إضافة وتعديل وإيقاف الموظفين'),
  ('attendance.view', 'attendance', 'View attendance', 'عرض الحضور'),
  ('attendance.mark', 'attendance', 'Mark attendance with camera', 'تسجيل الحضور بالكاميرا'),
  ('attendance.manual', 'attendance', 'Manual attendance fallback (no photo)', 'تسجيل حضور يدوي بدون صورة'),
  ('attendance.correct', 'attendance', 'Correct attendance records', 'تصحيح سجلات الحضور'),
  ('attendance.photos', 'attendance', 'View attendance photographs', 'عرض صور الحضور'),
  ('payroll.view', 'payroll', 'View payroll', 'عرض الرواتب'),
  ('payroll.prepare', 'payroll', 'Prepare payroll and salary payments', 'إعداد الرواتب ودفعها'),
  ('payroll.approve', 'payroll', 'Approve payroll', 'اعتماد الرواتب'),
  ('expenses.view', 'expenses', 'View expenses', 'عرض المصروفات'),
  ('expenses.create', 'expenses', 'Record expenses', 'تسجيل المصروفات'),
  ('payments.view', 'payments', 'View payments', 'عرض الدفعات'),
  ('payments.create', 'payments', 'Record payments', 'تسجيل الدفعات'),
  ('payments.verify', 'payments', 'Verify bank transfers', 'التحقق من التحويلات البنكية'),
  ('payments.cancel', 'payments', 'Cancel or reverse payments', 'إلغاء أو عكس الدفعات'),
  ('accounts.view', 'accounts', 'View cash and bank', 'عرض النقدية والبنوك'),
  ('accounts.manage', 'accounts', 'Manage cash and bank accounts', 'إدارة حسابات النقدية والبنوك'),
  ('accounts.transfer', 'accounts', 'Transfer between accounts', 'التحويل بين الحسابات'),
  ('accounts.close', 'accounts', 'Daily cash closing', 'إقفال الصندوق اليومي'),
  ('finance.adjust', 'accounts', 'Financial adjustments and cancellations', 'التسويات والإلغاءات المالية'),
  ('investors.view', 'investors', 'View investors', 'عرض المستثمرين'),
  ('investors.manage', 'investors', 'Manage investors and investments', 'إدارة المستثمرين والاستثمارات'),
  ('investors.approve_profit', 'investors', 'Approve profit distributions', 'اعتماد توزيعات الأرباح'),
  ('reports.view', 'reports', 'View operational reports', 'عرض التقارير التشغيلية'),
  ('reports.financial', 'reports', 'View financial reports (P&L, costs)', 'عرض التقارير المالية'),
  ('website.manage', 'website', 'Manage public website', 'إدارة الموقع العام'),
  ('inquiries.view', 'website', 'View contact inquiries', 'عرض استفسارات التواصل'),
  ('users.manage', 'admin', 'Manage users and permissions', 'إدارة المستخدمين والصلاحيات'),
  ('settings.manage', 'admin', 'Manage settings', 'إدارة الإعدادات'),
  ('audit.view', 'admin', 'View audit logs', 'عرض سجل التدقيق');

-- Owner bypasses the matrix (has everything). Others:
insert into public.role_permissions (role, permission)
select 'manager'::public.app_role, unnest(array[
  'dashboard.view', 'customers.view', 'customers.manage', 'suppliers.view', 'suppliers.manage',
  'products.view', 'products.manage', 'products.view_cost', 'purchases.view', 'purchases.create',
  'sales.view', 'sales.create', 'sales.collect', 'inventory.view', 'inventory.transfer', 'inventory.adjust_request',
  'inventory.adjust_approve', 'storage.manage', 'storage.temperature', 'drivers.view', 'drivers.manage', 'commissions.view',
  'deliveries.view', 'deliveries.manage', 'employees.view', 'employees.manage', 'attendance.view', 'attendance.mark',
  'attendance.manual', 'attendance.photos', 'payments.view', 'reports.view', 'inquiries.view'])
union all
select 'accountant'::public.app_role, unnest(array[
  'dashboard.view', 'dashboard.financials', 'customers.view', 'suppliers.view', 'products.view', 'products.view_cost',
  'purchases.view', 'sales.view', 'drivers.view', 'commissions.view', 'deliveries.view', 'employees.view',
  'attendance.view', 'payroll.view', 'payroll.prepare', 'expenses.view', 'expenses.create',
  'payments.view', 'payments.create', 'payments.verify', 'accounts.view', 'accounts.manage', 'accounts.transfer',
  'accounts.close', 'investors.view', 'investors.manage', 'reports.view', 'reports.financial', 'inventory.view'])
union all
select 'sales'::public.app_role, unnest(array[
  'dashboard.view', 'customers.view', 'customers.manage', 'products.view', 'sales.view', 'sales.create', 'sales.collect',
  'deliveries.view', 'payments.view', 'inventory.view', 'drivers.view'])
union all
select 'warehouse'::public.app_role, unnest(array[
  'dashboard.view', 'products.view', 'inventory.view', 'inventory.transfer', 'inventory.adjust_request', 'storage.temperature',
  'deliveries.view'])
union all
select 'driver'::public.app_role, unnest(array['deliveries.own', 'commissions.own']);

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active)
$$;

-- Helper to declare "read with X, write with Y" policies quickly
create or replace function app.policy_rw(p_table text, p_read text, p_write text) returns void
language plpgsql as $$
begin
  execute format('create policy %I on public.%I for select to authenticated using (%s)', p_table || '_read', p_table, p_read);
  if p_write is not null then
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_table || '_insert', p_table, p_write);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p_table || '_update', p_table, p_write, p_write);
  end if;
end $$;

select app.policy_rw('settings', 'app.is_staff()', null);
create policy settings_update on public.settings for update to authenticated
  using (app.has_perm('settings.manage')) with check (app.has_perm('settings.manage'));
select app.policy_rw('invoice_qr_codes', 'app.is_staff()', 'app.has_perm(''settings.manage'')');
create policy invoice_qr_codes_delete on public.invoice_qr_codes for delete to authenticated using (app.has_perm('settings.manage'));
select app.policy_rw('permissions', 'app.is_staff()', null);
select app.policy_rw('role_permissions', 'app.is_staff()', null);
select app.policy_rw('profiles', 'app.is_staff()', 'app.has_perm(''users.manage'')');
select app.policy_rw('user_permissions', 'user_id = auth.uid() or app.has_perm(''users.manage'')', 'app.has_perm(''users.manage'')');
create policy user_permissions_delete on public.user_permissions for delete to authenticated using (app.has_perm('users.manage'));
select app.policy_rw('audit_logs', 'app.has_perm(''audit.view'')', null);
select app.policy_rw('gl_accounts', 'app.is_staff()', null);
select app.policy_rw('money_accounts',
  'app.has_perm(''accounts.view'') or app.has_perm(''payments.create'') or app.has_perm(''sales.collect'') or app.has_perm(''expenses.create'') or app.has_perm(''purchases.create'')',
  'app.has_perm(''accounts.manage'')');
select app.policy_rw('payment_methods', 'app.is_staff()', 'app.has_perm(''settings.manage'')');
select app.policy_rw('drivers',
  'app.has_perm(''drivers.view'') or app.has_perm(''sales.create'') or app.has_perm(''deliveries.view'') or id = app.my_driver_id()',
  'app.has_perm(''drivers.manage'')');
select app.policy_rw('customers',
  'app.has_perm(''customers.view'') or app.has_perm(''sales.create'') or app.has_perm(''deliveries.view'') or (driver_id is not null and driver_id = app.my_driver_id())',
  'app.has_perm(''customers.manage'')');
select app.policy_rw('suppliers', 'app.has_perm(''suppliers.view'') or app.has_perm(''purchases.view'')', 'app.has_perm(''suppliers.manage'')');
select app.policy_rw('products', 'app.is_staff()', 'app.has_perm(''products.manage'')');
select app.policy_rw('product_images', 'app.is_staff()', 'app.has_perm(''products.manage'') or app.has_perm(''website.manage'')');
create policy product_images_delete on public.product_images for delete to authenticated
  using (app.has_perm('products.manage') or app.has_perm('website.manage'));
select app.policy_rw('storages', 'app.is_staff()', 'app.has_perm(''storage.manage'')');
select app.policy_rw('temperature_logs', 'app.has_perm(''inventory.view'')', null);
create policy temperature_logs_insert on public.temperature_logs for insert to authenticated with check (app.has_perm('storage.temperature'));
select app.policy_rw('expense_categories', 'app.is_staff()', 'app.has_perm(''settings.manage'')');

-- Ledger: readers see only the lines their role covers (cost lines need financial access)
select app.policy_rw('journal_entries', 'app.has_perm(''accounts.view'') or app.has_perm(''reports.financial'') or app.has_perm(''audit.view'')', null);
select app.policy_rw('journal_lines', $p$
  app.has_perm('reports.financial')
  or (money_account_id is not null and app.has_perm('accounts.view'))
  or (party_type = 'customer' and app.has_perm('customers.view'))
  or (party_type = 'supplier' and app.has_perm('suppliers.view'))
  or (party_type = 'driver' and (app.has_perm('commissions.view') or party_id = app.my_driver_id()))
  or (party_type = 'employee' and app.has_perm('payroll.view'))
  or (party_type = 'investor' and app.has_perm('investors.view'))
$p$, null);

select app.policy_rw('stock_batches', 'app.has_perm(''inventory.view'') or app.has_perm(''purchases.view'')', null);
select app.policy_rw('stock_movements', 'app.has_perm(''inventory.view'')', null);
select app.policy_rw('stock_transfers', 'app.has_perm(''inventory.view'')', null);
select app.policy_rw('stock_transfer_items', 'app.has_perm(''inventory.view'')', null);
select app.policy_rw('stock_adjustments', 'app.has_perm(''inventory.view'')', null);
select app.policy_rw('stock_adjustment_items', 'app.has_perm(''inventory.view'')', null);
select app.policy_rw('purchases', 'app.has_perm(''purchases.view'')', null);
select app.policy_rw('purchase_items', 'app.has_perm(''purchases.view'')', null);
select app.policy_rw('purchase_returns', 'app.has_perm(''purchases.view'')', null);
select app.policy_rw('purchase_return_items', 'app.has_perm(''purchases.view'')', null);
select app.policy_rw('sales', 'app.has_perm(''sales.view'') or (driver_id is not null and driver_id = app.my_driver_id())', null);
select app.policy_rw('sale_items', 'exists (select 1 from public.sales s where s.id = sale_id)', null);
select app.policy_rw('sale_returns', 'app.has_perm(''sales.view'')', null);
select app.policy_rw('sale_return_items', 'app.has_perm(''sales.view'')', null);
select app.policy_rw('commissions', 'app.has_perm(''commissions.view'') or driver_id = app.my_driver_id()', null);
select app.policy_rw('deliveries', 'app.has_perm(''deliveries.view'') or (driver_id is not null and driver_id = app.my_driver_id())', null);
select app.policy_rw('delivery_events', 'exists (select 1 from public.deliveries d where d.id = delivery_id)', null);
select app.policy_rw('payments', $p$
  app.has_perm('payments.view') or app.has_perm('accounts.view')
  or (party_type = 'driver' and party_id = app.my_driver_id())
$p$, null);
select app.policy_rw('payment_allocations', 'exists (select 1 from public.payments p where p.id = payment_id)', null);
select app.policy_rw('expenses', 'app.has_perm(''expenses.view'')', null);
select app.policy_rw('money_transfers', 'app.has_perm(''accounts.view'')', null);
select app.policy_rw('cash_closings', 'app.has_perm(''accounts.view'')', null);
select app.policy_rw('work_schedules', 'app.is_staff()', 'app.has_perm(''employees.manage'')');
select app.policy_rw('employees',
  'app.has_perm(''employees.view'') or app.has_perm(''attendance.mark'') or app.has_perm(''payroll.view'') or user_id = auth.uid()',
  'app.has_perm(''employees.manage'')');
select app.policy_rw('holidays', 'app.is_staff()', 'app.has_perm(''employees.manage'')');
create policy holidays_delete on public.holidays for delete to authenticated using (app.has_perm('employees.manage'));
select app.policy_rw('leave_records', 'app.has_perm(''employees.view'') or app.has_perm(''attendance.view'')', 'app.has_perm(''employees.manage'')');
select app.policy_rw('attendance', 'app.has_perm(''attendance.view'') or app.has_perm(''attendance.mark'')', null);
select app.policy_rw('attendance_corrections', 'app.has_perm(''attendance.view'')', null);
select app.policy_rw('payroll_runs', 'app.has_perm(''payroll.view'')', null);
select app.policy_rw('payroll_items', 'app.has_perm(''payroll.view'')', null);
select app.policy_rw('investors', 'app.has_perm(''investors.view'')', 'app.has_perm(''investors.manage'')');
select app.policy_rw('investments', 'app.has_perm(''investors.view'')', 'app.has_perm(''investors.manage'')');
select app.policy_rw('profit_allocations', 'app.has_perm(''investors.view'')', null);
select app.policy_rw('site_content', 'app.has_perm(''website.manage'')', 'app.has_perm(''website.manage'')');
select app.policy_rw('contact_inquiries', 'app.has_perm(''inquiries.view'')', null);
create policy contact_inquiries_update on public.contact_inquiries for update to authenticated
  using (app.has_perm('inquiries.view')) with check (app.has_perm('inquiries.view'));

-- ---------------------------------------------------------------------
-- Column privileges: costs, margins and commissions are hidden from the API
-- for everyone; authorised screens read them through permission-checked
-- functions (see 0009_reports).
-- ---------------------------------------------------------------------
create or replace function app.hide_columns(p_table text, p_cols text[]) returns void
language plpgsql as $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table and column_name <> all (p_cols);
  execute format('revoke select on public.%I from anon, authenticated', p_table);
  execute format('grant select (%s) on public.%I to authenticated', v_cols, p_table);
end $$;

select app.hide_columns('products', array['purchase_price']);
select app.hide_columns('sales', array['cogs_total', 'commission_amount']);
select app.hide_columns('sale_items', array['cogs']);
select app.hide_columns('sale_returns', array['cost']);
select app.hide_columns('sale_return_items', array['cost']);
select app.hide_columns('stock_batches', array['unit_cost']);
select app.hide_columns('stock_movements', array['unit_cost']);

-- ---------------------------------------------------------------------
-- Function grants: only signed-in staff can call RPCs (each checks permissions)
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated, service_role;
grant execute on function app.has_perm(text), app.is_staff(), app.my_driver_id(), app.today(), app.tz() to anon;

-- Writes to transactional tables happen only inside security-definer functions
revoke all on all tables in schema public from anon;
grant select on public.v_public_products, public.v_public_content, public.v_public_company to anon, authenticated;

-- Public-facing views are owned by the migration role and bypass RLS on purpose; keep them read-only
revoke insert, update, delete on public.v_public_products, public.v_public_content, public.v_public_company from anon, authenticated;
