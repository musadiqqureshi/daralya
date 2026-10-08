-- =====================================================================
-- 0011 SIMPLER SALESMAN ROLE
--   * a salesman sees only the invoices he created (managers see all)
--   * a salesman sees stock with the bought price per kg and the selling price
--   * a salesman's menu is reduced to Sell, My sales, Customers, Stock
-- =====================================================================

insert into public.permissions (code, module, label_en, label_ar) values
  ('sales.view_all', 'sales', 'See every salesman''s invoices', 'عرض فواتير جميع البائعين')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission) values
  ('manager', 'sales.view_all'),
  ('accountant', 'sales.view_all'),
  ('sales', 'products.view_cost')
on conflict do nothing;

-- the salesman works from the Sell screen; overall figures are for management
delete from public.role_permissions
where role = 'sales' and permission in ('dashboard.view', 'payments.view', 'inventory.view', 'deliveries.view', 'drivers.view');

-- Invoices: all (view_all) or only your own
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales for select to authenticated using (
  app.has_perm('sales.view_all')
  or (app.has_perm('sales.view') and created_by = auth.uid())
  or (driver_id is not null and driver_id = app.my_driver_id())
);
drop policy if exists sale_returns_read on public.sale_returns;
create policy sale_returns_read on public.sale_returns for select to authenticated using (exists (select 1 from public.sales s where s.id = sale_id));
drop policy if exists sale_return_items_read on public.sale_return_items;
create policy sale_return_items_read on public.sale_return_items for select to authenticated
  using (exists (select 1 from public.sale_returns r where r.id = return_id));

/*
  One row per product: stock on hand (total and per storage), list price and,
  for users allowed to see costs, the average bought cost of the stock on hand.
*/
create or replace function public.stock_overview()
returns table (
  product_id uuid, sku text, barcode text, name_en text, name_ar text, variety text, grade text,
  unit public.product_unit, weight_kg numeric, selling_price numeric, min_stock numeric,
  qty numeric, by_storage jsonb, cost_per_unit numeric, cost_per_kg numeric
)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_cost boolean := app.has_perm('products.view_cost');
begin
  if not (app.has_perm('inventory.view') or app.has_perm('sales.create')) then
    perform app.require_perm('inventory.view');
  end if;
  return query
  with lv as (
    select m.product_id, m.storage_id, sum(m.qty) as q, sum(m.qty * m.unit_cost) as v
    from public.stock_movements m group by m.product_id, m.storage_id
  ), agg as (
    select l.product_id, sum(l.q) as q, sum(l.v) as v,
      jsonb_object_agg(l.storage_id, round(l.q, 3)) filter (where l.q <> 0) as by_storage
    from lv l group by l.product_id
  )
  select p.id, p.sku, p.barcode, p.name_en, p.name_ar, p.variety, p.grade, p.unit, p.weight_kg, p.selling_price, p.min_stock,
    coalesce(a.q, 0)::numeric(14, 3),
    coalesce(a.by_storage, '{}'::jsonb),
    case when not v_cost then null
         when coalesce(a.q, 0) > 0 then round(a.v / a.q, 2)
         else p.purchase_price end,
    case when not v_cost then null
         when coalesce(a.q, 0) > 0 then round(a.v / a.q / p.weight_kg, 2)
         else round(p.purchase_price / p.weight_kg, 2) end
  from public.products p
  left join agg a on a.product_id = p.id
  where p.is_active
  order by p.sort_order, p.name_en;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
