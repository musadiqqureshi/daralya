-- =====================================================================
-- 0003 INVENTORY (batches, movements, transfers, adjustments) + PURCHASES
-- =====================================================================

create type public.movement_type as enum (
  'opening', 'purchase', 'purchase_return', 'sale', 'sale_return',
  'transfer_out', 'transfer_in', 'damage', 'wastage', 'adjustment_in', 'adjustment_out', 'cancellation'
);
create type public.doc_status as enum ('posted', 'cancelled');
create type public.pay_status as enum ('unpaid', 'partial', 'paid');

create table public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text unique not null,
  product_id uuid not null references public.products (id),
  supplier_id uuid references public.suppliers (id),
  purchase_id uuid,
  purchase_item_id uuid,
  source text not null default 'purchase' check (source in ('purchase', 'opening', 'adjustment')),
  received_date date not null,
  unit_cost numeric(14, 4) not null default 0 check (unit_cost >= 0),
  initial_qty numeric(14, 3) not null,
  expiry_date date,
  notes text,
  created_at timestamptz not null default now()
);
create index stock_batches_product_idx on public.stock_batches (product_id, received_date);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  movement_date date not null default app.today(),
  created_at timestamptz not null default now(),
  product_id uuid not null references public.products (id),
  batch_id uuid not null references public.stock_batches (id),
  storage_id uuid not null references public.storages (id),
  qty numeric(14, 3) not null check (qty <> 0),
  unit_cost numeric(14, 4) not null default 0,
  movement_type public.movement_type not null,
  source_type text not null,
  source_id uuid,
  source_line_id uuid,
  notes text,
  created_by uuid default auth.uid()
);
create index stock_movements_ps_idx on public.stock_movements (product_id, storage_id);
create index stock_movements_batch_idx on public.stock_movements (batch_id);
create index stock_movements_source_idx on public.stock_movements (source_type, source_id);
create trigger stock_movements_no_delete before delete on public.stock_movements
  for each row execute function app.prevent_delete();
create trigger stock_movements_no_update before update on public.stock_movements
  for each row execute function app.prevent_delete();

create view public.v_stock_levels with (security_invoker = true) as
select m.product_id, m.storage_id, m.batch_id, sum(m.qty)::numeric(14, 3) as qty
from public.stock_movements m
group by m.product_id, m.storage_id, m.batch_id
having sum(m.qty) <> 0;

create view public.v_product_stock with (security_invoker = true) as
select p.id as product_id, p.sku, p.name_en, p.name_ar, p.variety, p.grade, p.unit, p.weight_kg, p.min_stock, p.is_active,
  coalesce(sum(m.qty), 0)::numeric(14, 3) as qty,
  (coalesce(sum(m.qty), 0) <= p.min_stock) as is_low
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;

-- ---------------------------------------------------------------------
-- Stock primitives (internal; called only from security-definer RPCs)
-- ---------------------------------------------------------------------
create or replace function app.add_stock(
  p_product uuid, p_batch uuid, p_storage uuid, p_qty numeric, p_unit_cost numeric,
  p_type public.movement_type, p_source_type text, p_source_id uuid, p_line_id uuid, p_date date, p_notes text default null
) returns void
language plpgsql as $$
begin
  if p_qty <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = '22023';
  end if;
  insert into public.stock_movements (movement_date, product_id, batch_id, storage_id, qty, unit_cost, movement_type, source_type, source_id, source_line_id, notes)
  values (coalesce(p_date, app.today()), p_product, p_batch, p_storage, p_qty, coalesce(p_unit_cost, 0), p_type, p_source_type, p_source_id, p_line_id, p_notes);
end $$;

-- FIFO by batch within one storage. Returns the total cost removed.
create or replace function app.consume_stock(
  p_product uuid, p_storage uuid, p_qty numeric, p_batch uuid,
  p_type public.movement_type, p_source_type text, p_source_id uuid, p_line_id uuid, p_date date, p_notes text default null
) returns numeric
language plpgsql as $$
declare
  v_remaining numeric := p_qty;
  v_take numeric;
  v_cost numeric := 0;
  v_allow boolean;
  v_name text;
  v_last record;
  r record;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = '22023';
  end if;
  -- serialise all stock changes for this product
  select name_en into v_name from public.products where id = p_product for update;
  if v_name is null then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  for r in
    select m.batch_id, sum(m.qty) as avail, b.unit_cost
    from public.stock_movements m
    join public.stock_batches b on b.id = m.batch_id
    where m.product_id = p_product and m.storage_id = p_storage and (p_batch is null or m.batch_id = p_batch)
    group by m.batch_id, b.unit_cost, b.received_date, b.batch_no
    having sum(m.qty) > 0
    order by b.received_date, b.batch_no
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, r.avail);
    insert into public.stock_movements (movement_date, product_id, batch_id, storage_id, qty, unit_cost, movement_type, source_type, source_id, source_line_id, notes)
    values (coalesce(p_date, app.today()), p_product, r.batch_id, p_storage, -v_take, r.unit_cost, p_type, p_source_type, p_source_id, p_line_id, p_notes);
    v_cost := v_cost + v_take * r.unit_cost;
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    select allow_negative_stock into v_allow from public.settings where id = 1;
    if not (v_allow and app.is_owner()) then
      raise exception 'Insufficient stock for % in the selected storage (short by %).', v_name, round(v_remaining, 3)
        using errcode = 'P0001';
    end if;
    select id, unit_cost into v_last from public.stock_batches
      where product_id = p_product and (p_batch is null or id = p_batch)
      order by received_date desc, batch_no desc limit 1;
    if v_last.id is null then
      raise exception 'No batch exists for % — record a purchase or opening stock first.', v_name using errcode = 'P0001';
    end if;
    insert into public.stock_movements (movement_date, product_id, batch_id, storage_id, qty, unit_cost, movement_type, source_type, source_id, source_line_id, notes)
    values (coalesce(p_date, app.today()), p_product, v_last.id, p_storage, -v_remaining, v_last.unit_cost, p_type, p_source_type, p_source_id, p_line_id,
      coalesce(p_notes || ' ', '') || '(owner-approved negative stock)');
    v_cost := v_cost + v_remaining * v_last.unit_cost;
  end if;
  return round(v_cost, 2);
end $$;

create or replace function app.storage_load_kg(p_storage uuid) returns numeric
language sql stable as $$
  select coalesce(sum(m.qty * p.weight_kg), 0)
  from public.stock_movements m join public.products p on p.id = m.product_id
  where m.storage_id = p_storage
$$;

create or replace function app.check_capacity(p_storage uuid) returns void
language plpgsql as $$
declare
  v_cap numeric;
  v_name text;
  v_load numeric;
begin
  select capacity_kg, name_en into v_cap, v_name from public.storages where id = p_storage;
  if v_cap is null then return; end if;
  v_load := app.storage_load_kg(p_storage);
  if v_load > v_cap then
    raise exception 'Storage % would exceed its capacity (% kg of % kg).', v_name, round(v_load, 1), v_cap using errcode = 'P0001';
  end if;
end $$;

create or replace function app.require_active_storage(p_storage uuid) returns void
language plpgsql as $$
begin
  if not exists (select 1 from public.storages where id = p_storage and is_active) then
    raise exception 'Storage not found or inactive.' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Opening stock (owner/settings) — Dr Inventory, Cr Opening equity
-- p: { storage_id, date, lines: [{ product_id, qty, unit_cost, expiry_date }] }
-- ---------------------------------------------------------------------
create or replace function public.stock_opening_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_src uuid := gen_random_uuid();
  v_line jsonb;
  v_batch uuid;
  v_total numeric := 0;
  v_storage uuid := (p ->> 'storage_id')::uuid;
  v_date date := coalesce((p ->> 'date')::date, app.today());
begin
  perform app.require_perm('settings.manage');
  perform app.require_active_storage(v_storage);
  if jsonb_array_length(coalesce(p -> 'lines', '[]')) = 0 then
    raise exception 'Add at least one line.' using errcode = '22023';
  end if;
  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    insert into public.stock_batches (batch_no, product_id, source, received_date, unit_cost, initial_qty, expiry_date)
    values (app.next_doc_no('OPN'), (v_line ->> 'product_id')::uuid, 'opening', v_date,
      (v_line ->> 'unit_cost')::numeric, (v_line ->> 'qty')::numeric, (v_line ->> 'expiry_date')::date)
    returning id into v_batch;
    perform app.add_stock((v_line ->> 'product_id')::uuid, v_batch, v_storage, (v_line ->> 'qty')::numeric,
      (v_line ->> 'unit_cost')::numeric, 'opening', 'opening_stock', v_src, v_batch, v_date);
    v_total := v_total + round((v_line ->> 'qty')::numeric * (v_line ->> 'unit_cost')::numeric, 2);
  end loop;
  perform app.check_capacity(v_storage);
  perform app.post_journal(v_date, 'opening_stock', v_src, 'Opening stock', jsonb_build_array(
    jsonb_build_object('gl', '1300', 'dr', v_total),
    jsonb_build_object('gl', '3100', 'cr', v_total)));
  return v_src;
end $$;

-- ---------------------------------------------------------------------
-- Storage transfers
-- ---------------------------------------------------------------------
create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text unique not null,
  transfer_date date not null,
  from_storage_id uuid not null references public.storages (id),
  to_storage_id uuid not null references public.storages (id),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_storage_id <> to_storage_id)
);

create table public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.stock_transfers (id),
  product_id uuid not null references public.products (id),
  batch_id uuid references public.stock_batches (id),
  qty numeric(14, 3) not null check (qty > 0)
);

-- p: { from_storage_id, to_storage_id, date, notes, lines: [{ product_id, batch_id?, qty }] }
create or replace function public.stock_transfer_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id uuid;
  v_item uuid;
  v_line jsonb;
  v_from uuid := (p ->> 'from_storage_id')::uuid;
  v_to uuid := (p ->> 'to_storage_id')::uuid;
  v_date date := coalesce((p ->> 'date')::date, app.today());
  m record;
begin
  perform app.require_perm('inventory.transfer');
  perform app.require_active_storage(v_from);
  perform app.require_active_storage(v_to);
  if v_from = v_to then
    raise exception 'Choose two different storages.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p -> 'lines', '[]')) = 0 then
    raise exception 'Add at least one product to transfer.' using errcode = '22023';
  end if;

  insert into public.stock_transfers (transfer_no, transfer_date, from_storage_id, to_storage_id, notes)
  values (app.next_doc_no('TRF'), v_date, v_from, v_to, p ->> 'notes')
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    insert into public.stock_transfer_items (transfer_id, product_id, batch_id, qty)
    values (v_id, (v_line ->> 'product_id')::uuid, (v_line ->> 'batch_id')::uuid, (v_line ->> 'qty')::numeric)
    returning id into v_item;
    perform app.consume_stock((v_line ->> 'product_id')::uuid, v_from, (v_line ->> 'qty')::numeric,
      (v_line ->> 'batch_id')::uuid, 'transfer_out', 'transfer', v_id, v_item, v_date);
    -- mirror exactly the batches that left the source storage
    for m in
      select batch_id, unit_cost, -qty as qty from public.stock_movements
      where source_type = 'transfer' and source_line_id = v_item and movement_type = 'transfer_out'
    loop
      perform app.add_stock((v_line ->> 'product_id')::uuid, m.batch_id, v_to, m.qty, m.unit_cost,
        'transfer_in', 'transfer', v_id, v_item, v_date);
    end loop;
  end loop;
  perform app.check_capacity(v_to);
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Damage / wastage / adjustments (request → approve)
-- ---------------------------------------------------------------------
create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  adj_no text unique not null,
  adj_date date not null,
  storage_id uuid not null references public.storages (id),
  adj_type text not null check (adj_type in ('damage', 'wastage', 'adjustment_in', 'adjustment_out')),
  reason text not null check (length(trim(reason)) >= 3),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  total_cost numeric(14, 2) not null default 0,
  requested_by uuid default auth.uid(),
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text
);

create table public.stock_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.stock_adjustments (id),
  product_id uuid not null references public.products (id),
  batch_id uuid references public.stock_batches (id),
  qty numeric(14, 3) not null check (qty > 0),
  unit_cost numeric(14, 4) check (unit_cost is null or unit_cost >= 0)
);

-- p: { storage_id, date, adj_type, reason, lines: [{ product_id, batch_id?, qty, unit_cost? }] }
create or replace function public.stock_adjustment_request(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id uuid;
  v_line jsonb;
begin
  perform app.require_perm('inventory.adjust_request');
  perform app.require_active_storage((p ->> 'storage_id')::uuid);
  if jsonb_array_length(coalesce(p -> 'lines', '[]')) = 0 then
    raise exception 'Add at least one line.' using errcode = '22023';
  end if;
  insert into public.stock_adjustments (adj_no, adj_date, storage_id, adj_type, reason)
  values (app.next_doc_no('ADJ'), coalesce((p ->> 'date')::date, app.today()), (p ->> 'storage_id')::uuid, p ->> 'adj_type', p ->> 'reason')
  returning id into v_id;
  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    insert into public.stock_adjustment_items (adjustment_id, product_id, batch_id, qty, unit_cost)
    values (v_id, (v_line ->> 'product_id')::uuid, (v_line ->> 'batch_id')::uuid, (v_line ->> 'qty')::numeric, (v_line ->> 'unit_cost')::numeric);
  end loop;
  return v_id;
end $$;

create or replace function public.stock_adjustment_review(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  a public.stock_adjustments;
  i public.stock_adjustment_items;
  v_cost numeric := 0;
  v_line_cost numeric;
  v_batch uuid;
  v_unit numeric;
begin
  perform app.require_perm('inventory.adjust_approve');
  select * into a from public.stock_adjustments where id = p_id for update;
  if a.id is null then raise exception 'Adjustment not found.' using errcode = 'P0002'; end if;
  if a.status <> 'pending' then raise exception 'This adjustment has already been reviewed.' using errcode = '22023'; end if;

  if not p_approve then
    update public.stock_adjustments set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note where id = p_id;
    return;
  end if;

  for i in select * from public.stock_adjustment_items where adjustment_id = p_id loop
    if a.adj_type = 'adjustment_in' then
      v_batch := i.batch_id;
      if v_batch is null then
        select coalesce(i.unit_cost, purchase_price) into v_unit from public.products where id = i.product_id;
        insert into public.stock_batches (batch_no, product_id, source, received_date, unit_cost, initial_qty, notes)
        values (app.next_doc_no('B'), i.product_id, 'adjustment', a.adj_date, v_unit, i.qty, a.reason)
        returning id into v_batch;
      else
        select coalesce(i.unit_cost, unit_cost) into v_unit from public.stock_batches where id = v_batch;
      end if;
      perform app.add_stock(i.product_id, v_batch, a.storage_id, i.qty, v_unit, 'adjustment_in', 'adjustment', a.id, i.id, a.adj_date, a.reason);
      v_cost := v_cost + round(i.qty * v_unit, 2);
    else
      v_line_cost := app.consume_stock(i.product_id, a.storage_id, i.qty, i.batch_id,
        a.adj_type::public.movement_type, 'adjustment', a.id, i.id, a.adj_date, a.reason);
      v_cost := v_cost + v_line_cost;
    end if;
  end loop;

  if a.adj_type = 'adjustment_in' then
    perform app.check_capacity(a.storage_id);
    perform app.post_journal(a.adj_date, 'adjustment', a.id, 'Stock adjustment in: ' || a.reason, jsonb_build_array(
      jsonb_build_object('gl', '1300', 'dr', v_cost), jsonb_build_object('gl', '4900', 'cr', v_cost)));
  else
    perform app.post_journal(a.adj_date, 'adjustment', a.id, initcap(replace(a.adj_type, '_', ' ')) || ': ' || a.reason, jsonb_build_array(
      jsonb_build_object('gl', '5200', 'dr', v_cost), jsonb_build_object('gl', '1300', 'cr', v_cost)));
  end if;

  update public.stock_adjustments
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note, total_cost = v_cost
  where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_no text unique not null,
  supplier_id uuid not null references public.suppliers (id),
  purchase_date date not null,
  supplier_invoice_no text,
  storage_id uuid not null references public.storages (id),
  subtotal numeric(14, 2) not null default 0,
  transport_cost numeric(14, 2) not null default 0 check (transport_cost >= 0),
  loading_cost numeric(14, 2) not null default 0 check (loading_cost >= 0),
  other_cost numeric(14, 2) not null default 0 check (other_cost >= 0),
  extras_paid_from uuid references public.money_accounts (id),
  vat_amount numeric(14, 2) not null default 0 check (vat_amount >= 0),
  total numeric(14, 2) not null default 0,
  returned_total numeric(14, 2) not null default 0,
  paid_total numeric(14, 2) not null default 0,
  pending_total numeric(14, 2) not null default 0,
  payment_status public.pay_status not null default 'unpaid',
  status public.doc_status not null default 'posted',
  notes text,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index purchases_supplier_idx on public.purchases (supplier_id, purchase_date desc);
create index purchases_date_idx on public.purchases (purchase_date desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id),
  product_id uuid not null references public.products (id),
  storage_id uuid not null references public.storages (id),
  qty numeric(14, 3) not null check (qty > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null,
  landed_unit_cost numeric(14, 4) not null,
  batch_id uuid references public.stock_batches (id),
  expiry_date date,
  returned_qty numeric(14, 3) not null default 0
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

create table public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  return_no text unique not null,
  purchase_id uuid not null references public.purchases (id),
  supplier_id uuid not null references public.suppliers (id),
  return_date date not null,
  reason text not null,
  amount numeric(14, 2) not null default 0,
  vat_amount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.purchase_returns (id),
  purchase_item_id uuid not null references public.purchase_items (id),
  qty numeric(14, 3) not null check (qty > 0),
  amount numeric(14, 2) not null,
  cost numeric(14, 2) not null
);

/*
  p: { supplier_id, date, supplier_invoice_no, storage_id, notes,
       transport_cost, loading_cost, other_cost, extras_paid_from (money account or null), vat_amount,
       lines: [{ product_id, qty, unit_price, storage_id?, expiry_date? }],
       payment?: { amount, method_id, money_account_id, reference, proof_path, date } }
*/
create or replace function public.purchase_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id uuid;
  v_no text;
  v_line jsonb;
  v_item uuid;
  v_batch uuid;
  v_date date := coalesce((p ->> 'date')::date, app.today());
  v_storage uuid := (p ->> 'storage_id')::uuid;
  v_line_storage uuid;
  v_supplier uuid := (p ->> 'supplier_id')::uuid;
  v_transport numeric := coalesce((p ->> 'transport_cost')::numeric, 0);
  v_loading numeric := coalesce((p ->> 'loading_cost')::numeric, 0);
  v_other numeric := coalesce((p ->> 'other_cost')::numeric, 0);
  v_extras numeric;
  v_extras_acct uuid := (p ->> 'extras_paid_from')::uuid;
  v_vat numeric := round(coalesce((p ->> 'vat_amount')::numeric, 0), 2);
  v_subtotal numeric := 0;
  v_total numeric;
  v_qty numeric;
  v_price numeric;
  v_line_total numeric;
  v_landed numeric;
  v_lines jsonb := '[]'::jsonb;
  v_storages uuid[] := '{}';
  s uuid;
begin
  perform app.require_perm('purchases.create');
  if not exists (select 1 from public.suppliers where id = v_supplier and is_active) then
    raise exception 'Supplier not found or inactive.' using errcode = 'P0002';
  end if;
  perform app.require_active_storage(v_storage);
  if jsonb_array_length(coalesce(p -> 'lines', '[]')) = 0 then
    raise exception 'Add at least one product line.' using errcode = '22023';
  end if;
  if v_extras_acct is not null and not exists (select 1 from public.money_accounts where id = v_extras_acct and is_active) then
    raise exception 'Account for extra costs not found.' using errcode = 'P0002';
  end if;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    v_qty := (v_line ->> 'qty')::numeric;
    v_price := (v_line ->> 'unit_price')::numeric;
    if v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then
      raise exception 'Every line needs a quantity above zero and a valid price.' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  end loop;
  v_extras := v_transport + v_loading + v_other;
  v_total := v_subtotal + v_vat + case when v_extras_acct is null then v_extras else 0 end;

  v_no := app.next_doc_no('PUR');
  insert into public.purchases (purchase_no, supplier_id, purchase_date, supplier_invoice_no, storage_id, subtotal,
    transport_cost, loading_cost, other_cost, extras_paid_from, vat_amount, total, notes)
  values (v_no, v_supplier, v_date, p ->> 'supplier_invoice_no', v_storage, v_subtotal,
    v_transport, v_loading, v_other, v_extras_acct, v_vat, v_total, p ->> 'notes')
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    v_qty := (v_line ->> 'qty')::numeric;
    v_price := (v_line ->> 'unit_price')::numeric;
    v_line_total := round(v_qty * v_price, 2);
    v_line_storage := coalesce((v_line ->> 'storage_id')::uuid, v_storage);
    perform app.require_active_storage(v_line_storage);
    -- extra costs are spread over lines by value to get the landed cost
    v_landed := case when v_subtotal > 0
      then (v_line_total + v_extras * v_line_total / v_subtotal) / v_qty
      else v_price end;

    insert into public.purchase_items (purchase_id, product_id, storage_id, qty, unit_price, line_total, landed_unit_cost, expiry_date)
    values (v_id, (v_line ->> 'product_id')::uuid, v_line_storage, v_qty, v_price, v_line_total, round(v_landed, 4), (v_line ->> 'expiry_date')::date)
    returning id into v_item;

    insert into public.stock_batches (batch_no, product_id, supplier_id, purchase_id, purchase_item_id, received_date, unit_cost, initial_qty, expiry_date)
    values (app.next_doc_no('B'), (v_line ->> 'product_id')::uuid, v_supplier, v_id, v_item, v_date, round(v_landed, 4), v_qty, (v_line ->> 'expiry_date')::date)
    returning id into v_batch;
    update public.purchase_items set batch_id = v_batch where id = v_item;

    perform app.add_stock((v_line ->> 'product_id')::uuid, v_batch, v_line_storage, v_qty, round(v_landed, 4),
      'purchase', 'purchase', v_id, v_item, v_date);
    if not v_line_storage = any (v_storages) then v_storages := v_storages || v_line_storage; end if;
  end loop;

  foreach s in array v_storages loop
    perform app.check_capacity(s);
  end loop;

  v_lines := jsonb_build_array(
    jsonb_build_object('gl', '1300', 'dr', v_subtotal + v_extras),
    jsonb_build_object('gl', '1500', 'dr', v_vat),
    jsonb_build_object('gl', '2100', 'cr', v_total, 'party_type', 'supplier', 'party_id', v_supplier));
  if v_extras_acct is not null then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('gl', app.money_gl(v_extras_acct), 'cr', v_extras, 'money_account_id', v_extras_acct));
  end if;
  perform app.post_journal(v_date, 'purchase', v_id, 'Purchase ' || v_no, v_lines);

  if p ? 'payment' and coalesce((p -> 'payment' ->> 'amount')::numeric, 0) > 0 then
    perform app.payment_create_internal(
      (p -> 'payment') || jsonb_build_object(
        'direction', 'out', 'purpose', 'supplier_payment', 'party_type', 'supplier', 'party_id', v_supplier,
        'date', coalesce(p -> 'payment' ->> 'date', v_date::text),
        'allocations', jsonb_build_array(jsonb_build_object('doc_type', 'purchase', 'doc_id', v_id, 'amount', (p -> 'payment' ->> 'amount')::numeric)))
    );
  end if;
  return v_id;
end $$;

-- p: { purchase_id, date, reason, lines: [{ purchase_item_id, qty, storage_id? }] }
create or replace function public.purchase_return_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  pur public.purchases;
  it public.purchase_items;
  v_id uuid;
  v_no text;
  v_line jsonb;
  v_qty numeric;
  v_amount numeric;
  v_cost numeric;
  v_sum_amount numeric := 0;
  v_sum_cost numeric := 0;
  v_vat numeric;
  v_date date := coalesce((p ->> 'date')::date, app.today());
begin
  perform app.require_perm('purchases.create');
  select * into pur from public.purchases where id = (p ->> 'purchase_id')::uuid for update;
  if pur.id is null or pur.status <> 'posted' then
    raise exception 'Purchase not found or cancelled.' using errcode = 'P0002';
  end if;
  perform app.set_reason(p ->> 'reason');
  v_no := app.next_doc_no('PRT');
  insert into public.purchase_returns (return_no, purchase_id, supplier_id, return_date, reason)
  values (v_no, pur.id, pur.supplier_id, v_date, p ->> 'reason') returning id into v_id;

  for v_line in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]')) loop
    v_qty := (v_line ->> 'qty')::numeric;
    continue when coalesce(v_qty, 0) <= 0;
    select * into it from public.purchase_items where id = (v_line ->> 'purchase_item_id')::uuid and purchase_id = pur.id for update;
    if it.id is null then raise exception 'Return line does not belong to this purchase.' using errcode = '22023'; end if;
    if v_qty > it.qty - it.returned_qty then
      raise exception 'Cannot return more than was received (% left).', it.qty - it.returned_qty using errcode = '22023';
    end if;
    v_amount := round(v_qty * it.unit_price, 2);
    v_cost := app.consume_stock(it.product_id, coalesce((v_line ->> 'storage_id')::uuid, it.storage_id), v_qty, it.batch_id,
      'purchase_return', 'purchase_return', v_id, it.id, v_date, p ->> 'reason');
    insert into public.purchase_return_items (return_id, purchase_item_id, qty, amount, cost) values (v_id, it.id, v_qty, v_amount, v_cost);
    update public.purchase_items set returned_qty = returned_qty + v_qty where id = it.id;
    v_sum_amount := v_sum_amount + v_amount;
    v_sum_cost := v_sum_cost + v_cost;
  end loop;
  if v_sum_amount = 0 then raise exception 'Enter a quantity to return.' using errcode = '22023'; end if;

  v_vat := case when pur.subtotal > 0 then round(pur.vat_amount * v_sum_amount / pur.subtotal, 2) else 0 end;
  update public.purchase_returns set amount = v_sum_amount, vat_amount = v_vat, total = v_sum_amount + v_vat where id = v_id;
  update public.purchases set returned_total = returned_total + v_sum_amount + v_vat where id = pur.id;

  perform app.post_journal(v_date, 'purchase_return', v_id, 'Purchase return ' || v_no, jsonb_build_array(
    jsonb_build_object('gl', '2100', 'dr', v_sum_amount + v_vat, 'party_type', 'supplier', 'party_id', pur.supplier_id),
    jsonb_build_object('gl', '1500', 'cr', v_vat),
    jsonb_build_object('gl', '1300', 'cr', v_sum_cost),
    jsonb_build_object('gl', '5200', 'dr', v_sum_cost - v_sum_amount)));
  perform app.refresh_payment_status('purchase', pur.id);
  return v_id;
end $$;

create or replace function public.purchase_cancel(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  pur public.purchases;
  b record;
begin
  perform app.require_perm('purchases.cancel');
  perform app.set_reason(p_reason);
  select * into pur from public.purchases where id = p_id for update;
  if pur.id is null or pur.status <> 'posted' then
    raise exception 'Purchase not found or already cancelled.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.purchase_returns where purchase_id = p_id) then
    raise exception 'This purchase has returns and cannot be cancelled.' using errcode = '22023';
  end if;
  if exists (select 1 from public.payment_allocations pa join public.payments py on py.id = pa.payment_id
             where pa.doc_type = 'purchase' and pa.doc_id = p_id and py.status <> 'cancelled') then
    raise exception 'Cancel the payments linked to this purchase first.' using errcode = '22023';
  end if;
  -- every unit received must still be in stock
  for b in
    select sb.id, sb.initial_qty, sb.batch_no, coalesce(sum(m.qty), 0) as on_hand
    from public.stock_batches sb left join public.stock_movements m on m.batch_id = sb.id
    where sb.purchase_id = p_id group by sb.id
  loop
    if b.on_hand <> b.initial_qty then
      raise exception 'Batch % has already been sold or adjusted; use a purchase return instead.', b.batch_no using errcode = '22023';
    end if;
  end loop;
  -- remove the stock wherever it currently sits
  insert into public.stock_movements (product_id, batch_id, storage_id, qty, unit_cost, movement_type, source_type, source_id, notes)
  select l.product_id, l.batch_id, l.storage_id, -l.qty, sb.unit_cost, 'cancellation', 'purchase', p_id, p_reason
  from public.v_stock_levels l join public.stock_batches sb on sb.id = l.batch_id
  where sb.purchase_id = p_id and l.qty > 0;

  perform app.reverse_journal('purchase', p_id, 'Cancelled: ' || p_reason);
  update public.purchases set status = 'cancelled', cancel_reason = p_reason, cancelled_at = now(), cancelled_by = auth.uid() where id = p_id;
end $$;

create trigger purchases_audit after insert or update on public.purchases for each row execute function app.audit();
create trigger purchases_no_delete before delete on public.purchases for each row execute function app.prevent_delete();
create trigger purchase_items_no_delete before delete on public.purchase_items for each row execute function app.prevent_delete();
create trigger purchase_returns_audit after insert on public.purchase_returns for each row execute function app.audit();
create trigger stock_transfers_audit after insert on public.stock_transfers for each row execute function app.audit();
create trigger stock_adjustments_audit after insert or update on public.stock_adjustments for each row execute function app.audit();
create trigger stock_adjustments_no_delete before delete on public.stock_adjustments for each row execute function app.prevent_delete();
