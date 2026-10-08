-- =====================================================================
-- 0005 STAFF, CAMERA ATTENDANCE, LEAVE, PAYROLL
-- =====================================================================

create type public.attendance_status as enum ('present', 'late', 'absent', 'half_day', 'on_leave', 'holiday');
create type public.salary_type as enum ('monthly', 'daily', 'hourly');

create table public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 60 check (break_minutes between 0 and 240),
  grace_minutes int check (grace_minutes is null or grace_minutes between 0 and 180),
  half_day_minutes int not null default 240 check (half_day_minutes > 0),
  -- Postgres day-of-week: 0 = Sunday … 6 = Saturday. Default Saturday–Thursday.
  working_days int[] not null default '{0,1,2,3,4,6}',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.work_schedules (name, start_time, end_time, break_minutes, is_default)
values ('Day shift', '08:00', '17:00', 60, true);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text unique not null default app.next_doc_no('EMP', false),
  full_name text not null,
  full_name_ar text,
  photo_path text,
  phone text,
  email text,
  address text,
  id_number text,
  job_title text,
  department text,
  salary_type public.salary_type not null default 'monthly',
  basic_salary numeric(14, 2) not null default 0 check (basic_salary >= 0),
  joining_date date not null default app.today(),
  status text not null default 'active' check (status in ('active', 'inactive', 'terminated')),
  manager_id uuid references public.employees (id),
  schedule_id uuid references public.work_schedules (id),
  user_id uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employees_name_idx on public.employees (lower(full_name));

alter table public.profiles
  add constraint profiles_employee_fk foreign key (employee_id) references public.employees (id) on delete set null;

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date unique not null,
  name_en text not null,
  name_ar text not null
);

create table public.leave_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  leave_type text not null check (leave_type in ('annual', 'sick', 'emergency', 'unpaid', 'other')),
  start_date date not null,
  end_date date not null,
  is_paid boolean not null default true,
  reason text,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_records_emp_idx on public.leave_records (employee_id, start_date);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  work_date date not null,
  status public.attendance_status not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_photo text,
  check_out_photo text,
  late_minutes int not null default 0,
  worked_minutes int,
  overtime_minutes int not null default 0,
  recorded_by uuid,
  checkout_recorded_by uuid,
  is_manual boolean not null default false,
  manual_reason text,
  device_info jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date),
  check (check_out_at is null or check_in_at is not null),
  check (check_out_at is null or check_out_at >= check_in_at)
);
create index attendance_date_idx on public.attendance (work_date desc);

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance (id),
  corrected_by uuid default auth.uid(),
  corrected_at timestamptz not null default now(),
  reason text not null,
  old_data jsonb not null,
  new_data jsonb not null
);

create trigger attendance_touch before update on public.attendance for each row execute function app.touch_updated_at();
create trigger attendance_audit after insert or update on public.attendance for each row execute function app.audit();
create trigger attendance_no_delete before delete on public.attendance for each row execute function app.prevent_delete();
create trigger employees_touch before update on public.employees for each row execute function app.touch_updated_at();
create trigger employees_audit after insert or update on public.employees for each row execute function app.audit();
create trigger leave_audit after insert or update or delete on public.leave_records for each row execute function app.audit();

-- ---------------------------------------------------------------------
-- Schedule helpers
-- ---------------------------------------------------------------------
create or replace function app.employee_schedule(p_employee uuid) returns public.work_schedules
language sql stable as $$
  select s.* from public.work_schedules s
  where s.id = coalesce((select schedule_id from public.employees where id = p_employee),
                        (select id from public.work_schedules where is_default and is_active order by created_at limit 1))
$$;

create or replace function app.schedule_minutes(s public.work_schedules) returns int
language sql immutable as $$
  select greatest(
    (extract(epoch from (s.end_time - s.start_time))::int / 60
      + case when s.end_time <= s.start_time then 1440 else 0 end) - s.break_minutes, 0)
$$;

create or replace function app.is_working_day(s public.work_schedules, p_date date) returns boolean
language sql stable as $$
  select extract(dow from p_date)::int = any (s.working_days)
    and not exists (select 1 from public.holidays where holiday_date = p_date)
$$;

-- Recompute late/worked/overtime/status from the stored server timestamps
create or replace function app.attendance_compute(a public.attendance) returns public.attendance
language plpgsql stable as $$
declare
  s public.work_schedules := app.employee_schedule(a.employee_id);
  v_grace int;
  v_in time;
  v_raw int;
  v_sched int;
begin
  if a.check_in_at is null then
    a.late_minutes := 0; a.worked_minutes := null; a.overtime_minutes := 0;
    return a;
  end if;
  if s.id is not null then
    v_grace := coalesce(s.grace_minutes, (select attendance_grace_minutes from public.settings where id = 1));
    v_in := app.local_time(a.check_in_at);
    if v_in > s.start_time + make_interval(mins => v_grace) then
      a.late_minutes := floor(extract(epoch from (v_in - s.start_time)) / 60)::int;
    else
      a.late_minutes := 0;
    end if;
  end if;
  if a.check_out_at is not null then
    v_raw := floor(extract(epoch from (a.check_out_at - a.check_in_at)) / 60)::int;
    v_sched := case when s.id is null then 480 else app.schedule_minutes(s) end;
    -- the unpaid break only applies to a shift longer than a half day
    a.worked_minutes := greatest(v_raw - case when s.id is not null and v_raw > coalesce(s.half_day_minutes, 240) + s.break_minutes then s.break_minutes else 0 end, 0);
    a.overtime_minutes := greatest(a.worked_minutes - v_sched, 0);
  else
    a.worked_minutes := null;
    a.overtime_minutes := 0;
  end if;
  if a.status in ('present', 'late', 'half_day') then
    a.status := case
      when a.check_out_at is not null and s.id is not null and a.worked_minutes < s.half_day_minutes then 'half_day'
      when a.late_minutes > 0 then 'late'
      else 'present' end;
  end if;
  return a;
end $$;

-- Photo must already be stored privately under attendance/<employee_id>/…
create or replace function app.require_attendance_photo(p_employee uuid, p_path text) returns void
language plpgsql stable as $$
begin
  if p_path is null or split_part(p_path, '/', 1) <> p_employee::text
     or not exists (select 1 from storage.objects where bucket_id = 'attendance' and name = p_path) then
    raise exception 'The attendance photo was not received. Capture it again.' using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Check-in / check-out (server timestamps, Saudi date)
-- ---------------------------------------------------------------------
create or replace function public.attendance_check_in(
  p_employee uuid, p_photo_path text, p_device jsonb default null, p_manual_reason text default null, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  e public.employees;
  a public.attendance;
  v_now timestamptz := now();
  v_date date := (now() at time zone app.tz())::date;
  v_manual boolean := p_photo_path is null;
begin
  perform app.require_perm('attendance.mark');
  select * into e from public.employees where id = p_employee;
  if e.id is null or e.status <> 'active' then raise exception 'Employee not found or not active.' using errcode = 'P0002'; end if;
  if v_manual then
    perform app.require_perm('attendance.manual');
    if coalesce(length(trim(p_manual_reason)), 0) < 3 then
      raise exception 'Manual attendance needs a reason (for example: camera unavailable).' using errcode = '22023';
    end if;
  else
    perform app.require_attendance_photo(p_employee, p_photo_path);
  end if;

  select * into a from public.attendance where employee_id = p_employee and work_date = v_date for update;
  if a.id is not null and a.check_in_at is not null then
    raise exception '% already checked in today at %.', e.full_name, to_char(a.check_in_at at time zone app.tz(), 'HH24:MI')
      using errcode = '23505';
  end if;

  if a.id is null then
    a.id := gen_random_uuid();
    a.employee_id := p_employee;
    a.work_date := v_date;
    a.created_at := v_now;
  end if;
  a.updated_at := v_now;
  a.status := 'present';
  a.check_in_at := v_now;
  a.check_in_photo := p_photo_path;
  a.recorded_by := auth.uid();
  a.is_manual := v_manual;
  a.manual_reason := case when v_manual then trim(p_manual_reason) end;
  a.device_info := p_device;
  a.notes := coalesce(p_notes, a.notes);
  a := app.attendance_compute(a);

  insert into public.attendance values (a.*)
  on conflict (employee_id, work_date) do update set
    status = excluded.status, check_in_at = excluded.check_in_at, check_in_photo = excluded.check_in_photo,
    late_minutes = excluded.late_minutes, recorded_by = excluded.recorded_by, is_manual = excluded.is_manual,
    manual_reason = excluded.manual_reason, device_info = excluded.device_info, notes = excluded.notes;

  return (select to_jsonb(x) || jsonb_build_object('employee_name', e.full_name)
          from public.attendance x where x.employee_id = p_employee and x.work_date = v_date);
end $$;

create or replace function public.attendance_check_out(
  p_employee uuid, p_photo_path text, p_device jsonb default null, p_manual_reason text default null, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  e public.employees;
  a public.attendance;
  v_manual boolean := p_photo_path is null;
begin
  perform app.require_perm('attendance.mark');
  select * into e from public.employees where id = p_employee;
  if e.id is null then raise exception 'Employee not found.' using errcode = 'P0002'; end if;
  if v_manual then
    perform app.require_perm('attendance.manual');
    if coalesce(length(trim(p_manual_reason)), 0) < 3 then
      raise exception 'Manual attendance needs a reason (for example: camera unavailable).' using errcode = '22023';
    end if;
  else
    perform app.require_attendance_photo(p_employee, p_photo_path);
  end if;

  select * into a from public.attendance
  where employee_id = p_employee and work_date = (now() at time zone app.tz())::date for update;
  if a.id is null or a.check_in_at is null then
    raise exception '% has not checked in today.', e.full_name using errcode = 'P0002';
  end if;
  if a.check_out_at is not null then
    raise exception '% already checked out at %.', e.full_name, to_char(a.check_out_at at time zone app.tz(), 'HH24:MI')
      using errcode = '23505';
  end if;

  a.check_out_at := now();
  a.check_out_photo := p_photo_path;
  a.checkout_recorded_by := auth.uid();
  if v_manual then
    a.is_manual := true;
    a.manual_reason := concat_ws(' | ', a.manual_reason, 'Check-out: ' || trim(p_manual_reason));
  end if;
  a.notes := coalesce(p_notes, a.notes);
  a := app.attendance_compute(a);

  update public.attendance set
    check_out_at = a.check_out_at, check_out_photo = a.check_out_photo, checkout_recorded_by = a.checkout_recorded_by,
    worked_minutes = a.worked_minutes, overtime_minutes = a.overtime_minutes, status = a.status,
    is_manual = a.is_manual, manual_reason = a.manual_reason, notes = a.notes
  where id = a.id;

  return (select to_jsonb(x) || jsonb_build_object('employee_name', e.full_name) from public.attendance x where x.id = a.id);
end $$;

-- Close a day: everyone scheduled with no record becomes absent / on leave / holiday
create or replace function public.attendance_close_day(p_date date) returns int
language plpgsql security definer set search_path = public, app as $$
declare
  e record;
  s public.work_schedules;
  v_count int := 0;
  v_status public.attendance_status;
begin
  perform app.require_perm('attendance.mark');
  if p_date > app.today() then raise exception 'You cannot close a future day.' using errcode = '22023'; end if;
  for e in
    select emp.* from public.employees emp
    where emp.status = 'active' and emp.joining_date <= p_date
      and not exists (select 1 from public.attendance a where a.employee_id = emp.id and a.work_date = p_date)
  loop
    s := app.employee_schedule(e.id);
    if exists (select 1 from public.holidays where holiday_date = p_date) then
      v_status := 'holiday';
    elsif exists (select 1 from public.leave_records l where l.employee_id = e.id and l.status = 'approved' and p_date between l.start_date and l.end_date) then
      v_status := 'on_leave';
    elsif s.id is null or extract(dow from p_date)::int = any (s.working_days) then
      v_status := 'absent';
    else
      continue;
    end if;
    insert into public.attendance (employee_id, work_date, status, recorded_by, notes)
    values (e.id, p_date, v_status, auth.uid(), 'Marked when the day was closed');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Authorised correction with mandatory reason; photos are evidence and cannot be replaced
create or replace function public.attendance_correct(p_id uuid, p jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  a public.attendance;
  v_old jsonb;
begin
  perform app.require_perm('attendance.correct');
  perform app.set_reason(p_reason);
  select * into a from public.attendance where id = p_id for update;
  if a.id is null then raise exception 'Attendance record not found.' using errcode = 'P0002'; end if;
  v_old := to_jsonb(a);
  if p ? 'status' then a.status := (p ->> 'status')::public.attendance_status; end if;
  if p ? 'check_in_at' then a.check_in_at := (p ->> 'check_in_at')::timestamptz; end if;
  if p ? 'check_out_at' then a.check_out_at := (p ->> 'check_out_at')::timestamptz; end if;
  if p ? 'notes' then a.notes := p ->> 'notes'; end if;
  if a.check_in_at is not null and (a.check_in_at at time zone app.tz())::date <> a.work_date then
    raise exception 'Check-in time must fall on %.', a.work_date using errcode = '22023';
  end if;
  if a.status in ('absent', 'on_leave', 'holiday') then
    a.check_in_at := null; a.check_out_at := null;
  end if;
  a := app.attendance_compute(a);
  update public.attendance set status = a.status, check_in_at = a.check_in_at, check_out_at = a.check_out_at,
    late_minutes = a.late_minutes, worked_minutes = a.worked_minutes, overtime_minutes = a.overtime_minutes, notes = a.notes
  where id = p_id;
  insert into public.attendance_corrections (attendance_id, reason, old_data, new_data)
  values (p_id, trim(p_reason), v_old, to_jsonb(a));
end $$;

-- Retention: returns photo paths past retention and detaches them (server then deletes the files)
create or replace function public.attendance_expire_photos() returns text[]
language plpgsql security definer set search_path = public, app as $$
declare
  v_days int;
  v_paths text[];
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    perform app.require_perm('settings.manage');
  end if;
  select attendance_photo_retention_days into v_days from public.settings where id = 1;
  perform set_config('app.reason', 'Photo retention period (' || v_days || ' days) expired', true);
  select coalesce(array_agg(p), '{}') into v_paths from (
    select check_in_photo as p from public.attendance where work_date < app.today() - v_days and check_in_photo is not null
    union all
    select check_out_photo from public.attendance where work_date < app.today() - v_days and check_out_photo is not null
  ) x;
  update public.attendance set check_in_photo = null, check_out_photo = null
  where work_date < app.today() - v_days and (check_in_photo is not null or check_out_photo is not null);
  return v_paths;
end $$;

-- ---------------------------------------------------------------------
-- Payroll (preview → approve → pay)
-- ---------------------------------------------------------------------
create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  run_no text unique not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'cancelled')),
  total_net numeric(14, 2) not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  cancel_reason text,
  check (period_end >= period_start)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id),
  employee_id uuid not null references public.employees (id),
  salary_type public.salary_type not null,
  basic_salary numeric(14, 2) not null,
  daily_rate numeric(14, 4) not null,
  hourly_rate numeric(14, 4) not null,
  scheduled_days int not null default 0,
  present_days int not null default 0,
  late_count int not null default 0,
  late_minutes int not null default 0,
  half_days int not null default 0,
  absent_days int not null default 0,
  paid_leave_days int not null default 0,
  unpaid_leave_days int not null default 0,
  holiday_days int not null default 0,
  unrecorded_days int not null default 0,
  worked_hours numeric(10, 2) not null default 0,
  overtime_hours numeric(10, 2) not null default 0,
  base_earned numeric(14, 2) not null default 0,
  overtime_amount numeric(14, 2) not null default 0,
  late_deduction numeric(14, 2) not null default 0,
  absence_deduction numeric(14, 2) not null default 0,
  half_day_deduction numeric(14, 2) not null default 0,
  advance_balance numeric(14, 2) not null default 0,
  advance_deduction numeric(14, 2) not null default 0,
  bonus numeric(14, 2) not null default 0,
  other_deduction numeric(14, 2) not null default 0,
  net_pay numeric(14, 2) not null default 0,
  paid_amount numeric(14, 2) not null default 0,
  notes text,
  unique (run_id, employee_id)
);

create or replace function app.payroll_item_net(i public.payroll_items) returns numeric
language sql immutable as $$
  select round(i.base_earned + i.overtime_amount + i.bonus - i.late_deduction - i.absence_deduction
    - i.half_day_deduction - i.advance_deduction - i.other_deduction, 2)
$$;

create or replace function public.payroll_generate(p_start date, p_end date, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_run uuid;
  st public.settings;
  e record;
  s public.work_schedules;
  i public.payroll_items;
  d date;
  v_sched_min int;
begin
  perform app.require_perm('payroll.prepare');
  if p_end < p_start then raise exception 'The period end must be after the start.' using errcode = '22023'; end if;
  if exists (select 1 from public.payroll_runs where status <> 'cancelled' and daterange(period_start, period_end, '[]') && daterange(p_start, p_end, '[]')) then
    raise exception 'A payroll run already covers part of this period.' using errcode = '23505';
  end if;
  select * into st from public.settings where id = 1;
  insert into public.payroll_runs (run_no, period_start, period_end, notes)
  values (app.next_doc_no('PAYR'), p_start, p_end, p_notes) returning id into v_run;

  for e in select * from public.employees where status = 'active' and joining_date <= p_end loop
    s := app.employee_schedule(e.id);
    v_sched_min := case when s.id is null then 480 else app.schedule_minutes(s) end;
    i := null;
    i.id := gen_random_uuid();
    i.run_id := v_run;
    i.employee_id := e.id;
    i.salary_type := e.salary_type;
    i.basic_salary := e.basic_salary;
    i.bonus := 0; i.other_deduction := 0; i.advance_deduction := 0; i.paid_amount := 0;

    -- scheduled working days inside the period (after joining, excluding holidays)
    i.scheduled_days := 0;
    for d in select generate_series(greatest(p_start, e.joining_date), p_end, interval '1 day')::date loop
      if s.id is null or app.is_working_day(s, d) then i.scheduled_days := i.scheduled_days + 1; end if;
    end loop;

    select
      count(*) filter (where a.status in ('present', 'late')),
      count(*) filter (where a.status = 'late'),
      coalesce(sum(a.late_minutes) filter (where a.status = 'late'), 0),
      count(*) filter (where a.status = 'half_day'),
      count(*) filter (where a.status = 'absent'),
      count(*) filter (where a.status = 'on_leave' and exists (
        select 1 from public.leave_records l where l.employee_id = e.id and l.status = 'approved' and l.is_paid and a.work_date between l.start_date and l.end_date)),
      count(*) filter (where a.status = 'on_leave' and not exists (
        select 1 from public.leave_records l where l.employee_id = e.id and l.status = 'approved' and l.is_paid and a.work_date between l.start_date and l.end_date)),
      count(*) filter (where a.status = 'holiday'),
      round(coalesce(sum(a.worked_minutes), 0) / 60.0, 2),
      round(coalesce(sum(a.overtime_minutes), 0) / 60.0, 2)
    into i.present_days, i.late_count, i.late_minutes, i.half_days, i.absent_days, i.paid_leave_days, i.unpaid_leave_days,
      i.holiday_days, i.worked_hours, i.overtime_hours
    from public.attendance a
    where a.employee_id = e.id and a.work_date between p_start and p_end;

    if not st.payroll_paid_leave then
      i.unpaid_leave_days := i.unpaid_leave_days + i.paid_leave_days;
      i.paid_leave_days := 0;
    end if;
    i.unrecorded_days := greatest(i.scheduled_days - i.present_days - i.half_days - i.absent_days - i.paid_leave_days - i.unpaid_leave_days, 0);

    if e.salary_type = 'monthly' then
      i.daily_rate := e.basic_salary / st.payroll_working_days_per_month;
      i.hourly_rate := i.daily_rate / (v_sched_min / 60.0);
      i.base_earned := e.basic_salary;
      i.absence_deduction := case when st.payroll_absence_deduction then round((i.absent_days + i.unpaid_leave_days) * i.daily_rate, 2) else 0 end;
      i.half_day_deduction := round(i.half_days * i.daily_rate * (1 - st.payroll_half_day_factor), 2);
      i.overtime_amount := round(i.overtime_hours * i.hourly_rate * st.payroll_overtime_multiplier, 2);
    elsif e.salary_type = 'daily' then
      i.daily_rate := e.basic_salary;
      i.hourly_rate := i.daily_rate / (v_sched_min / 60.0);
      i.base_earned := round((i.present_days + i.paid_leave_days + i.half_days * st.payroll_half_day_factor) * i.daily_rate, 2);
      i.absence_deduction := 0;
      i.half_day_deduction := 0;
      i.overtime_amount := round(i.overtime_hours * i.hourly_rate * st.payroll_overtime_multiplier, 2);
    else
      i.hourly_rate := e.basic_salary;
      i.daily_rate := i.hourly_rate * v_sched_min / 60.0;
      -- worked hours already include overtime hours; only the premium is added
      i.base_earned := round(i.worked_hours * i.hourly_rate + i.paid_leave_days * i.daily_rate, 2);
      i.absence_deduction := 0;
      i.half_day_deduction := 0;
      i.overtime_amount := round(i.overtime_hours * i.hourly_rate * greatest(st.payroll_overtime_multiplier - 1, 0), 2);
    end if;

    i.late_deduction := round(case st.payroll_late_deduction_mode
      when 'per_occurrence' then i.late_count * st.payroll_late_deduction_value
      when 'per_minute' then i.late_minutes * st.payroll_late_deduction_value
      else 0 end, 2);
    select coalesce(sum(debit - credit), 0) into i.advance_balance from public.journal_lines
      where gl_code = '1400' and party_type = 'employee' and party_id = e.id;
    i.net_pay := app.payroll_item_net(i);
    insert into public.payroll_items values (i.*);
  end loop;

  update public.payroll_runs set total_net = (select coalesce(sum(net_pay), 0) from public.payroll_items where run_id = v_run) where id = v_run;
  return v_run;
end $$;

-- Review edits on a draft: bonus, deductions, advance recovery, notes
create or replace function public.payroll_item_update(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  i public.payroll_items;
  v_status text;
begin
  perform app.require_perm('payroll.prepare');
  select * into i from public.payroll_items where id = p_id for update;
  select status into v_status from public.payroll_runs where id = i.run_id;
  if i.id is null or v_status <> 'draft' then raise exception 'Only draft payroll lines can be edited.' using errcode = '22023'; end if;
  if p ? 'bonus' then i.bonus := round((p ->> 'bonus')::numeric, 2); end if;
  if p ? 'other_deduction' then i.other_deduction := round((p ->> 'other_deduction')::numeric, 2); end if;
  if p ? 'late_deduction' then i.late_deduction := round((p ->> 'late_deduction')::numeric, 2); end if;
  if p ? 'absence_deduction' then i.absence_deduction := round((p ->> 'absence_deduction')::numeric, 2); end if;
  if p ? 'advance_deduction' then i.advance_deduction := round((p ->> 'advance_deduction')::numeric, 2); end if;
  if p ? 'notes' then i.notes := p ->> 'notes'; end if;
  if least(i.bonus, i.other_deduction, i.late_deduction, i.absence_deduction, i.advance_deduction) < 0 then
    raise exception 'Amounts cannot be negative.' using errcode = '22023';
  end if;
  if i.advance_deduction > i.advance_balance then
    raise exception 'Advance recovery cannot exceed the outstanding advance (%).', i.advance_balance using errcode = '22023';
  end if;
  i.net_pay := app.payroll_item_net(i);
  if i.net_pay < 0 then raise exception 'Net pay cannot be negative.' using errcode = '22023'; end if;
  update public.payroll_items set bonus = i.bonus, other_deduction = i.other_deduction, late_deduction = i.late_deduction,
    absence_deduction = i.absence_deduction, advance_deduction = i.advance_deduction, notes = i.notes, net_pay = i.net_pay
  where id = p_id;
  update public.payroll_runs set total_net = (select sum(net_pay) from public.payroll_items where run_id = i.run_id) where id = i.run_id;
end $$;

create or replace function public.payroll_approve(p_run uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  r public.payroll_runs;
  i public.payroll_items;
  v_lines jsonb := '[]'::jsonb;
begin
  perform app.require_perm('payroll.approve');
  select * into r from public.payroll_runs where id = p_run for update;
  if r.id is null or r.status <> 'draft' then raise exception 'Only draft payroll runs can be approved.' using errcode = '22023'; end if;
  for i in select * from public.payroll_items where run_id = p_run loop
    if i.net_pay < 0 then raise exception 'Net pay cannot be negative.' using errcode = '22023'; end if;
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('gl', '5400', 'dr', i.net_pay + i.advance_deduction),
      jsonb_build_object('gl', '1400', 'cr', i.advance_deduction, 'party_type', 'employee', 'party_id', i.employee_id),
      jsonb_build_object('gl', '2400', 'cr', i.net_pay, 'party_type', 'employee', 'party_id', i.employee_id));
  end loop;
  perform app.post_journal(r.period_end, 'payroll', p_run, 'Payroll ' || r.run_no, v_lines);
  update public.payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_run;
end $$;

create or replace function public.payroll_cancel(p_run uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  r public.payroll_runs;
begin
  perform app.require_perm('payroll.approve');
  perform app.set_reason(p_reason);
  select * into r from public.payroll_runs where id = p_run for update;
  if r.id is null or r.status = 'cancelled' then raise exception 'Payroll run not found or already cancelled.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.payment_allocations pa join public.payments py on py.id = pa.payment_id
             join public.payroll_items pi on pi.id = pa.doc_id
             where pa.doc_type = 'payroll_item' and pi.run_id = p_run and py.status <> 'cancelled') then
    raise exception 'Salary payments exist for this run; cancel them first.' using errcode = '22023';
  end if;
  if r.status = 'approved' then
    perform app.reverse_journal('payroll', p_run, 'Payroll cancelled: ' || p_reason);
  end if;
  update public.payroll_runs set status = 'cancelled', cancel_reason = p_reason where id = p_run;
end $$;

create trigger payroll_runs_audit after insert or update on public.payroll_runs for each row execute function app.audit();
create trigger payroll_items_audit after update on public.payroll_items for each row execute function app.audit();
create trigger payroll_runs_no_delete before delete on public.payroll_runs for each row execute function app.prevent_delete();
