-- =====================================================================
-- POS: wholesale price per product and a richer stock overview
-- (first photo + wholesale price) for the tap-to-sell product grid.
-- =====================================================================

alter table public.products add column if not exists wholesale_price numeric(12, 2)
  check (wholesale_price is null or wholesale_price >= 0);
comment on column public.products.wholesale_price is 'Suggested price for wholesale buyers (POS quick pick). Null = same as selling price.';

-- products has column-level grants (purchase_price hidden): expose the new column explicitly
grant select (wholesale_price) on public.products to authenticated;

drop function if exists public.stock_overview();
create function public.stock_overview()
returns table (
  product_id uuid, sku text, barcode text, name_en text, name_ar text, variety text, grade text,
  unit public.product_unit, weight_kg numeric, selling_price numeric, min_stock numeric,
  qty numeric, by_storage jsonb, cost_per_unit numeric, cost_per_kg numeric,
  wholesale_price numeric, image text
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
         else round(p.purchase_price / p.weight_kg, 2) end,
    p.wholesale_price,
    (select pi.src from public.product_images pi where pi.product_id = p.id order by pi.sort_order, pi.created_at limit 1)
  from public.products p
  left join agg a on a.product_id = p.id
  where p.is_active
  order by p.sort_order, p.name_en;
end $$;

revoke execute on function public.stock_overview() from public, anon;
grant execute on function public.stock_overview() to authenticated, service_role;
