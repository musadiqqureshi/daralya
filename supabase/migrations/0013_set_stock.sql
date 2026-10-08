-- =====================================================================
-- 0013 ADMIN "SET STOCK" — set a product's quantity in a storage to the
-- counted figure. The difference is posted as an approved stock
-- adjustment (audited, with accounting entries), never a silent overwrite.
-- =====================================================================

create or replace function public.stock_set_quantity(
  p_product uuid, p_storage uuid, p_qty numeric, p_unit_cost numeric default null, p_reason text default null
) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_current numeric;
  v_diff numeric;
  v_id uuid;
  v_cost numeric;
begin
  perform app.require_perm('inventory.adjust_approve');
  perform app.require_active_storage(p_storage);
  if p_qty is null or p_qty < 0 then
    raise exception 'Enter a stock quantity of zero or more.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product) then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  select coalesce(sum(qty), 0) into v_current
  from public.stock_movements where product_id = p_product and storage_id = p_storage;
  v_diff := round(p_qty - v_current, 3);
  if v_diff = 0 then
    return null;
  end if;

  -- new stock is valued at the given cost, else the product's purchase price
  select coalesce(p_unit_cost, nullif(purchase_price, 0), 0) into v_cost from public.products where id = p_product;

  insert into public.stock_adjustments (adj_no, adj_date, storage_id, adj_type, reason)
  values (app.next_doc_no('ADJ'), app.today(), p_storage,
    case when v_diff > 0 then 'adjustment_in' else 'adjustment_out' end,
    coalesce(nullif(trim(p_reason), ''), 'Stock count set to ' || p_qty))
  returning id into v_id;
  insert into public.stock_adjustment_items (adjustment_id, product_id, qty, unit_cost)
  values (v_id, p_product, abs(v_diff), case when v_diff > 0 then v_cost end);

  perform public.stock_adjustment_review(v_id, true, 'Stock set directly by ' || coalesce((select full_name from public.profiles where id = auth.uid()), 'admin'));
  return v_id;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
