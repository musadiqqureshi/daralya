-- =====================================================================
-- 0006 INVESTORS + WEBSITE CMS + CONTACT INQUIRIES
-- =====================================================================

create type public.investment_model as enum ('profit_share', 'project', 'equity', 'loan');

create table public.investors (
  id uuid primary key default gen_random_uuid(),
  investor_no text unique not null default app.next_doc_no('INV', false),
  name text not null,
  name_ar text,
  phone text,
  email text,
  id_number text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  investment_no text unique not null default app.next_doc_no('IVT', false),
  investor_id uuid not null references public.investors (id),
  model public.investment_model not null,
  project_name text,
  batch_id uuid references public.stock_batches (id),
  committed_amount numeric(14, 2) not null check (committed_amount > 0),
  start_date date not null,
  end_date date,
  profit_share_pct numeric(5, 2) check (profit_share_pct is null or profit_share_pct between 0 and 100),
  profit_frequency text not null default 'quarterly' check (profit_frequency in ('monthly', 'quarterly', 'yearly', 'project')),
  equity_pct numeric(5, 2) check (equity_pct is null or equity_pct between 0 and 100),
  terms text,
  agreement_path text,
  status text not null default 'active' check (status in ('active', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index investments_investor_idx on public.investments (investor_id);

alter table public.journal_lines
  add constraint journal_lines_investment_fk foreign key (investment_id) references public.investments (id);
alter table public.payments
  add constraint payments_investment_fk foreign key (investment_id) references public.investments (id);

create table public.profit_allocations (
  id uuid primary key default gen_random_uuid(),
  allocation_no text unique not null,
  investment_id uuid not null references public.investments (id),
  investor_id uuid not null references public.investors (id),
  kind text not null default 'allocation' check (kind in ('allocation', 'adjustment')),
  adjusts_id uuid references public.profit_allocations (id),
  period_label text not null,
  period_start date,
  period_end date,
  basis_net_profit numeric(14, 2),
  share_pct numeric(5, 2),
  amount numeric(14, 2) not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'cancelled')),
  reason text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  check (kind = 'adjustment' or amount >= 0)
);

/*
  p: { investment_id, period_label, period_start, period_end, basis_net_profit, share_pct?, notes }
  or adjustment: { investment_id, kind: 'adjustment', adjusts_id, amount, reason, period_label }
*/
create or replace function public.profit_allocation_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  inv public.investments;
  v_id uuid;
  v_kind text := coalesce(p ->> 'kind', 'allocation');
  v_pct numeric;
  v_amount numeric;
begin
  perform app.require_perm('investors.manage');
  select * into inv from public.investments where id = (p ->> 'investment_id')::uuid;
  if inv.id is null then raise exception 'Investment not found.' using errcode = 'P0002'; end if;
  if v_kind = 'adjustment' then
    if coalesce(length(trim(p ->> 'reason')), 0) < 3 then raise exception 'An adjustment needs a reason.' using errcode = '22023'; end if;
    if not exists (select 1 from public.profit_allocations where id = (p ->> 'adjusts_id')::uuid and investment_id = inv.id and status = 'approved') then
      raise exception 'Choose the approved allocation being adjusted.' using errcode = '22023';
    end if;
    v_amount := round((p ->> 'amount')::numeric, 2);
    if v_amount is null or v_amount = 0 then raise exception 'Enter the adjustment amount.' using errcode = '22023'; end if;
  else
    if inv.model = 'loan' then raise exception 'Loans do not receive profit allocations.' using errcode = '22023'; end if;
    v_pct := coalesce((p ->> 'share_pct')::numeric, inv.profit_share_pct, inv.equity_pct);
    if v_pct is null then raise exception 'Set the profit share percentage.' using errcode = '22023'; end if;
    if (p ->> 'basis_net_profit') is null then raise exception 'Enter the approved net profit for the period.' using errcode = '22023'; end if;
    v_amount := round(greatest((p ->> 'basis_net_profit')::numeric, 0) * v_pct / 100, 2);
  end if;
  insert into public.profit_allocations (allocation_no, investment_id, investor_id, kind, adjusts_id, period_label, period_start, period_end,
    basis_net_profit, share_pct, amount, reason, notes)
  values (app.next_doc_no('PRF'), inv.id, inv.investor_id, v_kind, (p ->> 'adjusts_id')::uuid, coalesce(p ->> 'period_label', ''),
    (p ->> 'period_start')::date, (p ->> 'period_end')::date, (p ->> 'basis_net_profit')::numeric, v_pct, v_amount, p ->> 'reason', p ->> 'notes')
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.profit_allocation_approve(p_id uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  a public.profit_allocations;
begin
  perform app.require_perm('investors.approve_profit');
  select * into a from public.profit_allocations where id = p_id for update;
  if a.id is null or a.status <> 'draft' then raise exception 'Only draft allocations can be approved.' using errcode = '22023'; end if;
  perform app.post_journal(coalesce(a.period_end, app.today()), 'profit_allocation', a.id, 'Investor profit ' || a.allocation_no, jsonb_build_array(
    jsonb_build_object('gl', '3400', 'dr', a.amount, 'party_type', 'investor', 'party_id', a.investor_id, 'investment_id', a.investment_id),
    jsonb_build_object('gl', '2500', 'cr', a.amount, 'party_type', 'investor', 'party_id', a.investor_id, 'investment_id', a.investment_id)));
  update public.profit_allocations set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_id;
end $$;

-- Approved allocations are final; only drafts can be withdrawn
create or replace function public.profit_allocation_cancel(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_perm('investors.manage');
  perform app.set_reason(p_reason);
  update public.profit_allocations set status = 'cancelled', reason = p_reason where id = p_id and status = 'draft';
  if not found then raise exception 'Only draft allocations can be cancelled; record an adjustment instead.' using errcode = '22023'; end if;
end $$;

-- Capital and profit kept on separate ledgers
create view public.v_investment_summary with (security_invoker = true) as
select i.id as investment_id, i.investment_no, i.investor_id, i.model, i.project_name, i.committed_amount,
  i.profit_share_pct, i.status, i.start_date,
  coalesce(sum(l.credit) filter (where l.gl_code in ('3200', '2600')), 0)::numeric(14, 2) as capital_in,
  coalesce(sum(l.debit) filter (where l.gl_code in ('3200', '2600')), 0)::numeric(14, 2) as capital_returned,
  coalesce(sum(l.credit - l.debit) filter (where l.gl_code in ('3200', '2600')), 0)::numeric(14, 2) as capital_balance,
  coalesce(sum(l.credit - l.debit) filter (where l.gl_code = '2500' and e.source_type = 'profit_allocation'), 0)::numeric(14, 2) as profit_earned,
  coalesce(sum(l.debit - l.credit) filter (where l.gl_code = '2500' and e.source_type = 'payment'), 0)::numeric(14, 2) as profit_paid,
  coalesce(sum(l.credit - l.debit) filter (where l.gl_code = '2500'), 0)::numeric(14, 2) as profit_outstanding
from public.investments i
left join public.journal_lines l on l.investment_id = i.id
left join public.journal_entries e on e.id = l.entry_id
group by i.id;

create trigger investors_audit after insert or update on public.investors for each row execute function app.audit();
create trigger investments_audit after insert or update on public.investments for each row execute function app.audit();
create trigger profit_allocations_audit after insert or update on public.profit_allocations for each row execute function app.audit();
create trigger profit_allocations_no_delete before delete on public.profit_allocations for each row execute function app.prevent_delete();

-- ---------------------------------------------------------------------
-- Website CMS (draft → published)
-- ---------------------------------------------------------------------
create table public.site_content (
  key text primary key check (key in ('hero', 'home', 'about', 'quality', 'contact', 'footer', 'social', 'seo')),
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  published_at timestamptz,
  published_by uuid
);
create trigger site_content_touch before update on public.site_content for each row execute function app.touch_updated_at();
create trigger site_content_audit after insert or update on public.site_content for each row execute function app.audit();

create or replace function public.site_content_publish(p_key text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.require_perm('website.manage');
  update public.site_content set published = draft, published_at = now(), published_by = auth.uid() where key = p_key;
  if not found then raise exception 'Content section not found.' using errcode = 'P0002'; end if;
end $$;

-- Public, read-only projections (no costs, suppliers or stock levels)
create view public.v_public_content as
select key, published as content, published_at from public.site_content where published is not null;

create view public.v_public_products as
select p.id, p.slug, p.name_en, p.name_ar, p.variety, p.grade, p.unit, p.weight_kg,
  p.packaging_en, p.packaging_ar, p.description_en, p.description_ar, p.specs,
  p.public_availability, p.is_featured, p.sort_order,
  coalesce((select jsonb_agg(jsonb_build_object('src', pi.src, 'alt_en', pi.alt_en, 'alt_ar', pi.alt_ar) order by pi.sort_order, pi.created_at)
            from public.product_images pi where pi.product_id = p.id), '[]'::jsonb) as images
from public.products p
where p.is_published and p.is_active;

create view public.v_public_company as
select company_name_en, company_name_ar, tagline_en, tagline_ar, phone, whatsapp, email, address_en, address_ar, maps_url, logo_path
from public.settings where id = 1;

-- ---------------------------------------------------------------------
-- Contact inquiries (inserted server-side after validation & rate limiting)
-- ---------------------------------------------------------------------
create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(name) between 2 and 120),
  phone text check (phone is null or length(phone) <= 40),
  email text check (email is null or length(email) <= 200),
  company text check (company is null or length(company) <= 160),
  category text not null check (category in ('general', 'wholesale', 'product', 'export', 'other')),
  product_id uuid references public.products (id) on delete set null,
  message text not null check (length(message) between 5 and 4000),
  locale text not null default 'en',
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  handled_by uuid,
  internal_notes text,
  check (phone is not null or email is not null)
);
create index contact_inquiries_created_idx on public.contact_inquiries (created_at desc);
create index contact_inquiries_ip_idx on public.contact_inquiries (ip_hash, created_at desc);
create trigger contact_inquiries_audit after update on public.contact_inquiries for each row execute function app.audit();
