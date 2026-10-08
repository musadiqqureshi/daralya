-- =====================================================================
-- 0002 MASTER DATA + DOUBLE-ENTRY LEDGER
-- =====================================================================

create type public.party_type as enum ('customer', 'supplier', 'driver', 'employee', 'investor');
create type public.product_unit as enum ('kg', 'carton', 'box', 'tray', 'piece');
create type public.commission_type as enum ('none', 'fixed', 'percent', 'per_kg');
create type public.public_availability as enum ('available', 'limited', 'seasonal', 'on_request');
create type public.gl_type as enum ('asset', 'liability', 'equity', 'income', 'expense');
create type public.money_kind as enum ('cash', 'bank');

-- ---------------------------------------------------------------------
-- Chart of accounts (system accounts; cash/bank and parties are sub-ledgers)
-- ---------------------------------------------------------------------
create table public.gl_accounts (
  code text primary key,
  name_en text not null,
  name_ar text not null,
  type public.gl_type not null,
  sort_order int not null default 0
);

insert into public.gl_accounts (code, name_en, name_ar, type, sort_order) values
  ('1100', 'Cash on hand', 'النقدية في الصندوق', 'asset', 10),
  ('1110', 'Bank accounts', 'الحسابات البنكية', 'asset', 11),
  ('1200', 'Accounts receivable', 'ذمم العملاء', 'asset', 12),
  ('1300', 'Inventory', 'المخزون', 'asset', 13),
  ('1400', 'Employee advances', 'سلف الموظفين', 'asset', 14),
  ('1500', 'Input VAT', 'ضريبة المدخلات', 'asset', 15),
  ('2100', 'Accounts payable', 'ذمم الموردين', 'liability', 20),
  ('2200', 'VAT payable', 'ضريبة القيمة المضافة المستحقة', 'liability', 21),
  ('2300', 'Commissions payable', 'عمولات مستحقة', 'liability', 22),
  ('2400', 'Salaries payable', 'رواتب مستحقة', 'liability', 23),
  ('2500', 'Investor profit payable', 'أرباح مستحقة للمستثمرين', 'liability', 24),
  ('2600', 'Investor loans', 'قروض المستثمرين', 'liability', 25),
  ('3100', 'Owner equity / opening balances', 'حقوق الملكية / الأرصدة الافتتاحية', 'equity', 30),
  ('3200', 'Investor capital', 'رأس مال المستثمرين', 'equity', 31),
  ('3400', 'Investor profit distributions', 'توزيعات أرباح المستثمرين', 'equity', 32),
  ('4100', 'Sales revenue', 'إيرادات المبيعات', 'income', 40),
  ('4110', 'Sales returns', 'مردودات المبيعات', 'income', 41),
  ('4900', 'Other income', 'إيرادات أخرى', 'income', 49),
  ('5100', 'Cost of goods sold', 'تكلفة البضاعة المباعة', 'expense', 50),
  ('5200', 'Inventory losses (damage & wastage)', 'خسائر المخزون (تلف وهدر)', 'expense', 51),
  ('5300', 'Driver & agent commissions', 'عمولات السائقين والمناديب', 'expense', 52),
  ('5400', 'Salaries & wages', 'الرواتب والأجور', 'expense', 53),
  ('5900', 'Cash over / short', 'فروقات الصندوق', 'expense', 59),
  ('6000', 'Operating expenses', 'المصروفات التشغيلية', 'expense', 60);

-- ---------------------------------------------------------------------
-- Cash & bank accounts
-- ---------------------------------------------------------------------
create table public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  kind public.money_kind not null,
  bank_name text,
  account_no text,
  iban text,
  opening_balance numeric(14, 2) not null default 0,
  opening_date date not null default app.today(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function app.money_gl(p_account uuid) returns text
language sql stable as $$
  select case kind when 'cash' then '1100' else '1110' end from public.money_accounts where id = p_account
$$;

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_en text not null,
  name_ar text not null,
  requires_verification boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0
);
insert into public.payment_methods (code, name_en, name_ar, requires_verification, sort_order) values
  ('cash', 'Cash', 'نقداً', false, 1),
  ('bank_transfer', 'Bank transfer', 'تحويل بنكي', true, 2),
  ('bank_deposit', 'Bank deposit', 'إيداع بنكي', true, 3),
  ('cheque', 'Cheque', 'شيك', true, 4);

-- ---------------------------------------------------------------------
-- Parties
-- ---------------------------------------------------------------------
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default app.next_doc_no('DRV', false),
  kind text not null default 'driver' check (kind in ('driver', 'agent')),
  name text not null,
  name_ar text,
  phone text,
  vehicle_type text,
  vehicle_no text,
  commission_type public.commission_type not null default 'none',
  commission_value numeric(12, 4) not null default 0 check (commission_value >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_driver_fk foreign key (driver_id) references public.drivers (id) on delete set null;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default app.next_doc_no('CUS', false),
  name text not null,
  name_ar text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  vat_number text,
  credit_limit numeric(14, 2) check (credit_limit is null or credit_limit >= 0),
  driver_id uuid references public.drivers (id) on delete set null,
  opening_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index customers_name_idx on public.customers (lower(name));

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default app.next_doc_no('SUP', false),
  name text not null,
  name_ar text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  vat_number text,
  opening_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ---------------------------------------------------------------------
-- Products & storages
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null default app.next_doc_no('PRD', false),
  barcode text unique,
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  name_ur text,
  variety text not null,
  grade text,
  unit public.product_unit not null default 'kg',
  weight_kg numeric(12, 3) not null default 1 check (weight_kg > 0),
  purchase_price numeric(14, 2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(14, 2) not null default 0 check (selling_price >= 0),
  min_stock numeric(14, 3) not null default 0 check (min_stock >= 0),
  is_active boolean not null default true,
  -- public portfolio
  is_published boolean not null default false,
  is_featured boolean not null default false,
  public_availability public.public_availability not null default 'on_request',
  packaging_en text,
  packaging_ar text,
  description_en text,
  description_ar text,
  specs jsonb not null default '[]'::jsonb check (jsonb_typeof(specs) = 'array'),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  src text not null, -- storage path in the public "products" bucket, or an absolute https URL
  alt_en text,
  alt_ar text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.storages (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default app.next_doc_no('STR', false),
  name_en text not null,
  name_ar text not null,
  location text,
  capacity_kg numeric(14, 2) check (capacity_kg is null or capacity_kg > 0),
  temp_min numeric(5, 2),
  temp_max numeric(5, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.temperature_logs (
  id uuid primary key default gen_random_uuid(),
  storage_id uuid not null references public.storages (id),
  recorded_at timestamptz not null default now(),
  temperature_c numeric(5, 2) not null,
  humidity_pct numeric(5, 2) check (humidity_pct is null or humidity_pct between 0 and 100),
  notes text,
  recorded_by uuid default auth.uid()
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  is_active boolean not null default true,
  sort_order int not null default 0
);
insert into public.expense_categories (name_en, name_ar, sort_order) values
  ('Fuel', 'وقود', 1), ('Rent', 'إيجار', 2), ('Electricity', 'كهرباء', 3), ('Water', 'مياه', 4),
  ('Transport', 'نقل', 5), ('Packaging', 'تغليف', 6), ('Maintenance', 'صيانة', 7),
  ('Communication', 'اتصالات', 8), ('Government fees', 'رسوم حكومية', 9), ('Other', 'أخرى', 99);

-- ---------------------------------------------------------------------
-- Journal (double entry). Every money or stock-value event posts here.
-- ---------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no text unique not null,
  entry_date date not null,
  source_type text not null,
  source_id uuid,
  memo text,
  reverses_id uuid references public.journal_entries (id),
  is_reversed boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index journal_entries_source_idx on public.journal_entries (source_type, source_id);
create index journal_entries_date_idx on public.journal_entries (entry_date);

create table public.journal_lines (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.journal_entries (id),
  gl_code text not null references public.gl_accounts (code),
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  party_type public.party_type,
  party_id uuid,
  money_account_id uuid references public.money_accounts (id),
  investment_id uuid,
  memo text,
  check (debit = 0 or credit = 0),
  check (debit > 0 or credit > 0),
  check ((party_type is null) = (party_id is null))
);
create index journal_lines_entry_idx on public.journal_lines (entry_id);
create index journal_lines_gl_idx on public.journal_lines (gl_code);
create index journal_lines_party_idx on public.journal_lines (party_type, party_id);
create index journal_lines_money_idx on public.journal_lines (money_account_id) where money_account_id is not null;

-- Each entry must balance; checked at commit so multi-line inserts can complete first
create or replace function app.check_entry_balanced() returns trigger
language plpgsql as $$
declare
  v_diff numeric;
begin
  select coalesce(sum(debit), 0) - coalesce(sum(credit), 0) into v_diff
  from public.journal_lines where entry_id = new.entry_id;
  if v_diff <> 0 then
    raise exception 'Journal entry % is not balanced (difference %)', new.entry_id, v_diff;
  end if;
  return null;
end $$;

create constraint trigger journal_lines_balanced
  after insert or update on public.journal_lines
  deferrable initially deferred
  for each row execute function app.check_entry_balanced();

create trigger journal_entries_no_delete before delete on public.journal_entries
  for each row execute function app.prevent_delete();
create trigger journal_lines_no_delete before delete on public.journal_lines
  for each row execute function app.prevent_delete();
create trigger journal_lines_no_update before update on public.journal_lines
  for each row execute function app.prevent_delete();

/*
  p_lines: [{ "gl": "1200", "dr": 100, "cr": 0, "party_type": "customer", "party_id": "...",
              "money_account_id": null, "investment_id": null, "memo": null }]
  Zero lines are skipped; negative amounts flip side.
*/
create or replace function app.post_journal(
  p_date date, p_source_type text, p_source_id uuid, p_memo text, p_lines jsonb
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_line jsonb;
  v_dr numeric;
  v_cr numeric;
  v_net numeric;
  v_count int := 0;
begin
  insert into public.journal_entries (entry_no, entry_date, source_type, source_id, memo)
  values (app.next_doc_no('JE'), p_date, p_source_type, p_source_id, p_memo)
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_net := round(coalesce((v_line ->> 'dr')::numeric, 0) - coalesce((v_line ->> 'cr')::numeric, 0), 2);
    continue when v_net = 0;
    v_dr := greatest(v_net, 0);
    v_cr := greatest(-v_net, 0);
    insert into public.journal_lines (entry_id, gl_code, debit, credit, party_type, party_id, money_account_id, investment_id, memo)
    values (
      v_id, v_line ->> 'gl', v_dr, v_cr,
      (v_line ->> 'party_type')::public.party_type,
      (v_line ->> 'party_id')::uuid,
      (v_line ->> 'money_account_id')::uuid,
      (v_line ->> 'investment_id')::uuid,
      v_line ->> 'memo'
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    -- nothing to post (e.g. zero-value document); keep the header out of the books
    update public.journal_entries set is_reversed = true, memo = coalesce(p_memo, '') || ' (empty)' where id = v_id;
  end if;
  return v_id;
end $$;

-- Reverse every live entry of a source document with mirror-image lines
create or replace function app.reverse_journal(p_source_type text, p_source_id uuid, p_memo text) returns void
language plpgsql as $$
declare
  v_entry record;
  v_new uuid;
begin
  for v_entry in
    select * from public.journal_entries
    where source_type = p_source_type and source_id = p_source_id and not is_reversed and reverses_id is null
    for update
  loop
    insert into public.journal_entries (entry_no, entry_date, source_type, source_id, memo, reverses_id)
    values (app.next_doc_no('JE'), app.today(), p_source_type, p_source_id, p_memo, v_entry.id)
    returning id into v_new;
    insert into public.journal_lines (entry_id, gl_code, debit, credit, party_type, party_id, money_account_id, investment_id, memo)
    select v_new, gl_code, credit, debit, party_type, party_id, money_account_id, investment_id, p_memo
    from public.journal_lines where entry_id = v_entry.id;
    update public.journal_entries set is_reversed = true where id = v_entry.id;
  end loop;
end $$;

-- Opening balances post against owner equity so books balance from day one
create or replace function app.post_opening_balance() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  v_amt numeric := coalesce(new.opening_balance, 0);
  v_gl text;
  v_party public.party_type;
begin
  if v_amt = 0 then return new; end if;
  if tg_table_name = 'money_accounts' then
    perform app.post_journal(new.opening_date, 'opening_balance', new.id, 'Opening balance: ' || new.name_en, jsonb_build_array(
      jsonb_build_object('gl', case new.kind when 'cash' then '1100' else '1110' end, 'dr', v_amt, 'money_account_id', new.id),
      jsonb_build_object('gl', '3100', 'cr', v_amt)));
    return new;
  end if;
  if tg_table_name = 'customers' then v_gl := '1200'; v_party := 'customer';
  else v_gl := '2100'; v_party := 'supplier'; end if;
  -- customers: positive = they owe us (debit AR); suppliers: positive = we owe them (credit AP)
  perform app.post_journal(app.today(), 'opening_balance', new.id, 'Opening balance: ' || new.name, jsonb_build_array(
    jsonb_build_object('gl', v_gl, 'dr', case when v_party = 'customer' then v_amt else -v_amt end, 'party_type', v_party, 'party_id', new.id),
    jsonb_build_object('gl', '3100', 'cr', case when v_party = 'customer' then v_amt else -v_amt end)));
  return new;
end $$;

create trigger money_accounts_opening after insert on public.money_accounts
  for each row execute function app.post_opening_balance();
create trigger customers_opening after insert on public.customers
  for each row execute function app.post_opening_balance();
create trigger suppliers_opening after insert on public.suppliers
  for each row execute function app.post_opening_balance();

-- Opening balance is fixed once posted; corrections go through payments/adjustments
create or replace function app.lock_opening_balance() returns trigger
language plpgsql as $$
begin
  if new.opening_balance is distinct from old.opening_balance then
    raise exception 'Opening balance cannot be changed after creation.' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger money_accounts_lock_opening before update on public.money_accounts
  for each row execute function app.lock_opening_balance();
create trigger customers_lock_opening before update on public.customers
  for each row execute function app.lock_opening_balance();
create trigger suppliers_lock_opening before update on public.suppliers
  for each row execute function app.lock_opening_balance();

-- ---------------------------------------------------------------------
-- Balance views (security_invoker: callers only see lines their RLS allows)
-- ---------------------------------------------------------------------
create view public.v_party_balances with (security_invoker = true) as
select party_type, party_id, gl_code, sum(debit - credit)::numeric(14, 2) as balance
from public.journal_lines
where party_type is not null
group by party_type, party_id, gl_code;

create view public.v_money_balances with (security_invoker = true) as
select a.id, a.name_en, a.name_ar, a.kind, a.bank_name, a.account_no, a.iban, a.is_active,
  coalesce(sum(l.debit - l.credit), 0)::numeric(14, 2) as balance
from public.money_accounts a
left join public.journal_lines l on l.money_account_id = a.id
group by a.id;

-- Audit + touch
create trigger products_touch before update on public.products for each row execute function app.touch_updated_at();
create trigger customers_audit after insert or update on public.customers for each row execute function app.audit();
create trigger suppliers_audit after insert or update on public.suppliers for each row execute function app.audit();
create trigger drivers_audit after insert or update on public.drivers for each row execute function app.audit();
create trigger products_audit after insert or update on public.products for each row execute function app.audit();
create trigger storages_audit after insert or update on public.storages for each row execute function app.audit();
create trigger money_accounts_audit after insert or update on public.money_accounts for each row execute function app.audit();
create trigger journal_entries_audit after insert on public.journal_entries for each row execute function app.audit();
