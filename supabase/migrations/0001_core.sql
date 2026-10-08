-- =====================================================================
-- 0001 CORE: helper schema, settings, roles & permissions, audit, numbering
-- =====================================================================

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

create type public.app_role as enum ('owner', 'manager', 'accountant', 'sales', 'warehouse', 'driver');

-- ---------------------------------------------------------------------
-- Time helpers (business runs on Saudi time)
-- ---------------------------------------------------------------------
create or replace function app.tz() returns text
language sql immutable as $$ select 'Asia/Riyadh'::text $$;

create or replace function app.today() returns date
language sql stable as $$ select (now() at time zone app.tz())::date $$;

create or replace function app.local_time(p_ts timestamptz) returns time
language sql stable as $$ select (p_ts at time zone app.tz())::time $$;

-- ---------------------------------------------------------------------
-- Company settings (single row)
-- ---------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  company_name_en text not null default 'Dar Al-Aaliya Dates',
  company_name_ar text not null default 'دار العالية للتمور',
  tagline_en text default 'Premium dates and luxury nuts — wholesale and retail',
  tagline_ar text default 'لبيع جميع أنواع التمور والمكسرات الفاخرة بالجملة والمفرق',
  phone text default '+966550845703',
  whatsapp text default '+966550845703',
  email text,
  address_en text,
  address_ar text,
  maps_url text,
  cr_number text,
  vat_enabled boolean not null default false,
  vat_rate numeric(5, 2) not null default 15 check (vat_rate >= 0 and vat_rate <= 100),
  vat_number text,
  currency text not null default 'SAR',
  allow_negative_stock boolean not null default false,
  invoice_language text not null default 'both' check (invoice_language in ('ar', 'en', 'both')),
  invoice_footer_en text default 'Thank you for your business.',
  invoice_footer_ar text default 'شكراً لتعاملكم معنا.',
  invoice_show_zatca_qr boolean not null default true,
  logo_path text,
  attendance_grace_minutes int not null default 10 check (attendance_grace_minutes >= 0),
  attendance_photo_retention_days int not null default 180 check (attendance_photo_retention_days >= 7),
  attendance_notice_en text default 'A photograph is taken at check-in and check-out as attendance evidence. Photos are stored privately and deleted after the retention period.',
  attendance_notice_ar text default 'تُلتقط صورة عند تسجيل الحضور والانصراف كإثبات للحضور. تُحفظ الصور بشكل خاص وتُحذف بعد انتهاء مدة الاحتفاظ.',
  payroll_working_days_per_month int not null default 26 check (payroll_working_days_per_month between 1 and 31),
  payroll_overtime_multiplier numeric(5, 2) not null default 1.5 check (payroll_overtime_multiplier >= 0),
  payroll_late_deduction_mode text not null default 'none' check (payroll_late_deduction_mode in ('none', 'per_occurrence', 'per_minute')),
  payroll_late_deduction_value numeric(12, 2) not null default 0 check (payroll_late_deduction_value >= 0),
  payroll_absence_deduction boolean not null default true,
  payroll_half_day_factor numeric(4, 2) not null default 0.5 check (payroll_half_day_factor between 0 and 1),
  payroll_paid_leave boolean not null default true,
  session_timeout_minutes int not null default 120 check (session_timeout_minutes between 5 and 1440),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- Configurable invoice QR codes (WhatsApp, Maps, Instagram, website, ...)
create table public.invoice_qr_codes (
  id uuid primary key default gen_random_uuid(),
  label_en text not null,
  label_ar text not null,
  url text not null check (url ~* '^(https?://|tel:|mailto:)'),
  is_enabled boolean not null default true,
  position text not null default 'footer' check (position in ('header', 'footer')),
  size_px int not null default 88 check (size_px between 48 and 200),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Users, roles, permissions
-- ---------------------------------------------------------------------
create table public.permissions (
  code text primary key,
  module text not null,
  label_en text not null,
  label_ar text not null
);

create table public.role_permissions (
  role public.app_role not null,
  permission text not null references public.permissions (code) on delete cascade,
  primary key (role, permission)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role public.app_role not null default 'sales',
  is_active boolean not null default true,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  driver_id uuid,
  employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-user grants/denials on top of the role (e.g. payroll approval, bank verification)
create table public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null references public.permissions (code) on delete cascade,
  granted boolean not null default true,
  primary key (user_id, permission)
);

create or replace function app.current_role() returns public.app_role
language sql stable security definer set search_path = public, app as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function app.has_perm(p_code text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce((
    select case
      when not pr.is_active then false
      when pr.role = 'owner' then true
      when up.granted is not null then up.granted
      else exists (select 1 from public.role_permissions rp where rp.role = pr.role and rp.permission = p_code)
    end
    from public.profiles pr
    left join public.user_permissions up on up.user_id = pr.id and up.permission = p_code
    where pr.id = auth.uid()
  ), false)
$$;

create or replace function app.require_perm(p_code text) returns void
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.has_perm(p_code) then
    raise exception 'Permission denied: %', p_code using errcode = '42501';
  end if;
end $$;

create or replace function app.is_owner() returns boolean
language sql stable as $$ select app.current_role() = 'owner' $$;

-- Exposed to the client so the UI can hide what the database would refuse anyway
create or replace function public.my_permissions() returns text[]
language sql stable security definer set search_path = public, app as $$
  select coalesce(array_agg(p.code order by p.code), '{}')
  from public.permissions p
  where app.has_perm(p.code)
$$;

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  reason text
);
create index audit_logs_at_idx on public.audit_logs (at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_logs (user_id, action, table_name, record_id, old_data, new_data, reason)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'user_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    nullif(current_setting('app.reason', true), '')
  );
  return coalesce(new, old);
end $$;

-- Financial / evidential records are never deleted, only cancelled with a reason
create or replace function app.prevent_delete() returns trigger
language plpgsql as $$
begin
  raise exception '% records cannot be deleted. Cancel them with a reason instead.', tg_table_name
    using errcode = '42501';
end $$;

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function app.set_reason(p_reason text) returns void
language plpgsql as $$
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A reason of at least 3 characters is required.' using errcode = '22023';
  end if;
  perform set_config('app.reason', trim(p_reason), true);
end $$;

-- ---------------------------------------------------------------------
-- Sequential, gap-free document numbers (row-locked inside the posting transaction)
-- ---------------------------------------------------------------------
create table app.doc_sequences (
  prefix text not null,
  yr int not null,
  last_no int not null default 0,
  primary key (prefix, yr)
);

create or replace function app.next_doc_no(p_prefix text, p_yearly boolean default true) returns text
language plpgsql security definer set search_path = public, app as $$
declare
  v_year int := case when p_yearly then extract(year from app.today())::int else 0 end;
  v_no int;
begin
  insert into app.doc_sequences (prefix, yr, last_no) values (p_prefix, v_year, 1)
  on conflict (prefix, yr) do update set last_no = app.doc_sequences.last_no + 1
  returning last_no into v_no;
  if p_yearly then
    return p_prefix || '-' || v_year || '-' || lpad(v_no::text, 5, '0');
  end if;
  return p_prefix || '-' || lpad(v_no::text, 4, '0');
end $$;

create trigger settings_touch before update on public.settings
  for each row execute function app.touch_updated_at();
create trigger settings_audit after update on public.settings
  for each row execute function app.audit();
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();
create trigger profiles_audit after insert or update on public.profiles
  for each row execute function app.audit();
create trigger user_permissions_audit after insert or update or delete on public.user_permissions
  for each row execute function app.audit();
create trigger invoice_qr_audit after insert or update or delete on public.invoice_qr_codes
  for each row execute function app.audit();
