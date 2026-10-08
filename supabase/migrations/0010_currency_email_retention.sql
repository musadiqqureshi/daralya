-- =====================================================================
-- 0010 FOREIGN-CURRENCY PRICING, EMAIL SETTINGS & LOG, 24-HOUR PHOTO RETENTION
-- =====================================================================

-- Salesmen agree prices per customer: allow free pricing for sales staff and managers
insert into public.role_permissions (role, permission) values
  ('sales', 'sales.price_override'), ('manager', 'sales.price_override')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Exchange rates (SAR per 1 unit of foreign currency). Written only by the
-- server with the secret key; read by staff. Books always stay in SAR.
-- ---------------------------------------------------------------------
create table public.exchange_rates (
  currency text primary key check (currency ~ '^[A-Z]{3}$'),
  sar_per_unit numeric(18, 8) not null check (sar_per_unit > 0),
  source text,
  fetched_at timestamptz not null default now()
);
alter table public.exchange_rates enable row level security;
create policy exchange_rates_read on public.exchange_rates for select to authenticated using (app.is_staff());

alter table public.sales add column currency text not null default 'SAR' check (currency ~ '^[A-Z]{3}$');
alter table public.sales add column fx_rate numeric(18, 8) not null default 1 check (fx_rate > 0);
alter table public.sale_items add column unit_price_fc numeric(14, 4);
-- these tables use column-level grants (costs hidden), so expose the new columns explicitly
grant select (currency, fx_rate) on public.sales to authenticated;
grant select (unit_price_fc) on public.sale_items to authenticated;

/*
  Same payload as sale_create, but prices and discounts are in p.currency.
  The rate comes from exchange_rates (never from the client) and must be fresh.
*/
create or replace function public.sale_create_fx(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_cur text := upper(coalesce(nullif(p ->> 'currency', ''), 'SAR'));
  v_rate numeric;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_id uuid;
  v_n int := 0;
  v_fc numeric[] := '{}';
begin
  if v_cur = 'SAR' then
    v_rate := 1;
  else
    select sar_per_unit into v_rate from public.exchange_rates
    where currency = v_cur and fetched_at > now() - interval '24 hours';
    if v_rate is null then
      raise exception 'Exchange rate for % is not available. Refresh rates and try again.', v_cur using errcode = 'P0001';
    end if;
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]')) loop
    v_fc := v_fc || (v_line ->> 'unit_price')::numeric;
    v_lines := v_lines || jsonb_build_array(v_line || jsonb_build_object(
      'unit_price', round((v_line ->> 'unit_price')::numeric * v_rate, 2),
      'discount_amount', round(coalesce((v_line ->> 'discount_amount')::numeric, 0) * v_rate, 2)));
  end loop;

  v_id := public.sale_create(p || jsonb_build_object(
    'lines', v_lines,
    'discount_amount', round(coalesce((p ->> 'discount_amount')::numeric, 0) * v_rate, 2)));

  update public.sales set currency = v_cur, fx_rate = v_rate where id = v_id;
  for v_n in 1 .. coalesce(array_length(v_fc, 1), 0) loop
    update public.sale_items set unit_price_fc = v_fc[v_n] where sale_id = v_id and line_no = v_n;
  end loop;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Email settings & log
-- ---------------------------------------------------------------------
alter table public.settings add column email_invoices boolean not null default true;
alter table public.settings add column daily_report_enabled boolean not null default true;
alter table public.settings add column daily_report_emails text; -- extra recipients, comma separated

create table public.email_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('invoice', 'credentials', 'daily_report', 'other')),
  recipient text not null,
  subject text not null,
  related_id uuid,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  sent_by uuid
);
alter table public.email_log enable row level security;
create policy email_log_read on public.email_log for select to authenticated using (app.has_perm('audit.view') or app.has_perm('sales.view'));

-- ---------------------------------------------------------------------
-- Attendance photos: dropped 24 hours after capture (configurable in hours)
-- ---------------------------------------------------------------------
alter table public.settings drop constraint if exists settings_attendance_photo_retention_days_check;
alter table public.settings add column attendance_photo_retention_hours int not null default 24
  check (attendance_photo_retention_hours between 1 and 8760);
update public.settings set
  attendance_notice_en = 'A photograph is taken at check-in and check-out as attendance evidence. Photos are stored privately and deleted automatically 24 hours after they are taken.',
  attendance_notice_ar = 'تُلتقط صورة عند تسجيل الحضور والانصراف كإثبات للحضور. تُحفظ الصور بشكل خاص وتُحذف تلقائياً بعد ٢٤ ساعة من التقاطها.'
where id = 1;

create or replace function public.attendance_expire_photos() returns text[]
language plpgsql security definer set search_path = public, app as $$
declare
  v_hours int;
  v_cutoff timestamptz;
  v_paths text[];
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    perform app.require_perm('attendance.mark');
  end if;
  select attendance_photo_retention_hours into v_hours from public.settings where id = 1;
  v_cutoff := now() - make_interval(hours => v_hours);
  perform set_config('app.reason', 'Attendance photo retention (' || v_hours || ' hours) expired', true);
  select coalesce(array_agg(x), '{}') into v_paths from (
    select check_in_photo as x from public.attendance where check_in_photo is not null and coalesce(check_in_at, created_at) < v_cutoff
    union all
    select check_out_photo from public.attendance where check_out_photo is not null and coalesce(check_out_at, created_at) < v_cutoff
  ) s;
  update public.attendance set
    check_in_photo = case when coalesce(check_in_at, created_at) < v_cutoff then null else check_in_photo end,
    check_out_photo = case when coalesce(check_out_at, created_at) < v_cutoff then null else check_out_photo end
  where (check_in_photo is not null and coalesce(check_in_at, created_at) < v_cutoff)
     or (check_out_photo is not null and coalesce(check_out_at, created_at) < v_cutoff);
  return v_paths;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
