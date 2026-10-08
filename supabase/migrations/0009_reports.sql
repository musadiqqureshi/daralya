-- =====================================================================
-- 0009 DASHBOARD & REPORTS (permission-checked, read-only)
-- All figures come from posted documents and the journal.
-- =====================================================================

create or replace function app.gl_sum(p_codes text[], p_start date, p_end date) returns numeric
language sql stable as $$
  select coalesce(sum(l.debit - l.credit), 0)
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.gl_code = any (p_codes) and e.entry_date between p_start and p_end
$$;

create or replace function app.gl_balance(p_codes text[]) returns numeric
language sql stable as $$
  select coalesce(sum(debit - credit), 0) from public.journal_lines where gl_code = any (p_codes)
$$;

create or replace function public.dashboard_summary(p_start date, p_end date) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  v jsonb := '{}'::jsonb;
  v_fin boolean := app.has_perm('dashboard.financials');
  v_today date := app.today();
  v_revenue numeric;
  v_cogs numeric;
begin
  perform app.require_perm('dashboard.view');
  v := v || jsonb_build_object('period', jsonb_build_object('start', p_start, 'end', p_end), 'financials', v_fin);

  if app.has_perm('sales.view') then
    v := v || jsonb_build_object(
      'sales_count', (select count(*) from public.sales where status = 'posted' and sale_date between p_start and p_end),
      'total_sales', (select coalesce(sum(total - returned_total), 0) from public.sales where status = 'posted' and sale_date between p_start and p_end),
      'today_revenue', (select coalesce(sum(taxable_amount), 0) from public.sales where status = 'posted' and sale_date = v_today),
      'today_invoices', (select count(*) from public.sales where status = 'posted' and sale_date = v_today),
      'sales_series', (
        select coalesce(jsonb_agg(jsonb_build_object('date', d::date,
          'sales', coalesce((select sum(taxable_amount) from public.sales s where s.status = 'posted' and s.sale_date = d::date), 0),
          'purchases', case when app.has_perm('purchases.view') then coalesce((select sum(subtotal) from public.purchases pu where pu.status = 'posted' and pu.purchase_date = d::date), 0) end,
          'profit', case when v_fin then
            (select coalesce(sum(l.credit - l.debit), 0)
             from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
             where e.entry_date = d::date and l.gl_code in ('4100', '4110', '5100')) end
        ) order by d), '[]'::jsonb)
        from generate_series(p_start, p_end, interval '1 day') d),
      'revenue_by_product', (
        select coalesce(jsonb_agg(x order by x.amount desc), '[]'::jsonb) from (
          select p.name_en, p.name_ar, sum(si.line_total)::numeric(14, 2) as amount, sum(si.weight_kg)::numeric(14, 1) as kg
          from public.sale_items si join public.sales s on s.id = si.sale_id join public.products p on p.id = si.product_id
          where s.status = 'posted' and s.sale_date between p_start and p_end
          group by p.id order by 3 desc limit 8) x)
    );
  end if;

  if app.has_perm('purchases.view') then
    v := v || jsonb_build_object(
      'total_purchases', (select coalesce(sum(total - returned_total), 0) from public.purchases where status = 'posted' and purchase_date between p_start and p_end));
  end if;

  if app.has_perm('inventory.view') or app.has_perm('products.view') then
    v := v || jsonb_build_object(
      'stock_kg', (select coalesce(sum(m.qty * p.weight_kg), 0)::numeric(14, 1) from public.stock_movements m join public.products p on p.id = m.product_id),
      'low_stock', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select product_id, name_en, name_ar, qty, min_stock, unit from public.v_product_stock
        where is_active and is_low order by qty - min_stock limit 8) x),
      'low_stock_count', (select count(*) from public.v_product_stock where is_active and is_low),
      'inventory_by_storage', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select s.name_en, s.name_ar, s.capacity_kg, coalesce(sum(m.qty * p.weight_kg), 0)::numeric(14, 1) as kg
        from public.storages s left join public.stock_movements m on m.storage_id = s.id left join public.products p on p.id = m.product_id
        where s.is_active group by s.id order by s.name_en) x)
    );
  end if;

  if app.has_perm('deliveries.view') then
    v := v || jsonb_build_object('pending_deliveries', (select count(*) from public.deliveries where status in ('pending', 'in_transit')));
  end if;

  if app.has_perm('attendance.view') or app.has_perm('attendance.mark') then
    v := v || jsonb_build_object(
      'staff_total', (select count(*) from public.employees where status = 'active'),
      'staff_present', (select count(*) from public.attendance where work_date = v_today and status in ('present', 'late', 'half_day')),
      'staff_late', (select count(*) from public.attendance where work_date = v_today and status = 'late'),
      'staff_on_leave', (select count(*) from public.attendance where work_date = v_today and status = 'on_leave'),
      'staff_absent', (select count(*) from public.employees e where e.status = 'active'
         and not exists (select 1 from public.attendance a where a.employee_id = e.id and a.work_date = v_today and a.status in ('present', 'late', 'half_day', 'on_leave', 'holiday'))),
      'attendance_series', (select coalesce(jsonb_agg(jsonb_build_object('date', d::date,
          'present', (select count(*) from public.attendance a where a.work_date = d::date and a.status = 'present'),
          'late', (select count(*) from public.attendance a where a.work_date = d::date and a.status = 'late'),
          'absent', (select count(*) from public.attendance a where a.work_date = d::date and a.status in ('absent', 'half_day'))
        ) order by d), '[]'::jsonb) from generate_series(v_today - 13, v_today, interval '1 day') d)
    );
  end if;

  if app.has_perm('payments.verify') then
    v := v || jsonb_build_object('pending_verifications', (select count(*) from public.payments where status = 'pending_verification'));
  end if;
  if app.has_perm('inquiries.view') then
    v := v || jsonb_build_object('new_inquiries', (select count(*) from public.contact_inquiries where status = 'new'));
  end if;
  if app.has_perm('inventory.adjust_approve') then
    v := v || jsonb_build_object('pending_adjustments', (select count(*) from public.stock_adjustments where status = 'pending'));
  end if;

  if v_fin then
    v_revenue := -app.gl_sum(array['4100', '4110'], p_start, p_end);
    v_cogs := app.gl_sum(array['5100'], p_start, p_end);
    v := v || jsonb_build_object(
      'revenue', v_revenue,
      'gross_profit', v_revenue - v_cogs,
      'expenses', app.gl_sum(array['6000'], p_start, p_end),
      'net_profit', -app.gl_sum(array['4100', '4110', '4900', '5100', '5200', '5300', '5400', '5900', '6000'], p_start, p_end),
      'cash_balance', app.gl_balance(array['1100']),
      'bank_balance', app.gl_balance(array['1110']),
      'receivables', app.gl_balance(array['1200']),
      'payables', -app.gl_balance(array['2100']),
      'inventory_value', app.gl_balance(array['1300']),
      'outstanding_commissions', -app.gl_balance(array['2300']),
      'investor_liabilities', -app.gl_balance(array['2500', '2600', '3200']),
      'expenses_by_month', (select coalesce(jsonb_agg(x order by x.month), '[]'::jsonb) from (
        select to_char(date_trunc('month', ex.expense_date), 'YYYY-MM') as month, c.name_en, c.name_ar, sum(ex.amount)::numeric(14, 2) as amount
        from public.expenses ex join public.expense_categories c on c.id = ex.category_id
        where ex.status = 'posted' and ex.expense_date >= date_trunc('month', v_today) - interval '5 months'
        group by 1, c.id) x)
    );
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Profit & loss by account
-- ---------------------------------------------------------------------
create or replace function public.report_profit_loss(p_start date, p_end date)
returns table (code text, name_en text, name_ar text, type public.gl_type, amount numeric)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.require_perm('reports.financial');
  return query
  select g.code, g.name_en, g.name_ar, g.type,
    (case when g.type = 'income' then -1 else 1 end * coalesce(sum(l.debit - l.credit), 0))::numeric(14, 2)
  from public.gl_accounts g
  left join public.journal_lines l on l.gl_code = g.code
    and l.entry_id in (select id from public.journal_entries where entry_date between p_start and p_end)
  where g.type in ('income', 'expense')
  group by g.code order by g.sort_order;
end $$;

create or replace function public.report_expenses_by_category(p_start date, p_end date)
returns table (category_id uuid, name_en text, name_ar text, amount numeric, vat numeric, entries bigint)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.require_perm('expenses.view');
  return query
  select c.id, c.name_en, c.name_ar, coalesce(sum(e.amount), 0)::numeric(14, 2), coalesce(sum(e.vat_amount), 0)::numeric(14, 2), count(e.id)
  from public.expense_categories c
  left join public.expenses e on e.category_id = c.id and e.status = 'posted' and e.expense_date between p_start and p_end
  group by c.id having count(e.id) > 0 order by 4 desc;
end $$;

-- ---------------------------------------------------------------------
-- Sales report (cost & margin only with financial access)
-- p_group: 'day' | 'product' | 'customer' | 'driver'
-- ---------------------------------------------------------------------
create or replace function public.report_sales(p_start date, p_end date, p_group text)
returns table (key text, label_en text, label_ar text, invoices bigint, qty numeric, kg numeric, net_sales numeric, vat numeric, cogs numeric, gross_profit numeric)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_fin boolean := app.has_perm('reports.financial');
begin
  perform app.require_perm('reports.view');
  perform app.require_perm('sales.view');
  return query
  with lines as (
    select s.id as sale_id, s.sale_date, s.customer_id, s.driver_id, si.product_id, si.qty - si.returned_qty as qty,
      si.weight_kg * (si.qty - si.returned_qty) / si.qty as kg,
      si.line_total * (si.qty - si.returned_qty) / si.qty * case when s.subtotal > 0 then s.taxable_amount / s.subtotal else 1 end as net,
      si.cogs * (si.qty - si.returned_qty) / si.qty as cogs,
      s.vat_rate
    from public.sales s join public.sale_items si on si.sale_id = s.id
    where s.status = 'posted' and s.sale_date between p_start and p_end
  )
  select
    case p_group when 'day' then l.sale_date::text when 'product' then l.product_id::text when 'customer' then l.customer_id::text else coalesce(l.driver_id::text, '') end,
    case p_group when 'day' then to_char(l.sale_date, 'YYYY-MM-DD') when 'product' then max(p.name_en) when 'customer' then max(c.name) else coalesce(max(d.name), 'No driver') end,
    case p_group when 'day' then to_char(l.sale_date, 'YYYY-MM-DD') when 'product' then max(p.name_ar) when 'customer' then coalesce(max(c.name_ar), max(c.name)) else coalesce(max(d.name_ar), max(d.name), 'بدون سائق') end,
    count(distinct l.sale_id),
    round(sum(l.qty), 3), round(sum(l.kg), 3),
    round(sum(l.net), 2), round(sum(l.net * l.vat_rate / 100), 2),
    case when v_fin then round(sum(l.cogs), 2) end,
    case when v_fin then round(sum(l.net) - sum(l.cogs), 2) end
  from lines l
  join public.products p on p.id = l.product_id
  join public.customers c on c.id = l.customer_id
  left join public.drivers d on d.id = l.driver_id
  group by 1
  order by case when p_group = 'day' then 1 else 0 end, 7 desc, 1;
end $$;

create or replace function public.report_purchases(p_start date, p_end date, p_group text)
returns table (key text, label_en text, label_ar text, documents bigint, qty numeric, amount numeric)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.require_perm('reports.view');
  perform app.require_perm('purchases.view');
  return query
  select
    case p_group when 'supplier' then pu.supplier_id::text when 'product' then pi.product_id::text else pu.purchase_date::text end,
    case p_group when 'supplier' then max(su.name) when 'product' then max(p.name_en) else to_char(pu.purchase_date, 'YYYY-MM-DD') end,
    case p_group when 'supplier' then coalesce(max(su.name_ar), max(su.name)) when 'product' then max(p.name_ar) else to_char(pu.purchase_date, 'YYYY-MM-DD') end,
    count(distinct pu.id), round(sum(pi.qty - pi.returned_qty), 3), round(sum(pi.unit_price * (pi.qty - pi.returned_qty)), 2)
  from public.purchases pu
  join public.purchase_items pi on pi.purchase_id = pu.id
  join public.suppliers su on su.id = pu.supplier_id
  join public.products p on p.id = pi.product_id
  where pu.status = 'posted' and pu.purchase_date between p_start and p_end
  group by 1 order by 6 desc;
end $$;

-- ---------------------------------------------------------------------
-- Inventory & batches
-- ---------------------------------------------------------------------
create or replace function public.report_inventory(p_storage uuid default null)
returns table (product_id uuid, sku text, name_en text, name_ar text, variety text, grade text, unit public.product_unit,
  storage_id uuid, storage_en text, storage_ar text, qty numeric, kg numeric, value numeric, min_stock numeric)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_cost boolean := app.has_perm('products.view_cost');
begin
  if not (app.has_perm('inventory.view') or app.has_perm('reports.view')) then
    perform app.require_perm('inventory.view');
  end if;
  return query
  select p.id, p.sku, p.name_en, p.name_ar, p.variety, p.grade, p.unit, s.id, s.name_en, s.name_ar,
    sum(m.qty)::numeric(14, 3), (sum(m.qty) * p.weight_kg)::numeric(14, 3),
    case when v_cost then sum(m.qty * m.unit_cost)::numeric(14, 2) end, p.min_stock
  from public.stock_movements m
  join public.products p on p.id = m.product_id
  join public.storages s on s.id = m.storage_id
  where p_storage is null or m.storage_id = p_storage
  group by p.id, s.id
  having sum(m.qty) <> 0
  order by p.name_en, s.name_en;
end $$;

create or replace function public.stock_available(p_product uuid)
returns table (storage_id uuid, batch_id uuid, batch_no text, received_date date, expiry_date date, qty numeric)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not (app.has_perm('inventory.view') or app.has_perm('sales.create') or app.has_perm('purchases.create')) then
    perform app.require_perm('inventory.view');
  end if;
  return query
  select m.storage_id, m.batch_id, b.batch_no, b.received_date, b.expiry_date, sum(m.qty)::numeric(14, 3)
  from public.stock_movements m join public.stock_batches b on b.id = m.batch_id
  where m.product_id = p_product
  group by m.storage_id, m.batch_id, b.id
  having sum(m.qty) > 0
  order by b.received_date, b.batch_no;
end $$;

create or replace function public.batch_trace(p_batch uuid)
returns table (movement_id bigint, movement_date date, created_at timestamptz, movement_type public.movement_type,
  storage_en text, storage_ar text, qty numeric, unit_cost numeric, source_type text, source_id uuid, document_no text, party text)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_cost boolean := app.has_perm('products.view_cost');
begin
  perform app.require_perm('inventory.view');
  return query
  select m.id, m.movement_date, m.created_at, m.movement_type, s.name_en, s.name_ar, m.qty,
    case when v_cost then m.unit_cost end, m.source_type, m.source_id,
    coalesce(sa.invoice_no, pu.purchase_no, tr.transfer_no, ad.adj_no, sr.return_no, pr.return_no),
    coalesce(c.name, su.name)
  from public.stock_movements m
  join public.storages s on s.id = m.storage_id
  left join public.sales sa on m.source_type = 'sale' and sa.id = m.source_id
  left join public.customers c on c.id = sa.customer_id
  left join public.purchases pu on m.source_type = 'purchase' and pu.id = m.source_id
  left join public.suppliers su on su.id = pu.supplier_id
  left join public.stock_transfers tr on m.source_type = 'transfer' and tr.id = m.source_id
  left join public.stock_adjustments ad on m.source_type = 'adjustment' and ad.id = m.source_id
  left join public.sale_returns sr on m.source_type = 'sale_return' and sr.id = m.source_id
  left join public.purchase_returns pr on m.source_type = 'purchase_return' and pr.id = m.source_id
  where m.batch_id = p_batch
  order by m.created_at, m.id;
end $$;

-- ---------------------------------------------------------------------
-- Costs for authorised screens
-- ---------------------------------------------------------------------
create or replace function public.product_costs()
returns table (product_id uuid, purchase_price numeric)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.require_perm('products.view_cost');
  return query select id, products.purchase_price from public.products;
end $$;

create or replace function public.sale_internal(p_sale uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  s public.sales;
begin
  select * into s from public.sales where id = p_sale;
  if s.id is null then raise exception 'Invoice not found.' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'cogs', case when app.has_perm('products.view_cost') or app.has_perm('reports.financial') then s.cogs_total end,
    'gross_profit', case when app.has_perm('reports.financial') then
      (s.taxable_amount - coalesce((select sum(net_amount) from public.sale_returns where sale_id = s.id), 0))
      - (s.cogs_total - coalesce((select sum(cost) from public.sale_returns where sale_id = s.id), 0)) end,
    'commission', case when app.has_perm('commissions.view') then s.commission_amount end);
end $$;

-- ---------------------------------------------------------------------
-- Statements (running balance)
-- ---------------------------------------------------------------------
create or replace function public.party_statement(p_type public.party_type, p_id uuid, p_start date, p_end date)
returns table (entry_date date, entry_no text, source_type text, source_id uuid, memo text, debit numeric, credit numeric, balance numeric, is_opening boolean)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_codes text[];
  v_sign int;
  v_open numeric;
begin
  case p_type
    when 'customer' then perform app.require_perm('customers.view'); v_codes := array['1200']; v_sign := 1;
    when 'supplier' then perform app.require_perm('suppliers.view'); v_codes := array['2100']; v_sign := -1;
    when 'driver' then
      if not (app.has_perm('commissions.view') or p_id = app.my_driver_id()) then perform app.require_perm('commissions.view'); end if;
      v_codes := array['2300']; v_sign := -1;
    when 'employee' then perform app.require_perm('payroll.view'); v_codes := array['2400', '1400']; v_sign := -1;
    when 'investor' then perform app.require_perm('investors.view'); v_codes := array['2500']; v_sign := -1;
  end case;

  select coalesce(sum(l.debit - l.credit), 0) * v_sign into v_open
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.party_type = p_type and l.party_id = p_id and l.gl_code = any (v_codes) and e.entry_date < p_start;

  return query
  select p_start, null::text, 'opening'::text, null::uuid, 'Opening balance'::text, null::numeric, null::numeric, v_open::numeric(14, 2), true
  union all
  select x.entry_date, x.entry_no, x.source_type, x.source_id, x.memo, x.debit, x.credit,
    (v_open + sum((x.debit - x.credit) * v_sign) over (order by x.entry_date, x.created_at, x.entry_no))::numeric(14, 2), false
  from (
    select e.entry_date, e.entry_no, e.source_type, e.source_id, e.memo, e.created_at,
      sum(l.debit)::numeric(14, 2) as debit, sum(l.credit)::numeric(14, 2) as credit
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.party_type = p_type and l.party_id = p_id and l.gl_code = any (v_codes) and e.entry_date between p_start and p_end
    group by e.id
  ) x;
end $$;

create or replace function public.money_statement(p_account uuid, p_start date, p_end date)
returns table (entry_date date, entry_no text, source_type text, source_id uuid, memo text, debit numeric, credit numeric, balance numeric, is_opening boolean)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_open numeric;
begin
  perform app.require_perm('accounts.view');
  select coalesce(sum(l.debit - l.credit), 0) into v_open
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.money_account_id = p_account and e.entry_date < p_start;
  return query
  select p_start, null::text, 'opening'::text, null::uuid, 'Opening balance'::text, null::numeric, null::numeric, v_open::numeric(14, 2), true
  union all
  select e.entry_date, e.entry_no, e.source_type, e.source_id, e.memo, l.debit, l.credit,
    (v_open + sum(l.debit - l.credit) over (order by e.entry_date, e.created_at, l.id))::numeric(14, 2), false
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.money_account_id = p_account and e.entry_date between p_start and p_end;
end $$;

-- Receivables / payables with ageing from unpaid documents
create or replace function public.report_ageing(p_type text)
returns table (party_id uuid, code text, name text, name_ar text, phone text, balance numeric,
  current_30 numeric, days_31_60 numeric, days_61_90 numeric, over_90 numeric, pending_verification numeric)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if p_type = 'customer' then
    perform app.require_perm('customers.view');
    return query
    select c.id, c.code, c.name, c.name_ar, c.phone,
      coalesce((select sum(debit - credit) from public.journal_lines where party_type = 'customer' and party_id = c.id and gl_code = '1200'), 0)::numeric(14, 2),
      coalesce(sum(o.amt) filter (where app.today() - o.d <= 30), 0)::numeric(14, 2),
      coalesce(sum(o.amt) filter (where app.today() - o.d between 31 and 60), 0)::numeric(14, 2),
      coalesce(sum(o.amt) filter (where app.today() - o.d between 61 and 90), 0)::numeric(14, 2),
      coalesce(sum(o.amt) filter (where app.today() - o.d > 90), 0)::numeric(14, 2),
      coalesce(sum(o.pend), 0)::numeric(14, 2)
    from public.customers c
    left join lateral (select s.sale_date as d, s.total - s.returned_total - s.paid_total as amt, s.pending_total as pend
                       from public.sales s where s.customer_id = c.id and s.status = 'posted' and s.payment_status <> 'paid') o on true
    group by c.id
    having coalesce((select sum(debit - credit) from public.journal_lines where party_type = 'customer' and party_id = c.id and gl_code = '1200'), 0) <> 0
    order by 6 desc;
  else
    perform app.require_perm('suppliers.view');
    return query
    select su.id, su.code, su.name, su.name_ar, su.phone,
      coalesce((select sum(credit - debit) from public.journal_lines where party_type = 'supplier' and party_id = su.id and gl_code = '2100'), 0)::numeric(14, 2),
      coalesce(sum(o.amt) filter (where app.today() - o.d <= 30), 0)::numeric(14, 2),
      coalesce(sum(o.amt) filter (where app.today() - o.d between 31 and 60), 0)::numeric(14, 2),
      coalesce(sum(o.amt) filter (where app.today() - o.d between 61 and 90), 0)::numeric(14, 2),
      coalesce(sum(o.amt) filter (where app.today() - o.d > 90), 0)::numeric(14, 2),
      coalesce(sum(o.pend), 0)::numeric(14, 2)
    from public.suppliers su
    left join lateral (select p.purchase_date as d, p.total - p.returned_total - p.paid_total as amt, p.pending_total as pend
                       from public.purchases p where p.supplier_id = su.id and p.status = 'posted' and p.payment_status <> 'paid') o on true
    group by su.id
    having coalesce((select sum(credit - debit) from public.journal_lines where party_type = 'supplier' and party_id = su.id and gl_code = '2100'), 0) <> 0
    order by 6 desc;
  end if;
end $$;

create or replace function public.report_commissions(p_start date, p_end date)
returns table (driver_id uuid, code text, name text, name_ar text, kind text, rule public.commission_type,
  invoices bigint, earned numeric, paid numeric, outstanding numeric)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not (app.has_perm('commissions.view') or app.has_perm('commissions.own')) then perform app.require_perm('commissions.view'); end if;
  return query
  select d.id, d.code, d.name, d.name_ar, d.kind, d.commission_type,
    (select count(distinct c.sale_id) from public.commissions c where c.driver_id = d.id and c.amount > 0 and c.created_at::date between p_start and p_end),
    coalesce((select sum(c.amount) from public.commissions c where c.driver_id = d.id and c.created_at::date between p_start and p_end), 0)::numeric(14, 2),
    coalesce((select sum(py.amount) from public.payments py where py.party_type = 'driver' and py.party_id = d.id and py.status = 'verified' and py.payment_date between p_start and p_end), 0)::numeric(14, 2),
    coalesce((select sum(credit - debit) from public.journal_lines where party_type = 'driver' and party_id = d.id and gl_code = '2300'), 0)::numeric(14, 2)
  from public.drivers d
  where app.has_perm('commissions.view') or d.id = app.my_driver_id()
  order by 10 desc, d.name;
end $$;

create or replace function public.report_attendance(p_start date, p_end date)
returns table (employee_id uuid, employee_no text, full_name text, full_name_ar text, department text,
  present bigint, late bigint, half_day bigint, absent bigint, on_leave bigint, holiday bigint,
  late_minutes bigint, worked_hours numeric, overtime_hours numeric, manual_entries bigint)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.require_perm('attendance.view');
  return query
  select e.id, e.employee_no, e.full_name, e.full_name_ar, e.department,
    count(a.id) filter (where a.status = 'present'), count(a.id) filter (where a.status = 'late'),
    count(a.id) filter (where a.status = 'half_day'), count(a.id) filter (where a.status = 'absent'),
    count(a.id) filter (where a.status = 'on_leave'), count(a.id) filter (where a.status = 'holiday'),
    coalesce(sum(a.late_minutes), 0)::bigint,
    round(coalesce(sum(a.worked_minutes), 0) / 60.0, 2), round(coalesce(sum(a.overtime_minutes), 0) / 60.0, 2),
    count(a.id) filter (where a.is_manual)
  from public.employees e
  left join public.attendance a on a.employee_id = e.id and a.work_date between p_start and p_end
  where e.status = 'active' or a.id is not null
  group by e.id order by e.full_name;
end $$;

create or replace function public.trial_balance()
returns table (code text, name_en text, name_ar text, type public.gl_type, debit numeric, credit numeric)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.require_perm('reports.financial');
  return query
  select g.code, g.name_en, g.name_ar, g.type,
    greatest(coalesce(sum(l.debit - l.credit), 0), 0)::numeric(14, 2),
    greatest(coalesce(sum(l.credit - l.debit), 0), 0)::numeric(14, 2)
  from public.gl_accounts g left join public.journal_lines l on l.gl_code = g.code
  group by g.code order by g.sort_order;
end $$;

-- Re-apply grants for the functions created in this file
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated, service_role;
grant execute on function app.has_perm(text), app.is_staff(), app.my_driver_id(), app.today(), app.tz() to anon;
