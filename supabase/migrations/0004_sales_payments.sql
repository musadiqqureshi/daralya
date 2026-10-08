-- =====================================================================
-- 0004 SALES, COMMISSIONS, DELIVERIES, MANUAL PAYMENTS, EXPENSES, CASH & BANK
-- =====================================================================

create type public.payment_status as enum ('pending_verification', 'verified', 'cancelled');
create type public.payment_purpose as enum (
  'customer_receipt', 'customer_refund', 'supplier_payment', 'supplier_refund',
  'driver_commission', 'salary', 'salary_advance',
  'investor_capital_in', 'investor_capital_return', 'investor_profit'
);
create type public.delivery_status as enum ('pending', 'in_transit', 'delivered', 'failed', 'cancelled');

-- ---------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  sale_date date not null,
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers (id),
  storage_id uuid not null references public.storages (id),
  driver_id uuid references public.drivers (id),
  subtotal numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 0,
  vat_amount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  total_kg numeric(14, 3) not null default 0,
  cogs_total numeric(14, 2) not null default 0,
  commission_amount numeric(14, 2) not null default 0,
  returned_total numeric(14, 2) not null default 0,
  paid_total numeric(14, 2) not null default 0,
  pending_total numeric(14, 2) not null default 0,
  payment_status public.pay_status not null default 'unpaid',
  status public.doc_status not null default 'posted',
  notes text,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_by uuid default auth.uid()
);
create index sales_customer_idx on public.sales (customer_id, sale_date desc);
create index sales_date_idx on public.sales (sale_date desc);
create index sales_driver_idx on public.sales (driver_id) where driver_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  line_no int not null,
  product_id uuid not null references public.products (id),
  qty numeric(14, 3) not null check (qty > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  line_total numeric(14, 2) not null,
  weight_kg numeric(14, 3) not null,
  cogs numeric(14, 2) not null default 0,
  returned_qty numeric(14, 3) not null default 0
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  return_no text unique not null,
  sale_id uuid not null references public.sales (id),
  customer_id uuid not null references public.customers (id),
  return_date date not null,
  storage_id uuid not null references public.storages (id),
  reason text not null,
  net_amount numeric(14, 2) not null default 0,
  vat_amount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  cost numeric(14, 2) not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sale_returns (id),
  sale_item_id uuid not null references public.sale_items (id),
  qty numeric(14, 3) not null check (qty > 0),
  net_amount numeric(14, 2) not null,
  cost numeric(14, 2) not null
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id),
  sale_id uuid not null references public.sales (id),
  sale_return_id uuid references public.sale_returns (id),
  rule public.commission_type not null,
  rate numeric(12, 4) not null,
  basis numeric(14, 3) not null,
  amount numeric(14, 2) not null,
  note text,
  created_at timestamptz not null default now()
);
create index commissions_driver_idx on public.commissions (driver_id, created_at desc);

-- ---------------------------------------------------------------------
-- Deliveries
-- ---------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_no text unique not null,
  sale_id uuid references public.sales (id),
  customer_id uuid not null references public.customers (id),
  driver_id uuid references public.drivers (id),
  vehicle_no text,
  scheduled_date date not null,
  address text,
  status public.delivery_status not null default 'pending',
  dispatched_at timestamptz,
  delivered_at timestamptz,
  recipient_name text,
  proof_photo_path text,
  signature_path text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index deliveries_driver_idx on public.deliveries (driver_id, status);

create table public.delivery_events (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.deliveries (id),
  status public.delivery_status not null,
  note text,
  at timestamptz not null default now(),
  by_user uuid default auth.uid()
);

-- ---------------------------------------------------------------------
-- Manual payments (no gateways). Bank transfers wait for verification.
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text unique not null,
  direction text not null check (direction in ('in', 'out')),
  purpose public.payment_purpose not null,
  party_type public.party_type not null,
  party_id uuid not null,
  investment_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  method_id uuid not null references public.payment_methods (id),
  money_account_id uuid not null references public.money_accounts (id),
  payment_date date not null,
  reference text,
  proof_path text,
  notes text,
  status public.payment_status not null,
  verified_by uuid,
  verified_at timestamptz,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index payments_party_idx on public.payments (party_type, party_id, payment_date desc);
create index payments_status_idx on public.payments (status);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id),
  doc_type text not null check (doc_type in ('sale', 'purchase', 'payroll_item')),
  doc_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0)
);
create index payment_allocations_doc_idx on public.payment_allocations (doc_type, doc_id);

create or replace function app.refresh_payment_status(p_doc_type text, p_doc_id uuid) returns void
language plpgsql as $$
declare
  v_paid numeric;
  v_pending numeric;
  v_due numeric;
begin
  select coalesce(sum(a.amount) filter (where py.status = 'verified'), 0),
         coalesce(sum(a.amount) filter (where py.status = 'pending_verification'), 0)
  into v_paid, v_pending
  from public.payment_allocations a join public.payments py on py.id = a.payment_id
  where a.doc_type = p_doc_type and a.doc_id = p_doc_id;

  if p_doc_type = 'sale' then
    select total - returned_total into v_due from public.sales where id = p_doc_id;
    update public.sales set paid_total = v_paid, pending_total = v_pending,
      payment_status = case when v_paid >= v_due then 'paid' when v_paid > 0 then 'partial' else 'unpaid' end::public.pay_status
    where id = p_doc_id;
  elsif p_doc_type = 'purchase' then
    select total - returned_total into v_due from public.purchases where id = p_doc_id;
    update public.purchases set paid_total = v_paid, pending_total = v_pending,
      payment_status = case when v_paid >= v_due then 'paid' when v_paid > 0 then 'partial' else 'unpaid' end::public.pay_status
    where id = p_doc_id;
  elsif p_doc_type = 'payroll_item' then
    update public.payroll_items set paid_amount = v_paid where id = p_doc_id;
  end if;
end $$;

create or replace function app.doc_outstanding(p_doc_type text, p_doc_id uuid, p_party uuid) returns numeric
language plpgsql as $$
declare
  v numeric;
begin
  if p_doc_type = 'sale' then
    select total - returned_total - paid_total - pending_total into v from public.sales
      where id = p_doc_id and customer_id = p_party and status = 'posted';
  elsif p_doc_type = 'purchase' then
    select total - returned_total - paid_total - pending_total into v from public.purchases
      where id = p_doc_id and supplier_id = p_party and status = 'posted';
  elsif p_doc_type = 'payroll_item' then
    select pi.net_pay - pi.paid_amount - coalesce((
      select sum(a.amount) from public.payment_allocations a join public.payments py on py.id = a.payment_id
      where a.doc_type = 'payroll_item' and a.doc_id = pi.id and py.status = 'pending_verification'), 0)
    into v from public.payroll_items pi join public.payroll_runs r on r.id = pi.run_id
      where pi.id = p_doc_id and pi.employee_id = p_party and r.status = 'approved';
  end if;
  if v is null then
    raise exception 'The document to settle was not found for this party.' using errcode = 'P0002';
  end if;
  return v;
end $$;

-- Journal lines for a verified payment
create or replace function app.payment_post(p_id uuid) returns void
language plpgsql as $$
declare
  py public.payments;
  v_money text;
  v_other text;
  v_model text;
  v_lines jsonb;
begin
  select * into py from public.payments where id = p_id;
  v_money := app.money_gl(py.money_account_id);
  if py.investment_id is not null then
    select model::text into v_model from public.investments where id = py.investment_id;
  end if;
  v_other := case py.purpose
    when 'customer_receipt' then '1200' when 'customer_refund' then '1200'
    when 'supplier_payment' then '2100' when 'supplier_refund' then '2100'
    when 'driver_commission' then '2300'
    when 'salary' then '2400' when 'salary_advance' then '1400'
    when 'investor_capital_in' then case when v_model = 'loan' then '2600' else '3200' end
    when 'investor_capital_return' then case when v_model = 'loan' then '2600' else '3200' end
    when 'investor_profit' then '2500'
  end;
  v_lines := jsonb_build_array(
    jsonb_build_object('gl', v_money, 'money_account_id', py.money_account_id,
      'dr', case when py.direction = 'in' then py.amount else 0 end,
      'cr', case when py.direction = 'out' then py.amount else 0 end),
    jsonb_build_object('gl', v_other, 'party_type', py.party_type, 'party_id', py.party_id, 'investment_id', py.investment_id,
      'dr', case when py.direction = 'out' then py.amount else 0 end,
      'cr', case when py.direction = 'in' then py.amount else 0 end));
  perform app.post_journal(py.payment_date, 'payment', py.id,
    initcap(replace(py.purpose::text, '_', ' ')) || ' ' || py.payment_no, v_lines);
end $$;

create or replace function app.purpose_party(p public.payment_purpose) returns public.party_type
language sql immutable as $$
  select case
    when p in ('customer_receipt', 'customer_refund') then 'customer'
    when p in ('supplier_payment', 'supplier_refund') then 'supplier'
    when p = 'driver_commission' then 'driver'
    when p in ('salary', 'salary_advance') then 'employee'
    else 'investor' end::public.party_type
$$;

create or replace function app.purpose_direction(p public.payment_purpose) returns text
language sql immutable as $$
  select case when p in ('customer_receipt', 'supplier_refund', 'investor_capital_in') then 'in' else 'out' end
$$;

/*
  Internal: callers must have checked permissions.
  p: { purpose, party_id, amount, method_id, money_account_id, date, reference, proof_path, notes,
       investment_id?, allocations?: [{ doc_type, doc_id, amount }], auto_allocate?: bool }
*/
create or replace function app.payment_create_internal(p jsonb) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_purpose public.payment_purpose := (p ->> 'purpose')::public.payment_purpose;
  v_party_type public.party_type := app.purpose_party((p ->> 'purpose')::public.payment_purpose);
  v_party uuid := (p ->> 'party_id')::uuid;
  v_amount numeric := round((p ->> 'amount')::numeric, 2);
  v_method public.payment_methods;
  v_acct public.money_accounts;
  v_status public.payment_status;
  v_alloc jsonb;
  v_alloc_total numeric := 0;
  v_out numeric;
  v_left numeric;
  v_inv uuid := (p ->> 'investment_id')::uuid;
  v_party_ok boolean;
  d record;
begin
  if v_amount is null or v_amount <= 0 then
    raise exception 'Enter a payment amount above zero.' using errcode = '22023';
  end if;
  select * into v_method from public.payment_methods where id = (p ->> 'method_id')::uuid and is_active;
  if v_method.id is null then raise exception 'Choose a payment method.' using errcode = '22023'; end if;
  select * into v_acct from public.money_accounts where id = (p ->> 'money_account_id')::uuid and is_active;
  if v_acct.id is null then raise exception 'Choose a cash or bank account.' using errcode = '22023'; end if;

  -- party must exist
  v_party_ok := case v_party_type
    when 'customer' then exists (select 1 from public.customers where id = v_party)
    when 'supplier' then exists (select 1 from public.suppliers where id = v_party)
    when 'driver' then exists (select 1 from public.drivers where id = v_party)
    when 'employee' then exists (select 1 from public.employees where id = v_party)
    when 'investor' then exists (select 1 from public.investors where id = v_party)
  end;
  if not coalesce(v_party_ok, false) then
    raise exception 'The selected % was not found.', v_party_type using errcode = 'P0002';
  end if;
  if v_party_type = 'investor' and (v_inv is null or not exists (select 1 from public.investments where id = v_inv and investor_id = v_party)) then
    raise exception 'Choose the investment this payment belongs to.' using errcode = '22023';
  end if;

  -- cash cannot be paid out of an account that does not hold it
  if app.purpose_direction(v_purpose) = 'out' and v_acct.kind = 'cash'
     and (select coalesce(sum(debit - credit), 0) from public.journal_lines where money_account_id = v_acct.id) < v_amount then
    raise exception 'Not enough cash in % for this payment.', v_acct.name_en using errcode = 'P0001';
  end if;

  v_status := case when v_method.requires_verification then 'pending_verification' else 'verified' end;

  insert into public.payments (payment_no, direction, purpose, party_type, party_id, investment_id, amount, method_id, money_account_id,
    payment_date, reference, proof_path, notes, status, verified_by, verified_at)
  values (app.next_doc_no(case when app.purpose_direction(v_purpose) = 'in' then 'RCV' else 'PAY' end),
    app.purpose_direction(v_purpose), v_purpose, v_party_type, v_party, v_inv, v_amount, v_method.id, v_acct.id,
    coalesce((p ->> 'date')::date, app.today()), nullif(trim(p ->> 'reference'), ''), nullif(p ->> 'proof_path', ''), p ->> 'notes',
    v_status, case when v_status = 'verified' then auth.uid() end, case when v_status = 'verified' then now() end)
  returning id into v_id;

  if jsonb_array_length(coalesce(p -> 'allocations', '[]')) > 0 then
    for v_alloc in select * from jsonb_array_elements(p -> 'allocations') loop
      continue when coalesce((v_alloc ->> 'amount')::numeric, 0) <= 0;
      v_out := app.doc_outstanding(v_alloc ->> 'doc_type', (v_alloc ->> 'doc_id')::uuid, v_party);
      if round((v_alloc ->> 'amount')::numeric, 2) > v_out then
        raise exception 'Allocation exceeds the outstanding amount (%).', v_out using errcode = '22023';
      end if;
      insert into public.payment_allocations (payment_id, doc_type, doc_id, amount)
      values (v_id, v_alloc ->> 'doc_type', (v_alloc ->> 'doc_id')::uuid, round((v_alloc ->> 'amount')::numeric, 2));
      v_alloc_total := v_alloc_total + round((v_alloc ->> 'amount')::numeric, 2);
    end loop;
  elsif coalesce((p ->> 'auto_allocate')::boolean, false) and v_purpose in ('customer_receipt', 'supplier_payment') then
    v_left := v_amount;
    for d in
      select id, total - returned_total - paid_total - pending_total as outstanding, sale_date as doc_date, created_at from public.sales
        where v_purpose = 'customer_receipt' and customer_id = v_party and status = 'posted' and total - returned_total - paid_total - pending_total > 0
      union all
      select id, total - returned_total - paid_total - pending_total, purchase_date, created_at from public.purchases
        where v_purpose = 'supplier_payment' and supplier_id = v_party and status = 'posted' and total - returned_total - paid_total - pending_total > 0
      order by 3, 4
    loop
      exit when v_left <= 0;
      insert into public.payment_allocations (payment_id, doc_type, doc_id, amount)
      values (v_id, case when v_purpose = 'customer_receipt' then 'sale' else 'purchase' end, d.id, least(v_left, d.outstanding));
      v_alloc_total := v_alloc_total + least(v_left, d.outstanding);
      v_left := v_left - least(v_left, d.outstanding);
    end loop;
  end if;
  if v_alloc_total > v_amount then
    raise exception 'Allocations (%) exceed the payment amount (%).', v_alloc_total, v_amount using errcode = '22023';
  end if;

  if v_status = 'verified' then
    perform app.payment_post(v_id);
  end if;
  for d in select distinct doc_type, doc_id from public.payment_allocations where payment_id = v_id loop
    perform app.refresh_payment_status(d.doc_type, d.doc_id);
  end loop;
  return v_id;
end $$;

create or replace function public.payment_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_purpose public.payment_purpose := (p ->> 'purpose')::public.payment_purpose;
begin
  if v_purpose = 'customer_receipt' then
    if not (app.has_perm('payments.create') or app.has_perm('sales.collect')) then
      perform app.require_perm('payments.create');
    end if;
  elsif v_purpose in ('investor_capital_in', 'investor_capital_return', 'investor_profit') then
    perform app.require_perm('payments.create');
    perform app.require_perm('investors.manage');
  elsif v_purpose in ('salary', 'salary_advance') then
    perform app.require_perm('payments.create');
    perform app.require_perm('payroll.prepare');
  else
    perform app.require_perm('payments.create');
  end if;
  return app.payment_create_internal(p);
end $$;

create or replace function public.payment_verify(p_id uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  py public.payments;
  d record;
begin
  perform app.require_perm('payments.verify');
  select * into py from public.payments where id = p_id for update;
  if py.id is null then raise exception 'Payment not found.' using errcode = 'P0002'; end if;
  if py.status <> 'pending_verification' then
    raise exception 'Only payments pending verification can be verified.' using errcode = '22023';
  end if;
  update public.payments set status = 'verified', verified_by = auth.uid(), verified_at = now() where id = p_id;
  perform app.payment_post(p_id);
  for d in select distinct doc_type, doc_id from public.payment_allocations where payment_id = p_id loop
    perform app.refresh_payment_status(d.doc_type, d.doc_id);
  end loop;
end $$;

create or replace function public.payment_cancel(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  py public.payments;
  d record;
begin
  perform app.require_perm('payments.cancel');
  perform app.set_reason(p_reason);
  select * into py from public.payments where id = p_id for update;
  if py.id is null then raise exception 'Payment not found.' using errcode = 'P0002'; end if;
  if py.status = 'cancelled' then raise exception 'Payment is already cancelled.' using errcode = '22023'; end if;
  if py.status = 'verified' then
    perform app.reverse_journal('payment', p_id, 'Payment reversed: ' || p_reason);
  end if;
  update public.payments set status = 'cancelled', cancel_reason = p_reason, cancelled_at = now(), cancelled_by = auth.uid() where id = p_id;
  for d in select distinct doc_type, doc_id from public.payment_allocations where payment_id = p_id loop
    perform app.refresh_payment_status(d.doc_type, d.doc_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Sale posting
-- ---------------------------------------------------------------------
create or replace function app.calc_commission(p_driver uuid, p_taxable numeric, p_kg numeric, out rule public.commission_type, out rate numeric, out basis numeric, out amount numeric)
language plpgsql stable as $$
declare
  d public.drivers;
begin
  select * into d from public.drivers where id = p_driver;
  rule := coalesce(d.commission_type, 'none');
  rate := coalesce(d.commission_value, 0);
  basis := case rule when 'percent' then p_taxable when 'per_kg' then p_kg else 1 end;
  amount := round(case rule
    when 'fixed' then rate
    when 'percent' then p_taxable * rate / 100
    when 'per_kg' then p_kg * rate
    else 0 end, 2);
end $$;

/*
  p: { customer_id, storage_id, driver_id?, date, notes, discount_amount,
       lines: [{ product_id, qty, unit_price, discount_amount? }],
       payment?: { amount, method_id, money_account_id, reference, proof_path },
       delivery?: { scheduled_date, address, vehicle_no, notes } }
*/
create or replace function public.sale_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id uuid;
  v_no text;
  v_item uuid;
  v_line jsonb;
  v_n int := 0;
  v_date date := coalesce((p ->> 'date')::date, app.today());
  v_customer public.customers;
  v_storage uuid := (p ->> 'storage_id')::uuid;
  v_driver uuid := (p ->> 'driver_id')::uuid;
  v_settings public.settings;
  v_prod public.products;
  v_qty numeric;
  v_price numeric;
  v_ldisc numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_discount numeric := round(coalesce((p ->> 'discount_amount')::numeric, 0), 2);
  v_taxable numeric;
  v_vat numeric := 0;
  v_rate numeric := 0;
  v_total numeric;
  v_kg numeric := 0;
  v_cogs numeric := 0;
  v_line_cogs numeric;
  v_comm record;
  v_balance numeric;
  v_pay numeric := coalesce((p -> 'payment' ->> 'amount')::numeric, 0);
begin
  perform app.require_perm('sales.create');
  select * into v_settings from public.settings where id = 1;
  select * into v_customer from public.customers where id = (p ->> 'customer_id')::uuid and is_active;
  if v_customer.id is null then raise exception 'Customer not found or inactive.' using errcode = 'P0002'; end if;
  perform app.require_active_storage(v_storage);
  if v_driver is not null and not exists (select 1 from public.drivers where id = v_driver and is_active) then
    raise exception 'Driver or agent not found or inactive.' using errcode = 'P0002';
  end if;
  if jsonb_array_length(coalesce(p -> 'lines', '[]')) = 0 then
    raise exception 'Add at least one product.' using errcode = '22023';
  end if;

  -- price the lines first (server is the source of truth)
  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    select * into v_prod from public.products where id = (v_line ->> 'product_id')::uuid and is_active;
    if v_prod.id is null then raise exception 'A product on this invoice is not available.' using errcode = 'P0002'; end if;
    v_qty := (v_line ->> 'qty')::numeric;
    v_price := coalesce((v_line ->> 'unit_price')::numeric, v_prod.selling_price);
    v_ldisc := round(coalesce((v_line ->> 'discount_amount')::numeric, 0), 2);
    if v_qty is null or v_qty <= 0 then raise exception 'Quantity must be above zero for %.', v_prod.name_en using errcode = '22023'; end if;
    if v_price < v_prod.selling_price and not app.has_perm('sales.price_override') then
      raise exception 'Price for % is below the list price; you need price-override permission.', v_prod.name_en using errcode = '42501';
    end if;
    if v_ldisc < 0 or v_ldisc > round(v_qty * v_price, 2) then raise exception 'Invalid line discount for %.', v_prod.name_en using errcode = '22023'; end if;
    v_subtotal := v_subtotal + round(v_qty * v_price, 2) - v_ldisc;
    v_kg := v_kg + v_qty * v_prod.weight_kg;
  end loop;
  if v_discount < 0 or v_discount > v_subtotal then raise exception 'Invoice discount cannot exceed the subtotal.' using errcode = '22023'; end if;
  v_taxable := v_subtotal - v_discount;
  if v_settings.vat_enabled then
    v_rate := v_settings.vat_rate;
    v_vat := round(v_taxable * v_rate / 100, 2);
  end if;
  v_total := v_taxable + v_vat;

  -- credit limit
  if v_customer.credit_limit is not null then
    select coalesce(sum(debit - credit), 0) into v_balance from public.journal_lines
      where party_type = 'customer' and party_id = v_customer.id and gl_code = '1200';
    if v_balance + v_total - v_pay > v_customer.credit_limit and not app.has_perm('sales.credit_override') then
      raise exception 'This sale takes % over their credit limit of %.', v_customer.name, v_customer.credit_limit using errcode = 'P0001';
    end if;
  end if;

  v_no := app.next_doc_no('INV');
  insert into public.sales (invoice_no, sale_date, customer_id, storage_id, driver_id, subtotal, discount_amount, taxable_amount,
    vat_rate, vat_amount, total, total_kg, notes)
  values (v_no, v_date, v_customer.id, v_storage, v_driver, v_subtotal, v_discount, v_taxable, v_rate, v_vat, v_total, round(v_kg, 3), p ->> 'notes')
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    v_n := v_n + 1;
    select * into v_prod from public.products where id = (v_line ->> 'product_id')::uuid;
    v_qty := (v_line ->> 'qty')::numeric;
    v_price := coalesce((v_line ->> 'unit_price')::numeric, v_prod.selling_price);
    v_ldisc := round(coalesce((v_line ->> 'discount_amount')::numeric, 0), 2);
    v_line_total := round(v_qty * v_price, 2) - v_ldisc;
    insert into public.sale_items (sale_id, line_no, product_id, qty, unit_price, discount_amount, line_total, weight_kg)
    values (v_id, v_n, v_prod.id, v_qty, v_price, v_ldisc, v_line_total, round(v_qty * v_prod.weight_kg, 3))
    returning id into v_item;
    v_line_cogs := app.consume_stock(v_prod.id, v_storage, v_qty, null, 'sale', 'sale', v_id, v_item, v_date);
    update public.sale_items set cogs = v_line_cogs where id = v_item;
    v_cogs := v_cogs + v_line_cogs;
  end loop;

  select * into v_comm from app.calc_commission(v_driver, v_taxable, v_kg);
  if v_driver is not null and v_comm.amount > 0 then
    insert into public.commissions (driver_id, sale_id, rule, rate, basis, amount)
    values (v_driver, v_id, v_comm.rule, v_comm.rate, v_comm.basis, v_comm.amount);
  end if;
  update public.sales set cogs_total = v_cogs, commission_amount = coalesce(case when v_driver is not null then v_comm.amount end, 0) where id = v_id;

  perform app.post_journal(v_date, 'sale', v_id, 'Sale ' || v_no, jsonb_build_array(
    jsonb_build_object('gl', '1200', 'dr', v_total, 'party_type', 'customer', 'party_id', v_customer.id),
    jsonb_build_object('gl', '4100', 'cr', v_taxable),
    jsonb_build_object('gl', '2200', 'cr', v_vat),
    jsonb_build_object('gl', '5100', 'dr', v_cogs),
    jsonb_build_object('gl', '1300', 'cr', v_cogs),
    jsonb_build_object('gl', '5300', 'dr', case when v_driver is not null then v_comm.amount else 0 end),
    jsonb_build_object('gl', '2300', 'cr', case when v_driver is not null then v_comm.amount else 0 end,
      'party_type', case when v_driver is not null then 'driver' end, 'party_id', v_driver)));

  if v_pay > 0 then
    if v_pay > v_total then raise exception 'Payment cannot exceed the invoice total.' using errcode = '22023'; end if;
    if not (app.has_perm('payments.create') or app.has_perm('sales.collect')) then
      raise exception 'You do not have permission to record payments.' using errcode = '42501';
    end if;
    perform app.payment_create_internal((p -> 'payment') || jsonb_build_object(
      'purpose', 'customer_receipt', 'party_id', v_customer.id, 'date', v_date,
      'allocations', jsonb_build_array(jsonb_build_object('doc_type', 'sale', 'doc_id', v_id, 'amount', v_pay))));
  end if;

  if p ? 'delivery' and jsonb_typeof(p -> 'delivery') = 'object' then
    insert into public.deliveries (delivery_no, sale_id, customer_id, driver_id, vehicle_no, scheduled_date, address, notes)
    values (app.next_doc_no('DLV'), v_id, v_customer.id, v_driver,
      coalesce(p -> 'delivery' ->> 'vehicle_no', (select vehicle_no from public.drivers where id = v_driver)),
      coalesce((p -> 'delivery' ->> 'scheduled_date')::date, v_date),
      coalesce(p -> 'delivery' ->> 'address', v_customer.address), p -> 'delivery' ->> 'notes');
    insert into public.delivery_events (delivery_id, status, note)
    select id, 'pending', 'Created with invoice ' || v_no from public.deliveries where sale_id = v_id;
  end if;
  return v_id;
end $$;

-- p: { sale_id, date, reason, storage_id?, lines: [{ sale_item_id, qty }], refund?: { amount, method_id, money_account_id, reference } }
create or replace function public.sale_return_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  s public.sales;
  it public.sale_items;
  v_id uuid;
  v_no text;
  v_line jsonb;
  v_qty numeric;
  v_share numeric;
  v_net numeric;
  v_cost numeric;
  v_sum_net numeric := 0;
  v_sum_cost numeric := 0;
  v_vat numeric;
  v_comm numeric := 0;
  v_batch uuid;
  v_storage uuid;
  v_date date := coalesce((p ->> 'date')::date, app.today());
begin
  perform app.require_perm('sales.create');
  perform app.set_reason(p ->> 'reason');
  select * into s from public.sales where id = (p ->> 'sale_id')::uuid for update;
  if s.id is null or s.status <> 'posted' then raise exception 'Invoice not found or cancelled.' using errcode = 'P0002'; end if;
  v_storage := coalesce((p ->> 'storage_id')::uuid, s.storage_id);
  perform app.require_active_storage(v_storage);

  v_no := app.next_doc_no('SRT');
  insert into public.sale_returns (return_no, sale_id, customer_id, return_date, storage_id, reason)
  values (v_no, s.id, s.customer_id, v_date, v_storage, p ->> 'reason') returning id into v_id;

  for v_line in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]')) loop
    v_qty := (v_line ->> 'qty')::numeric;
    continue when coalesce(v_qty, 0) <= 0;
    select * into it from public.sale_items where id = (v_line ->> 'sale_item_id')::uuid and sale_id = s.id for update;
    if it.id is null then raise exception 'Return line does not belong to this invoice.' using errcode = '22023'; end if;
    if v_qty > it.qty - it.returned_qty then
      raise exception 'Cannot return more than was sold (% left).', it.qty - it.returned_qty using errcode = '22023';
    end if;
    v_share := v_qty / it.qty;
    v_net := round(it.line_total * v_share * case when s.subtotal > 0 then s.taxable_amount / s.subtotal else 1 end, 2);
    v_cost := round(it.cogs * v_share, 2);
    -- back into the batch the goods mostly came from, at their original cost
    select batch_id into v_batch from public.stock_movements
      where source_type = 'sale' and source_line_id = it.id order by qty asc limit 1;
    perform app.add_stock(it.product_id, v_batch, v_storage, v_qty, case when v_qty > 0 then v_cost / v_qty else 0 end,
      'sale_return', 'sale_return', v_id, it.id, v_date, p ->> 'reason');
    insert into public.sale_return_items (return_id, sale_item_id, qty, net_amount, cost) values (v_id, it.id, v_qty, v_net, v_cost);
    update public.sale_items set returned_qty = returned_qty + v_qty where id = it.id;
    v_sum_net := v_sum_net + v_net;
    v_sum_cost := v_sum_cost + v_cost;
  end loop;
  if v_sum_net = 0 and v_sum_cost = 0 then raise exception 'Enter a quantity to return.' using errcode = '22023'; end if;

  v_vat := round(v_sum_net * s.vat_rate / 100, 2);
  if s.taxable_amount > 0 and s.commission_amount > 0 then
    v_comm := round(s.commission_amount * v_sum_net / s.taxable_amount, 2);
    insert into public.commissions (driver_id, sale_id, sale_return_id, rule, rate, basis, amount, note)
    select s.driver_id, s.id, v_id, rule, rate, 0, -v_comm, 'Reversal for return ' || v_no
    from public.commissions where sale_id = s.id and sale_return_id is null limit 1;
  end if;

  update public.sale_returns set net_amount = v_sum_net, vat_amount = v_vat, total = v_sum_net + v_vat, cost = v_sum_cost where id = v_id;
  update public.sales set returned_total = returned_total + v_sum_net + v_vat where id = s.id;

  perform app.post_journal(v_date, 'sale_return', v_id, 'Sales return ' || v_no, jsonb_build_array(
    jsonb_build_object('gl', '4110', 'dr', v_sum_net),
    jsonb_build_object('gl', '2200', 'dr', v_vat),
    jsonb_build_object('gl', '1200', 'cr', v_sum_net + v_vat, 'party_type', 'customer', 'party_id', s.customer_id),
    jsonb_build_object('gl', '1300', 'dr', v_sum_cost),
    jsonb_build_object('gl', '5100', 'cr', v_sum_cost),
    jsonb_build_object('gl', '2300', 'dr', v_comm, 'party_type', case when v_comm > 0 then 'driver' end, 'party_id', case when v_comm > 0 then s.driver_id end),
    jsonb_build_object('gl', '5300', 'cr', v_comm)));
  perform app.refresh_payment_status('sale', s.id);

  if p ? 'refund' and coalesce((p -> 'refund' ->> 'amount')::numeric, 0) > 0 then
    perform app.require_perm('payments.create');
    perform app.payment_create_internal((p -> 'refund') || jsonb_build_object('purpose', 'customer_refund', 'party_id', s.customer_id, 'date', v_date));
  end if;
  return v_id;
end $$;

create or replace function public.sale_cancel(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  s public.sales;
begin
  perform app.require_perm('sales.cancel');
  perform app.set_reason(p_reason);
  select * into s from public.sales where id = p_id for update;
  if s.id is null or s.status <> 'posted' then raise exception 'Invoice not found or already cancelled.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.sale_returns where sale_id = p_id) then
    raise exception 'This invoice has returns and cannot be cancelled.' using errcode = '22023';
  end if;
  if exists (select 1 from public.payment_allocations pa join public.payments py on py.id = pa.payment_id
             where pa.doc_type = 'sale' and pa.doc_id = p_id and py.status <> 'cancelled') then
    raise exception 'Cancel the payments linked to this invoice first.' using errcode = '22023';
  end if;
  if exists (select 1 from public.deliveries where sale_id = p_id and status in ('in_transit', 'delivered')) then
    raise exception 'This invoice has a delivery in transit or delivered; record a return instead.' using errcode = '22023';
  end if;
  -- put stock back exactly where it came from
  insert into public.stock_movements (product_id, batch_id, storage_id, qty, unit_cost, movement_type, source_type, source_id, source_line_id, notes)
  select product_id, batch_id, storage_id, -qty, unit_cost, 'cancellation', 'sale', p_id, source_line_id, p_reason
  from public.stock_movements where source_type = 'sale' and source_id = p_id and movement_type = 'sale';
  insert into public.commissions (driver_id, sale_id, rule, rate, basis, amount, note)
  select driver_id, sale_id, rule, rate, 0, -amount, 'Invoice cancelled' from public.commissions where sale_id = p_id and sale_return_id is null and amount > 0;
  perform app.reverse_journal('sale', p_id, 'Cancelled: ' || p_reason);
  update public.deliveries set status = 'cancelled' where sale_id = p_id and status in ('pending', 'failed');
  update public.sales set status = 'cancelled', cancel_reason = p_reason, cancelled_at = now(), cancelled_by = auth.uid() where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Deliveries
-- ---------------------------------------------------------------------
create or replace function app.my_driver_id() returns uuid
language sql stable security definer set search_path = public, app as $$
  select driver_id from public.profiles where id = auth.uid() and is_active
$$;

-- p: { sale_id?, customer_id, driver_id?, vehicle_no?, scheduled_date, address?, notes? }
create or replace function public.delivery_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id uuid;
  v_customer uuid := (p ->> 'customer_id')::uuid;
begin
  perform app.require_perm('deliveries.manage');
  if (p ->> 'sale_id') is not null then
    select customer_id into v_customer from public.sales where id = (p ->> 'sale_id')::uuid and status = 'posted';
    if v_customer is null then raise exception 'Invoice not found or cancelled.' using errcode = 'P0002'; end if;
  end if;
  if not exists (select 1 from public.customers where id = v_customer) then
    raise exception 'Customer not found.' using errcode = 'P0002';
  end if;
  insert into public.deliveries (delivery_no, sale_id, customer_id, driver_id, vehicle_no, scheduled_date, address, notes)
  values (app.next_doc_no('DLV'), (p ->> 'sale_id')::uuid, v_customer, (p ->> 'driver_id')::uuid, p ->> 'vehicle_no',
    coalesce((p ->> 'scheduled_date')::date, app.today()),
    coalesce(p ->> 'address', (select address from public.customers where id = v_customer)), p ->> 'notes')
  returning id into v_id;
  insert into public.delivery_events (delivery_id, status, note) values (v_id, 'pending', 'Created');
  return v_id;
end $$;

-- p: { status, note?, recipient_name?, proof_photo_path?, signature_path?, driver_id?, vehicle_no? }
create or replace function public.delivery_update(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  d public.deliveries;
  v_status public.delivery_status := (p ->> 'status')::public.delivery_status;
begin
  select * into d from public.deliveries where id = p_id for update;
  if d.id is null then raise exception 'Delivery not found.' using errcode = 'P0002'; end if;
  if not (app.has_perm('deliveries.manage') or (d.driver_id is not null and d.driver_id = app.my_driver_id() and app.has_perm('deliveries.own'))) then
    raise exception 'Permission denied: deliveries.manage' using errcode = '42501';
  end if;
  if d.status in ('delivered', 'cancelled') then
    raise exception 'This delivery is already %.', d.status using errcode = '22023';
  end if;
  if v_status = 'cancelled' and not app.has_perm('deliveries.manage') then
    raise exception 'Only managers can cancel deliveries.' using errcode = '42501';
  end if;
  if v_status = 'delivered' and coalesce(p ->> 'proof_photo_path', d.proof_photo_path) is null
     and coalesce(p ->> 'signature_path', d.signature_path) is null then
    raise exception 'Add a delivery photo or the customer signature before marking delivered.' using errcode = '22023';
  end if;
  update public.deliveries set
    status = v_status,
    driver_id = case when app.has_perm('deliveries.manage') and p ? 'driver_id' then (p ->> 'driver_id')::uuid else driver_id end,
    vehicle_no = coalesce(p ->> 'vehicle_no', vehicle_no),
    dispatched_at = case when v_status = 'in_transit' and dispatched_at is null then now() else dispatched_at end,
    delivered_at = case when v_status = 'delivered' then now() else delivered_at end,
    recipient_name = coalesce(p ->> 'recipient_name', recipient_name),
    proof_photo_path = coalesce(p ->> 'proof_photo_path', proof_photo_path),
    signature_path = coalesce(p ->> 'signature_path', signature_path),
    notes = coalesce(p ->> 'notes', notes)
  where id = p_id;
  insert into public.delivery_events (delivery_id, status, note) values (p_id, v_status, p ->> 'note');
end $$;

-- ---------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_no text unique not null,
  expense_date date not null,
  category_id uuid not null references public.expense_categories (id),
  amount numeric(14, 2) not null check (amount > 0),
  vat_amount numeric(14, 2) not null default 0 check (vat_amount >= 0),
  money_account_id uuid not null references public.money_accounts (id),
  method_id uuid references public.payment_methods (id),
  payee text,
  description text,
  reference text,
  receipt_path text,
  status public.doc_status not null default 'posted',
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (expense_date desc);

-- p: { date, category_id, amount, vat_amount, money_account_id, method_id, payee, description, reference, receipt_path }
create or replace function public.expense_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id uuid;
  v_no text;
  v_amount numeric := round((p ->> 'amount')::numeric, 2);
  v_vat numeric := round(coalesce((p ->> 'vat_amount')::numeric, 0), 2);
  v_acct public.money_accounts;
  v_date date := coalesce((p ->> 'date')::date, app.today());
begin
  perform app.require_perm('expenses.create');
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount above zero.' using errcode = '22023'; end if;
  if not exists (select 1 from public.expense_categories where id = (p ->> 'category_id')::uuid and is_active) then
    raise exception 'Choose an expense category.' using errcode = '22023';
  end if;
  select * into v_acct from public.money_accounts where id = (p ->> 'money_account_id')::uuid and is_active;
  if v_acct.id is null then raise exception 'Choose the account the expense was paid from.' using errcode = '22023'; end if;
  if v_acct.kind = 'cash' and (select coalesce(sum(debit - credit), 0) from public.journal_lines where money_account_id = v_acct.id) < v_amount + v_vat then
    raise exception 'Not enough cash in % for this expense.', v_acct.name_en using errcode = 'P0001';
  end if;
  v_no := app.next_doc_no('EXP');
  insert into public.expenses (expense_no, expense_date, category_id, amount, vat_amount, money_account_id, method_id, payee, description, reference, receipt_path)
  values (v_no, v_date, (p ->> 'category_id')::uuid, v_amount, v_vat, v_acct.id, (p ->> 'method_id')::uuid,
    p ->> 'payee', p ->> 'description', p ->> 'reference', nullif(p ->> 'receipt_path', ''))
  returning id into v_id;
  perform app.post_journal(v_date, 'expense', v_id, 'Expense ' || v_no, jsonb_build_array(
    jsonb_build_object('gl', '6000', 'dr', v_amount),
    jsonb_build_object('gl', '1500', 'dr', v_vat),
    jsonb_build_object('gl', app.money_gl(v_acct.id), 'cr', v_amount + v_vat, 'money_account_id', v_acct.id)));
  return v_id;
end $$;

create or replace function public.expense_cancel(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_perm('finance.adjust');
  perform app.set_reason(p_reason);
  if not exists (select 1 from public.expenses where id = p_id and status = 'posted') then
    raise exception 'Expense not found or already cancelled.' using errcode = 'P0002';
  end if;
  perform app.reverse_journal('expense', p_id, 'Cancelled: ' || p_reason);
  update public.expenses set status = 'cancelled', cancel_reason = p_reason, cancelled_at = now(), cancelled_by = auth.uid() where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Internal transfers & daily cash closing
-- ---------------------------------------------------------------------
create table public.money_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text unique not null,
  transfer_date date not null,
  from_account_id uuid not null references public.money_accounts (id),
  to_account_id uuid not null references public.money_accounts (id),
  amount numeric(14, 2) not null check (amount > 0),
  reference text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create or replace function public.money_transfer_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id uuid;
  v_from public.money_accounts;
  v_to public.money_accounts;
  v_amount numeric := round((p ->> 'amount')::numeric, 2);
  v_date date := coalesce((p ->> 'date')::date, app.today());
begin
  perform app.require_perm('accounts.transfer');
  select * into v_from from public.money_accounts where id = (p ->> 'from_account_id')::uuid and is_active;
  select * into v_to from public.money_accounts where id = (p ->> 'to_account_id')::uuid and is_active;
  if v_from.id is null or v_to.id is null or v_from.id = v_to.id then
    raise exception 'Choose two different active accounts.' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount above zero.' using errcode = '22023'; end if;
  if (select coalesce(sum(debit - credit), 0) from public.journal_lines where money_account_id = v_from.id) < v_amount then
    raise exception 'Not enough balance in % for this transfer.', v_from.name_en using errcode = 'P0001';
  end if;
  insert into public.money_transfers (transfer_no, transfer_date, from_account_id, to_account_id, amount, reference, notes)
  values (app.next_doc_no('MTR'), v_date, v_from.id, v_to.id, v_amount, p ->> 'reference', p ->> 'notes')
  returning id into v_id;
  perform app.post_journal(v_date, 'money_transfer', v_id, 'Transfer ' || v_from.name_en || ' → ' || v_to.name_en, jsonb_build_array(
    jsonb_build_object('gl', app.money_gl(v_to.id), 'dr', v_amount, 'money_account_id', v_to.id),
    jsonb_build_object('gl', app.money_gl(v_from.id), 'cr', v_amount, 'money_account_id', v_from.id)));
  return v_id;
end $$;

create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  money_account_id uuid not null references public.money_accounts (id),
  closing_date date not null,
  expected_balance numeric(14, 2) not null,
  counted_amount numeric(14, 2) not null check (counted_amount >= 0),
  difference numeric(14, 2) not null,
  notes text,
  closed_by uuid default auth.uid(),
  closed_at timestamptz not null default now(),
  unique (money_account_id, closing_date)
);

create or replace function public.cash_closing_create(p_account uuid, p_date date, p_counted numeric, p_notes text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id uuid;
  v_expected numeric;
  v_diff numeric;
begin
  perform app.require_perm('accounts.close');
  if not exists (select 1 from public.money_accounts where id = p_account and kind = 'cash' and is_active) then
    raise exception 'Choose an active cash account.' using errcode = '22023';
  end if;
  if p_counted is null or p_counted < 0 then raise exception 'Enter the counted cash.' using errcode = '22023'; end if;
  select coalesce(sum(l.debit - l.credit), 0) into v_expected
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.money_account_id = p_account and e.entry_date <= p_date;
  v_diff := round(p_counted - v_expected, 2);
  if v_diff <> 0 and coalesce(length(trim(p_notes)), 0) < 3 then
    raise exception 'Explain the difference of % in the notes.', v_diff using errcode = '22023';
  end if;
  insert into public.cash_closings (money_account_id, closing_date, expected_balance, counted_amount, difference, notes)
  values (p_account, p_date, v_expected, p_counted, v_diff, p_notes) returning id into v_id;
  if v_diff <> 0 then
    perform app.post_journal(p_date, 'cash_closing', v_id, 'Cash over/short on ' || p_date, jsonb_build_array(
      jsonb_build_object('gl', '1100', 'dr', v_diff, 'money_account_id', p_account),
      jsonb_build_object('gl', '5900', 'cr', v_diff)));
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create trigger sales_audit after insert or update on public.sales for each row execute function app.audit();
create trigger sales_no_delete before delete on public.sales for each row execute function app.prevent_delete();
create trigger sale_items_no_delete before delete on public.sale_items for each row execute function app.prevent_delete();
create trigger sale_returns_audit after insert on public.sale_returns for each row execute function app.audit();
create trigger payments_audit after insert or update on public.payments for each row execute function app.audit();
create trigger payments_no_delete before delete on public.payments for each row execute function app.prevent_delete();
create trigger payment_allocations_no_delete before delete on public.payment_allocations for each row execute function app.prevent_delete();
create trigger expenses_audit after insert or update on public.expenses for each row execute function app.audit();
create trigger expenses_no_delete before delete on public.expenses for each row execute function app.prevent_delete();
create trigger deliveries_audit after insert or update on public.deliveries for each row execute function app.audit();
create trigger money_transfers_audit after insert on public.money_transfers for each row execute function app.audit();
create trigger cash_closings_audit after insert on public.cash_closings for each row execute function app.audit();
create trigger commissions_no_delete before delete on public.commissions for each row execute function app.prevent_delete();
