-- =====================================================================
-- Fix: sales and purchase reports grouped by day failed with
-- "column must appear in the GROUP BY clause" (the day label used the
-- raw date column), so the Reports page showed "No data". Day reports
-- now also list dates chronologically; other groupings biggest first.
-- =====================================================================

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
    case p_group when 'day' then to_char(max(l.sale_date), 'YYYY-MM-DD') when 'product' then max(p.name_en) when 'customer' then max(c.name) else coalesce(max(d.name), 'No driver') end,
    case p_group when 'day' then to_char(max(l.sale_date), 'YYYY-MM-DD') when 'product' then max(p.name_ar) when 'customer' then coalesce(max(c.name_ar), max(c.name)) else coalesce(max(d.name_ar), max(d.name), 'بدون سائق') end,
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
  order by case when p_group = 'day' then 1 end, case when p_group <> 'day' then round(sum(l.net), 2) end desc nulls last, 1;
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
    case p_group when 'supplier' then max(su.name) when 'product' then max(p.name_en) else to_char(max(pu.purchase_date), 'YYYY-MM-DD') end,
    case p_group when 'supplier' then coalesce(max(su.name_ar), max(su.name)) when 'product' then max(p.name_ar) else to_char(max(pu.purchase_date), 'YYYY-MM-DD') end,
    count(distinct pu.id), round(sum(pi.qty - pi.returned_qty), 3), round(sum(pi.unit_price * (pi.qty - pi.returned_qty)), 2)
  from public.purchases pu
  join public.purchase_items pi on pi.purchase_id = pu.id
  join public.suppliers su on su.id = pu.supplier_id
  join public.products p on p.id = pi.product_id
  where pu.status = 'posted' and pu.purchase_date between p_start and p_end
  group by 1
  order by case when p_group not in ('supplier', 'product') then 1 end, case when p_group in ('supplier', 'product') then round(sum(pi.unit_price * (pi.qty - pi.returned_qty)), 2) end desc nulls last, 1;
end $$;
